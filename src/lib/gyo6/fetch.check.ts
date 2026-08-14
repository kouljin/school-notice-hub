// fetchHtml 재시도 규칙 점검. 실행: npm run check
// 재시도는 눈에 보이지 않는 동작이라(성공하면 흔적이 없다) 규칙이 뒤집혀도 아무도 모른다.
// 특히 "타임아웃은 재시도하지 않는다"가 깨지면 느린 게시판 하나가 크론 예산을 두 배로 먹는다.
import assert from 'node:assert/strict';
import { fetchHtml } from './fetch';

const realFetch = globalThis.fetch;

// 호출 횟수를 세면서 정해진 순서대로 응답/오류를 돌려주는 가짜 fetch.
async function withStub(
    outcomes: (() => Response | never)[],
    run: () => Promise<unknown>,
): Promise<{ calls: number; error: unknown }> {
    let calls = 0;
    globalThis.fetch = (async () => outcomes[Math.min(calls++, outcomes.length - 1)]()) as typeof fetch;

    try {
        await run();
        return { calls, error: null };
    } catch (error) {
        return { calls, error };
    } finally {
        globalThis.fetch = realFetch;
    }
}

const ok = () => new Response('<html>본문</html>', { status: 200 });
// undici가 연결 실패에 쓰는 형태 — 메시지는 죄다 같고 진짜 이유는 cause에 있다.
const netFail = () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
};
const timeout = () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
};
const serverError = () => new Response('nope', { status: 500 });

const url = 'https://school.gyo6.net/x/na/ntt/selectNttList.do';

// tsx가 이 파일을 CJS로 변환하므로 최상위 await를 쓸 수 없다.
async function main(): Promise<void> {
    // 연결 실패 → 한 번 더 물어서 성공. 크론이 콜드스타트 직후 실제로 겪은 경로다.
    const recovered = await withStub([netFail, ok], () => fetchHtml(url));
    assert.equal(recovered.error, null, '두 번째 시도로 회복해야 한다');
    assert.equal(recovered.calls, 2, '연결 실패는 1회 재시도');

    // 계속 실패해도 두 번까지만 — 무한 재시도는 크론 전체를 태운다.
    const givenUp = await withStub([netFail], () => fetchHtml(url));
    assert.ok(givenUp.error instanceof TypeError, '마지막 오류를 그대로 올린다');
    assert.equal(
        ((givenUp.error as Error).cause as { code?: string }).code,
        'ECONNRESET',
        'cause가 살아 있어야 describeError가 원인을 남긴다',
    );
    assert.equal(givenUp.calls, 2, '재시도는 1회뿐');

    // 타임아웃은 "서버가 느리다"는 뜻이라 다시 물으면 15초를 한 번 더 태울 뿐이다.
    const timedOut = await withStub([timeout], () => fetchHtml(url));
    assert.ok(timedOut.error instanceof DOMException, '타임아웃 오류를 그대로 올린다');
    assert.equal(timedOut.calls, 1, '타임아웃은 재시도하지 않는다');

    // 404·500은 다시 물어도 같은 답이 온다.
    const failed = await withStub([serverError], () => fetchHtml(url));
    assert.match((failed.error as Error).message, /responded 500/, 'HTTP 상태를 메시지에 남긴다');
    assert.equal(failed.calls, 1, 'HTTP 상태 오류는 재시도하지 않는다');

    console.log('OK — 재시도: 연결실패 2회 / 타임아웃 1회 / HTTP오류 1회');
}

main();
