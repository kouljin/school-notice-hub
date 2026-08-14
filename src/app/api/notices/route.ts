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

    try {
        const { notices, currentPage, totalPages } = await loadNotices(input);
        return NextResponse.json(
            { notices, pagination: { currentPage, totalPages } },
            // 라우트 세그먼트 revalidate는 searchParams를 읽는 순간 무효가 된다.
            // 실제로 캐시가 걸리는 곳은 이 헤더(CDN·브라우저)와 loadNotices 안의 fetch revalidate다.
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
        );
    } catch (error) {
        console.error('[notices] fetch failed', input, error);
        return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 502 });
    }
}
