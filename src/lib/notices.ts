import type { Notice } from '@/types';
import { ORIGIN, fetchHtml, isSysId, isNumericId } from '@/lib/gyo6/fetch';
import { parseNoticeList } from '@/lib/gyo6/parse';

export interface LoadNoticesInput {
    schoolId: string;
    sysId: string;
    mi: string;
    bbsId: string;
    page?: number;
    search?: string;
}

export const MAX_PAGE = 9999;

export function isValidBoard(input: Partial<LoadNoticesInput>): input is LoadNoticesInput {
    return Boolean(
        input.schoolId && isSysId(input.sysId) && isNumericId(input.mi) && isNumericId(input.bbsId),
    );
}

// 목록 조회의 단일 구현. API 라우트와 서버 컴포넌트가 같은 것을 쓴다
// (서버 컴포넌트가 자기 API를 HTTP로 다시 부르는 낭비를 없앤다).
export async function loadNotices({
    schoolId,
    sysId,
    mi,
    bbsId,
    page = 1,
    search = '',
}: LoadNoticesInput): Promise<{ notices: Notice[]; currentPage: number; totalPages: number }> {
    const safePage = Math.min(Math.max(1, page), MAX_PAGE);

    const url = new URL(`${ORIGIN}/${sysId}/na/ntt/selectNttList.do`);
    url.searchParams.set('mi', mi);
    url.searchParams.set('bbsId', bbsId);
    url.searchParams.set('currPage', String(safePage));
    if (search) {
        url.searchParams.set('searchType', 'sj'); // sj=제목, cn=내용, all=제목+내용, nm=작성자
        url.searchParams.set('searchValue', search);
    }

    const { notices, totalPages } = parseNoticeList(
        await fetchHtml(url.toString(), { revalidate: 60 }),
    );

    return {
        notices: notices.map(({ nttSn, title, author, date }) => ({
            id: nttSn,
            title,
            author,
            date,
            schoolId,
            linkParams: { mi, bbsId, nttSn, sysId },
        })),
        currentPage: safePage,
        totalPages,
    };
}
