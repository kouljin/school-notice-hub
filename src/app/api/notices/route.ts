import { NextResponse } from 'next/server';
import { SCHOOLS } from '@/const/schools';
import { isValidBoard, loadNotices } from '@/lib/notices';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') ?? '';
    const school = SCHOOLS.find((s) => s.id === schoolId);

    // 쿼리로 넘어온 게시판이 우선이다. 학교 설정값(school.mi/bbsId)은 공지사항 게시판 고정이라
    // 가정통신문·평가계획을 보고 있을 때 그걸 쓰면 엉뚱한 게시판을 가리키게 된다.
    const input = {
        schoolId,
        sysId: searchParams.get('sysId') || school?.sysId,
        mi: searchParams.get('mi') || school?.mi,
        bbsId: searchParams.get('bbsId') || school?.bbsId,
        page: Number(searchParams.get('page')) || 1,
        search: searchParams.get('search') ?? '',
    };

    if (!isValidBoard(input)) {
        return NextResponse.json({ error: 'Invalid board parameters' }, { status: 400 });
    }

    // 새로고침 버튼만 붙인다 — 캐시를 건너뛰고 학교 서버를 직접 읽는다.
    const fresh = searchParams.get('fresh') === '1';

    try {
        const { notices, currentPage, totalPages, source } = await loadNotices(input, { fresh });

        return NextResponse.json(
            { notices, pagination: { currentPage, totalPages } },
            {
                headers: {
                    // 라우트 세그먼트 revalidate는 searchParams를 읽는 순간 무효가 된다.
                    // 실제 캐시는 이 헤더(브라우저·CDN)와 loadNotices 안의 fetch revalidate가 담당한다.
                    // max-age가 없으면 s-maxage는 CDN에만 적용되어 브라우저가 매번 재요청한다
                    // — 학교 탭을 A→B→A로 오갈 때 불필요한 왕복이 생긴다.
                    'Cache-Control': fresh
                        ? 'no-store'
                        : 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
                    'X-Notice-Source': source, // 캐시가 실제로 타는지 확인용
                },
            },
        );
    } catch (error) {
        console.error('[notices] fetch failed', input, error);
        return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 502 });
    }
}
