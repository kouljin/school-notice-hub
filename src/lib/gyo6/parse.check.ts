// gyo6 파서 자체 점검. 실행: node --experimental-strip-types src/lib/gyo6/parse.check.ts
// 픽스처는 실제 school.gyo6.net 응답을 저장한 것이다.
//   list.html        청도중 공지사항 — 고정 없는 평범한 게시판
//   list-pinned.html 이서고 가정통신문 — 통합공지·자체고정·중복이 섞인 게시판
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNoticeList, parseNoticeDetail, type ParsedNotice } from './parse';

const fixture = (name: string) =>
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

function assertRows(rows: ParsedNotice[], label: string): void {
    assert.equal(new Set(rows.map((n) => n.nttSn)).size, rows.length, `${label}: nttSn 중복 없음`);

    for (const n of rows) {
        assert.match(n.nttSn, /^\d+$/, `${label}: nttSn 숫자 ${n.nttSn}`);
        assert.ok(n.title.length > 0, `${label}: 제목 비어있지 않음`);
        // 회귀 방지의 핵심 — em.mTit 라벨이 텍스트에 섞이면 안 된다.
        assert.doesNotMatch(n.date, /등록일/, `${label}: date에 라벨 혼입 ${JSON.stringify(n.date)}`);
        assert.doesNotMatch(n.author, /작성자/, `${label}: author에 라벨 혼입 ${JSON.stringify(n.author)}`);
        assert.match(n.date, /^\d{4}[.\-]\d{2}[.\-]\d{2}$/, `${label}: date 형식 ${JSON.stringify(n.date)}`);
    }
}

// --- 목록 ---
const { notices, totalPages } = parseNoticeList(fixture('list.html'));

assert.equal(notices.length, 10, '목록 10행');
assert.equal(totalPages, 28, '끝 페이지 링크 goPaging(28)');
assertRows(notices, 'list');

// --- 목록: 상단고정이 섞인 게시판 ---
// 16행(통합공지 3 + 자체고정 3 + 일반 10)이지만 자체고정된 16866764가 아래 일반 목록에도
// 다시 나와 실제로는 15건이다. 중복이 살아남으면 목록에 같은 공지가 두 줄 뜨고
// NoticeList의 key={notice.id}까지 겹친다.
const pinned = parseNoticeList(fixture('list-pinned.html'));

assert.equal(pinned.notices.length, 15, '16행 중 중복 1건 제거');
assert.equal(pinned.totalPages, 17, '끝 페이지 링크 goPaging(17)');
assertRows(pinned.notices, 'list-pinned');

// 남는 쪽은 먼저 만난 고정 위치여야 한다 — 뒤엣것을 남기면 고정 순서가 무너진다.
assert.equal(
    pinned.notices.findIndex((n) => n.nttSn === '16866764'),
    3,
    '중복 글은 고정 영역(4번째)에 남는다',
);
// 통합공지도 일반 행과 같은 열 구조로 읽혀야 한다(첫 셀이 숫자가 아닐 뿐이다).
assert.equal(pinned.notices[0].nttSn, '16918358', '첫 행은 통합공지');
assert.equal(pinned.notices[0].date, '2026.07.16', '통합공지 등록일');

// --- 상세 ---
const { content, attachments } = parseNoticeDetail(fixture('notice.html'), 'cheongdoms');

assert.equal(attachments.length, 1, '첨부 1건');
assert.equal(attachments[0].name, '2026년도 청도중학교 개인위탁 스포츠강사 모집 공고.hwp');
assert.match(attachments[0].href, /^https:\/\/school\.gyo6\.net\/upload\/cheongdoms\//, '절대 URL');
// 회귀 방지 — 예전엔 껍데기(.bbs_ViewA)를 집어 본문이 통째로 비어 있었고,
// 살균에서 <form>을 지우면 본문을 감싼 폼째로 공지가 사라졌다. 둘 다 이 단언에 걸린다.
const bodyText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
assert.ok(bodyText.includes('스포츠강사'), `본문 텍스트 유실: ${JSON.stringify(bodyText.slice(0, 120))}`);
assert.ok(bodyText.length > 100, `본문이 너무 짧다(${bodyText.length}자)`);
assert.doesNotMatch(content, /xFreeUploader|문서변환중/, '원본 사이트의 첨부 위젯 잔재 혼입');

// --- 살균 ---
const dirty = parseNoticeDetail(
    `<div class="bbs_ViewA">
       <img src="x" onerror="alert(1)">
       <a href="javascript:alert(1)">클릭</a>
       <iframe src="https://evil.example"></iframe>
       <img src="data:image/png;base64,iVBOR">
       <a href="/보도자료.hwp">첨부</a>
     </div>`,
    'cheongdoms',
);
assert.doesNotMatch(dirty.content, /onerror/i, 'on* 핸들러 제거');
assert.doesNotMatch(dirty.content, /javascript:/i, 'javascript: 링크 제거');
assert.doesNotMatch(dirty.content, /<iframe/i, 'iframe 제거');
assert.match(dirty.content, /data:image\/png/, '인라인 이미지는 보존');
assert.match(dirty.content, /href="\/보도자료\.hwp"/, '정상 링크는 보존');

// <form>은 지우지 않되(본문을 감싸고 있다) 전송 대상은 없애야 한다.
const wrapped = parseNoticeDetail(
    `<div class="bbsV_cont"><form action="javascript:alert(1)"><p>본문 살아있음</p></form></div>`,
    'cheongdoms',
);
assert.match(wrapped.content, /본문 살아있음/, 'form 안의 본문 보존');
assert.doesNotMatch(wrapped.content, /javascript:/i, 'form action 제거');

console.log(
    `OK — 목록 ${notices.length}건 / ${totalPages}페이지, ` +
        `고정 섞인 목록 ${pinned.notices.length}건(중복 1건 제거), ` +
        `첨부 ${attachments.length}건, 살균 통과`,
);
