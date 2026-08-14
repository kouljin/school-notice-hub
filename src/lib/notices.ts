import 'server-only';
import type { Notice } from '@/types';
import { ORIGIN, fetchHtml, isSysId, isNumericId } from '@/lib/gyo6/fetch';
import { parseNoticeList, type ParsedNotice } from '@/lib/gyo6/parse';
import { adminDb, isFirestoreConfigured } from '@/lib/firebase-admin';
import { boardKey } from '@/lib/boards';

export interface LoadNoticesInput {
    schoolId: string;
    sysId: string;
    mi: string;
    bbsId: string;
    page?: number;
    search?: string;
}

export interface NoticePage {
    notices: Notice[];
    currentPage: number;
    totalPages: number;
    source: 'cache' | 'live';
}

export const MAX_PAGE = 9999;

// 크론이 10분마다 갱신한다. 이 시간을 넘긴 캐시는 신뢰하지 않고 직접 긁는다.
// 크론이 KST 07~23시만 돌므로 심야에는 이 가드가 걸려 자동으로 라이브로 넘어간다.
const CACHE_MAX_AGE_MS = 20 * 60 * 1000;

export function isValidBoard(input: Partial<LoadNoticesInput>): input is LoadNoticesInput {
    return Boolean(
        input.schoolId && isSysId(input.sysId) && isNumericId(input.mi) && isNumericId(input.bbsId),
    );
}

const toNotices = (parsed: ParsedNotice[], b: LoadNoticesInput): Notice[] =>
    parsed.map(({ nttSn, title, author, date }) => ({
        id: nttSn,
        title,
        author,
        date,
        schoolId: b.schoolId,
        linkParams: { mi: b.mi, bbsId: b.bbsId, nttSn, sysId: b.sysId },
    }));

// 크론이 저장해 둔 1페이지 목록. 74KB HTML 스크레이프가 문서 읽기 한 번이 된다.
// 속도만이 아니라 — 학교 서버가 느리거나 죽어도 목록이 뜨고, 보는 사람이 늘어도
// 교육청 서버 부하가 늘지 않는다.
async function loadFromCache(input: LoadNoticesInput): Promise<NoticePage | null> {
    if (!isFirestoreConfigured) return null;

    try {
        const snap = await adminDb().doc(`boards/${boardKey(input.sysId, input.bbsId)}`).get();
        const data = snap.data();
        if (!data?.latest?.length) return null;

        const lastOk = (data.lastOkAt as { toMillis?: () => number } | undefined)?.toMillis?.();
        if (!lastOk || Date.now() - lastOk > CACHE_MAX_AGE_MS) return null;

        return {
            notices: toNotices(data.latest as ParsedNotice[], input),
            currentPage: 1,
            totalPages: (data.totalPages as number) || 1,
            source: 'cache',
        };
    } catch (error) {
        // 캐시는 최적화일 뿐이다 — 실패하면 조용히 라이브로 떨어진다.
        console.error('[notices] 캐시 조회 실패, 라이브로 전환', error);
        return null;
    }
}

async function loadLive(input: LoadNoticesInput, page: number): Promise<NoticePage> {
    const url = new URL(`${ORIGIN}/${input.sysId}/na/ntt/selectNttList.do`);
    url.searchParams.set('mi', input.mi);
    url.searchParams.set('bbsId', input.bbsId);
    url.searchParams.set('currPage', String(page));
    if (input.search) {
        url.searchParams.set('searchType', 'sj'); // sj=제목, cn=내용, all=제목+내용, nm=작성자
        url.searchParams.set('searchValue', input.search);
    }

    const { notices, totalPages } = parseNoticeList(
        await fetchHtml(url.toString(), { revalidate: 60 }),
    );

    return { notices: toNotices(notices, input), currentPage: page, totalPages, source: 'live' };
}

// 목록 조회의 단일 구현. API 라우트와 서버 컴포넌트가 같은 것을 쓴다
// (서버 컴포넌트가 자기 API를 HTTP로 다시 부르는 낭비를 없앤다).
export async function loadNotices(
    input: LoadNoticesInput,
    { fresh = false }: { fresh?: boolean } = {},
): Promise<NoticePage> {
    const page = Math.min(Math.max(1, input.page ?? 1), MAX_PAGE);

    // 캐시가 담고 있는 건 검색 없는 1페이지뿐이다.
    if (!fresh && page === 1 && !input.search) {
        const cached = await loadFromCache(input);
        if (cached) return cached;
    }

    return loadLive(input, page);
}
