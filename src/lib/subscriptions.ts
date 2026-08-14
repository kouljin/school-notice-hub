import 'server-only';
import { createHash } from 'node:crypto';

// endpoint는 매우 길고 URL이라 문서 ID로 쓸 수 없다. 해시를 쓰면 같은 기기가 다시 구독해도
// 같은 문서로 떨어져 중복이 생기지 않는다.
export const subscriptionId = (endpoint: string): string =>
    createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

export interface SubscriptionDoc {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    boards: string[];
    disabled?: boolean;
    ua?: string;
}

// 브라우저가 준 PushSubscription.toJSON() 결과를 검증한다.
export function parseSubscription(
    input: unknown,
): Pick<SubscriptionDoc, 'endpoint' | 'keys'> | null {
    if (typeof input !== 'object' || input === null) return null;
    const { endpoint, keys } = input as { endpoint?: unknown; keys?: unknown };

    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) {
        return null;
    }
    if (typeof keys !== 'object' || keys === null) return null;

    const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
    if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;

    return { endpoint, keys: { p256dh, auth } };
}
