import { NextResponse } from 'next/server';
import { adminDb, isFirestoreConfigured } from '@/lib/firebase-admin';
import { parseSubscription, subscriptionId, type SubscriptionDoc } from '@/lib/subscriptions';
import { isPushConfigured, sendPush } from '@/lib/push';

// 설정 화면의 "테스트 알림 보내기". 권한·서비스워커·VAPID가 실제로 맞물리는지
// 새 공지를 기다리지 않고 바로 확인하기 위한 것이다.
export async function POST(request: Request) {
    if (!isFirestoreConfigured || !isPushConfigured) {
        return NextResponse.json({ error: '알림 기능이 아직 설정되지 않았습니다.' }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;
    if (!endpoint) return NextResponse.json({ error: 'endpoint 누락' }, { status: 400 });

    const ref = adminDb().doc(`subscriptions/${subscriptionId(endpoint)}`);
    const snap = await ref.get();
    const stored = snap.data() as SubscriptionDoc | undefined;
    const subscription = parseSubscription(stored);

    if (!subscription) {
        return NextResponse.json({ error: '등록되지 않은 구독입니다.' }, { status: 404 });
    }

    const result = await sendPush(subscription, {
        title: '알림 설정 완료',
        body: '새 공지가 올라오면 이렇게 알려드립니다.',
        url: '/',
        tag: 'test',
    });

    if (result === 'expired') {
        await ref.delete();
        return NextResponse.json({ error: '구독이 만료되었습니다. 알림을 다시 켜주세요.' }, { status: 410 });
    }

    return NextResponse.json({ result }, { status: result === 'sent' ? 200 : 502 });
}
