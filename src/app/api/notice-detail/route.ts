import { NextResponse } from 'next/server';
import { ORIGIN, fetchHtml, isSysId, isNumericId } from '@/lib/gyo6/fetch';
import { parseNoticeDetail } from '@/lib/gyo6/parse';

// GET인 이유: 이전에는 POST라 CDN이 캐시할 수 없었고, 그래서 라우트 안에 모듈 스코프 Map을
// 두고 직접 캐싱했다. 그 Map은 만료 항목을 회수하지 않아 무한히 커졌고(웜 인스턴스에서 실제 누수),
// 인스턴스마다 따로 있어 적중률도 1/N이었다. 캐싱은 여기 Cache-Control 한 줄에 맡긴다.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sysId = searchParams.get('sysId');
    const mi = searchParams.get('mi');
    const bbsId = searchParams.get('bbsId');
    const nttSn = searchParams.get('nttSn');

    if (!isSysId(sysId) || !isNumericId(mi) || !isNumericId(bbsId) || !isNumericId(nttSn)) {
        return NextResponse.json({ error: 'Invalid notice parameters' }, { status: 400 });
    }

    const url = `${ORIGIN}/${sysId}/na/ntt/selectNttInfo.do?mi=${mi}&bbsId=${bbsId}&nttSn=${nttSn}`;

    try {
        // 원본 사이트가 폼 인코딩 POST를 기대한다(쿼리 파라미터만으로는 본문이 비어 돌아온다).
        const html = await fetchHtml(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ sysId }),
        });

        return NextResponse.json(parseNoticeDetail(html, sysId), {
            // max-age가 있어야 같은 공지를 닫았다 다시 열 때 네트워크 왕복이 사라진다.
            // s-maxage만 있으면 CDN에서만 캐시되고 브라우저는 매번 다시 묻는다.
            headers: {
                'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        console.error('[notice-detail] fetch failed', { sysId, mi, bbsId, nttSn, error });
        return NextResponse.json({ error: 'Failed to fetch notice detail' }, { status: 502 });
    }
}
