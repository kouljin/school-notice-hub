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

// 학교 서버로 나가는 모든 요청의 단일 통로 — 타임아웃과 UA를 여기서만 정한다.
// 타임아웃이 없으면 멈춰 있는 커넥션 하나가 라우트 전체를 플랫폼 한계까지 붙잡는다.
export async function fetchHtml(url: string, opts: FetchOpts = {}): Promise<string> {
    const { revalidate, headers, ...rest } = opts;

    const res = await fetch(url, {
        ...rest,
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        ...(revalidate === undefined ? {} : { next: { revalidate } }),
    });

    if (!res.ok) throw new Error(`gyo6 responded ${res.status} for ${url}`);
    return res.text();
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
