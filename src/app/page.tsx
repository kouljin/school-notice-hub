import { Suspense } from 'react';
import { SCHOOLS } from '@/const/schools';
import { loadNotices } from '@/lib/notices';
import type { Notice } from '@/types';
import NoticeBrowser from '@/components/NoticeBrowser';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

// 알림(딥링크)이나 기본값으로 첫 화면에 보여줄 게시판을 정한다.
function resolveTarget(params: Record<string, string | string[] | undefined>) {
    const school = SCHOOLS.find((s) => s.id === first(params.school)) ?? SCHOOLS[0];
    const boards = school.boards ?? [];
    const board =
        boards.find((b) => b.id === first(params.board)) ??
        boards.find((b) => b.id === 'notice') ??
        boards[0];

    return {
        schoolId: school.id,
        sysId: school.sysId,
        boardId: board?.id ?? 'notice',
        mi: board?.mi ?? school.mi,
        bbsId: board?.bbsId ?? school.bbsId,
        nttSn: first(params.ntt),
    };
}

// 서버에서 첫 목록을 미리 받아 HTML에 실어 보낸다.
// 예전에는 페이지 전체가 클라이언트 컴포넌트라, 654KB의 JS를 받아 하이드레이션이 끝나기
// 전에는 첫 요청조차 나가지 못했다.
async function InitialView({ params }: { params: Record<string, string | string[] | undefined> }) {
    const target = resolveTarget(params);

    let notices: Notice[] = [];
    let totalPages = 1;

    try {
        const data = await loadNotices(target);
        notices = data.notices;
        totalPages = data.totalPages;
    } catch (error) {
        // 학교 서버가 죽어 있어도 앱은 떠야 한다. 클라이언트가 새로고침으로 다시 시도한다.
        console.error('[page] 초기 목록 조회 실패', error);
    }

    return (
        <NoticeBrowser
            initialNotices={notices}
            initialTotalPages={totalPages}
            initialSchoolId={target.schoolId}
            initialBoardId={target.boardId}
            initialNttSn={target.nttSn}
        />
    );
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;

    return (
        <Suspense fallback={<Loading />}>
            <InitialView params={params} />
        </Suspense>
    );
}

function Loading() {
    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600">공지사항을 불러오는 중…</p>
            </div>
        </main>
    );
}
