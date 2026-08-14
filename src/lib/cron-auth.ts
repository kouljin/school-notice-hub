import 'server-only';
import { NextResponse } from 'next/server';

// 크론 라우트 공통 인증 — fail-closed.
// 인라인 가드(`authorization !== "Bearer " + process.env.CRON_SECRET`)는 비밀이 미설정이면
// 우변이 "Bearer undefined"가 되어 그 헤더를 보낸 사람이 통과하는 fail-open 버그가 된다.
// 미설정이면 503으로 닫아 아무도 못 부르게 한다.
export function assertCron(request: Request): NextResponse | null {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return new NextResponse('CRON_SECRET 미설정 — 크론 비활성', { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    return null;
}
