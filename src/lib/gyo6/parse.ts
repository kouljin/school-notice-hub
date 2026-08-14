import * as cheerio from 'cheerio';
import { ORIGIN } from './fetch';

export interface ParsedNotice {
    nttSn: string;
    title: string;
    author: string;
    date: string;
}

export interface Attachment {
    name: string;
    href: string;
}

// 셀 안에는 모바일용 숨김 라벨(<em class="mTit">등록일</em>)이 들어 있어
// 그냥 text()를 읽으면 "등록일 2026.02.13"이 나온다. 라벨을 걷어낸 뒤 공백을 정규화한다.
const clean = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

// "2026.02.13" → 한국 시간 자정의 epoch. 타임존을 붙이지 않으면 UTC 자정으로 읽혀 9시간이 밀린다.
export function parseKstDate(text: string): number | null {
    const m = text.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/);
    if (!m) return null;
    const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    return Number.isNaN(t) ? null : t;
}

export function parseNoticeList(html: string): { notices: ParsedNotice[]; totalPages: number } {
    const $ = cheerio.load(html);
    const notices: ParsedNotice[] = [];

    $('.bbs_ListA tbody tr').each((_, el) => {
        const row = $(el);
        row.find('em.mTit').remove(); // 작성자·등록일·조회수 셀에 모두 붙어 있어 한 번에 처리된다

        const link = row.find('td.bbs_tit a');
        const nttSn = link.attr('data-id');
        if (!nttSn) return; // "게시물이 없습니다" 같은 안내 행

        notices.push({
            nttSn,
            title: clean(link.text()),
            author: clean(row.find('td').eq(2).text()),
            date: clean(row.find('td').eq(3).text()),
        });
    });

    return { notices, totalPages: parseTotalPages($) };
}

// 여러 후보 중 실제 내용이 있는 첫 컨테이너. 페이지마다 골격이 조금씩 달라 순서대로 시도한다.
function firstNonEmpty($: cheerio.CheerioAPI, selectors: string[]) {
    for (const sel of selectors) {
        const el = $(sel);
        if (el.length && el.text().trim()) return el;
    }
    return $(selectors[selectors.length - 1]);
}

function parseTotalPages($: cheerio.CheerioAPI): number {
    const pageOf = (onclick: string | undefined) =>
        Number(onclick?.match(/goPaging\((\d+)\)/)?.[1] ?? 0);

    // "끝 페이지" 링크가 있으면 그게 곧 총 페이지 수다.
    const end = pageOf($('.bbs_pagerA .pgeR2').attr('onclick'));
    if (end) return end;

    // 없으면(=마지막 묶음) 보이는 번호 중 최댓값. 현재 페이지는 <strong>이라 onclick이 없다.
    let max = Number($('.bbs_pagerA strong.bbs_pge_num').text().trim()) || 1;
    $('.bbs_pagerA a').each((_, el) => {
        max = Math.max(max, pageOf($(el).attr('onclick')));
    });
    return max;
}

// 첨부파일은 DOM에 없다. #fileDownload 컨테이너는 비어 있고 xFreeUploader가 실행 시점에 채운다.
// 파일명과 경로는 초기 응답의 인라인 <script> 인자에만 존재한다:
//   wFileUpload.fileAttachAddTxt("공고.hwp","/upload/cheongdoms/na/bbs_39256/ntt_.../doc_....hwp","108032",...)
// /upload/ 는 인증이 필요 없는 정적 경로다(쿠키·Referer 없는 순수 GET으로 정상 수신 확인).
// ponytail: 큰따옴표와 인자 순서에 강결합 — 다른 스킨의 학교를 추가하면 조용히 0건이 된다.
//           크론이 첨부 0건 연속을 로그로 드러내면 그때 셀렉터를 넓힌다.
const ATTACH_RE = /fileAttachAddTxt\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;

export function parseNoticeDetail(
    html: string,
    sysId: string,
): { content: string; attachments: Attachment[] } {
    const $ = cheerio.load(html);

    // 스크립트를 지우기 전에 첨부부터 뽑는다.
    const attachments: Attachment[] = [];
    $('script').each((_, el) => {
        for (const m of ($(el).html() || '').matchAll(ATTACH_RE)) {
            attachments.push({
                name: m[1],
                href: m[2].startsWith('http') ? m[2] : `${ORIGIN}${m[2]}`,
            });
        }
    });

    sanitize($);
    $('.btnWrap, .btns, .bbsV_atchmnfl, .bbsV_prne').remove(); // 원본 사이트의 조작 UI 제거

    // .bbsV_cont 가 순수 본문이다. 예전에는 .bbs_ViewA(제목·작성자·첨부 UI까지 포함한 껍데기)를
    // 집었는데, 모달이 제목·작성자·첨부를 이미 따로 그리므로 중복이었고 본문은 묻혀 있었다.
    const content = firstNonEmpty($, ['.bbsV_cont', '.bbs_ViewA', '.subContent']);

    content.find('img').each((_, el) => {
        const src = $(el).attr('src');
        if (!src || /^(https?:|data:)/i.test(src)) return;
        $(el).attr('src', src.startsWith('/') ? `${ORIGIN}${src}` : `${ORIGIN}/${sysId}/na/ntt/${src}`);
    });

    return { content: content.html() || '', attachments };
}

// 이 HTML은 학교 직원 수백 명이 WYSIWYG로 작성한 것이고 dangerouslySetInnerHTML로 들어간다.
// React가 <script>는 실행하지 않지만 on* 핸들러와 javascript: 링크, iframe은 그대로 동작한다.
// form은 뺀다 — 이 사이트는 본문(.bbs_ViewA)을 <form>으로 감싸고 있어서 지우면 공지가 통째로 날아간다.
// 대신 아래 URL_ATTRS가 action/formaction을 걷어내므로 어디로도 전송되지 않는다.
const DANGEROUS_TAGS = 'script, style, iframe, object, embed, link, meta, base, noscript';
const URL_ATTRS = /^(href|src|xlink:href|action|formaction|srcdoc|background|poster)$/i;

const isDangerousUrl = (v: string): boolean =>
    /^\s*(javascript|vbscript):/i.test(v) ||
    // data: 는 이미지에 한해 허용한다 — 본문에 인라인 이미지를 쓰는 공지가 있다.
    (/^\s*data:/i.test(v) && !/^\s*data:image\//i.test(v));

function sanitize($: cheerio.CheerioAPI): void {
    $(DANGEROUS_TAGS).remove();

    $('*').each((_, el) => {
        // $('*')의 원소 타입에는 Document도 포함되어 attribs가 없을 수 있다.
        const attribs: Record<string, string> = ('attribs' in el && el.attribs) || {};
        for (const [name, value] of Object.entries(attribs)) {
            if (/^on/i.test(name)) $(el).removeAttr(name);
            else if (URL_ATTRS.test(name) && isDangerousUrl(value)) $(el).removeAttr(name);
        }
    });
}
