import 'server-only';
import webpush from 'web-push';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

export const isPushConfigured = Boolean(publicKey && privateKey && subject);

if (publicKey && privateKey && subject) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface StoredSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export interface PushPayload {
    title: string;
    body: string;
    url: string;
    tag?: string;
}

// expired = 되살릴 수 없는 구독(구독 해지·브라우저 폐기). 저장소에서 걷어내야 한다.
export type PushResult = 'sent' | 'expired' | 'failed';

export async function sendPush(
    subscription: StoredSubscription,
    payload: PushPayload,
): Promise<PushResult> {
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
            TTL: 6 * 60 * 60, // 6시간 — 하루 지난 공지 알림을 뒤늦게 띄우는 건 소음이다
            urgency: 'normal',
        });
        return 'sent';
    } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) return 'expired';
        console.error('[push] 발송 실패', statusCode, error);
        return 'failed';
    }
}
