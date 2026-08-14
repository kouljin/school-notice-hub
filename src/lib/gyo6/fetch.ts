export const ORIGIN = 'https://school.gyo6.net';

const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TIMEOUT_MS = 15_000;

// sysId는 URL 경로에, mi/bbsId는 쿼리에 그대로 들어간다. 형태를 강제해 경로 조작을 막는다.
export const isSysId = (v: unknown): v is string =>
    typeof v === 'string' && /^[a-z0-9]{1,40}$/i.test(v);

export const isNumericId = (v: unknown): v is string =>
    typeof v === 'string' && /^[0-9]{1,20}$/.test(v);

type FetchOpts = RequestInit & { revalidate?: number };

const RETRY_DELAY_MS = 300;

// undici는 연결 단계 실패만 TypeError로 던진다(메시지는 죄다 "fetch failed", 진짜 이유는 cause).
// 타임아웃은 DOMException('TimeoutError'), HTTP 상태 오류는 아래에서 만드는 평범한 Error라
// 이 한 줄이 "다시 물어볼 가치가 있는 실패"를 정확히 골라낸다.
const isRetriable = (error: unknown): boolean => error instanceof TypeError;

async function attempt(url: string, { revalidate, headers, ...rest }: FetchOpts): Promise<string> {
    const res = await fetch(url, {
        ...rest,
        headers: { 'User-Agent': UA, ...headers },
        // 시도마다 새로 만들어야 한다 — 한 번 쓴 시그널은 이미 abort된 상태다.
        signal: AbortSignal.timeout(TIMEOUT_MS),
        ...(revalidate === undefined ? {} : { next: { revalidate } }),
    });

    if (!res.ok) throw new Error(`gyo6 responded ${res.status} for ${url}`);
    return res.text();
}

// 학교 서버로 나가는 모든 요청의 단일 통로 — 타임아웃과 UA를 여기서만 정한다.
// 타임아웃이 없으면 멈춰 있는 커넥션 하나가 라우트 전체를 플랫폼 한계까지 붙잡는다.
//
// 연결 실패는 1회만 재시도한다. 크론이 콜드스타트 직후 첫 동시 요청 5개를 통째로 날린 적이
// 있는데(2026-08-14 14:30, 게시판 5개 동시 실패), 이런 실패는 즉시 떨어지므로 재시도 비용이
// 거의 없고 다음 회차까지 10분을 버리는 것보다 낫다. 반대로 타임아웃을 재시도하면 15초를 한 번
// 더 태울 뿐이고 404/500은 다시 물어도 같은 답이 온다 — 그래서 isRetriable로 걸러낸다.
export async function fetchHtml(url: string, opts: FetchOpts = {}): Promise<string> {
    try {
        return await attempt(url, opts);
    } catch (error) {
        if (!isRetriable(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return attempt(url, opts);
    }
}

// 동시 요청 상한. 무제한 Promise.all 팬아웃은 스스로도 타임아웃에 걸리고,
// 상대(교육청 서버) 입장에서는 증폭 공격이 된다.
export async function mapLimit<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;

    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (next < items.length) {
                const i = next++;
                results[i] = await fn(items[i]);
            }
        }),
    );

    return results;
}
