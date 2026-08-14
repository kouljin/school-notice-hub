import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, isFirestoreConfigured } from '@/lib/firebase-admin';
import { boardsFromConfig } from '@/lib/boards';
import { parseSubscription, subscriptionId, type SubscriptionDoc } from '@/lib/subscriptions';
import { isPushConfigured } from '@/lib/push';

const MAX_BOARDS = 100;

const unavailable = () =>
    NextResponse.json({ error: '알림 기능이 아직 설정되지 않았습니다.' }, { status: 503 });

// 클라이언트가 보낸 게시판 키 중 설정에 실제로 있는 것만 남긴다.
function validBoards(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const known = new Set(boardsFromConfig().map((b) => b.key));
    return [...new Set(input.filter((k): k is string => typeof k === 'string' && known.has(k)))].slice(
        0,
        MAX_BOARDS,
    );
}

// 이 기기가 어떤 게시판을 구독 중인지 — UI가 체크박스 상태를 복원할 때 쓴다.
export async function GET(request: Request) {
    if (!isFirestoreConfigured || !isPushConfigured) return unavailable();

    const endpoint = new URL(request.url).searchParams.get('endpoint');
    if (!endpoint) return NextResponse.json({ error: 'endpoint 누락' }, { status: 400 });

    const snap = await adminDb().doc(`subscriptions/${subscriptionId(endpoint)}`).get();
    const data = snap.data() as SubscriptionDoc | undefined;

    return NextResponse.json({
        subscribed: snap.exists && !data?.disabled,
        boards: data?.boards ?? [],
    });
}

export async function POST(request: Request) {
    if (!isFirestoreConfigured || !isPushConfigured) return unavailable();

    const body = await request.json().catch(() => null);
    const subscription = parseSubscription(body?.subscription);
    if (!subscription) {
        return NextResponse.json({ error: '구독 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const boards = validBoards(body?.boards);

    await adminDb()
        .doc(`subscriptions/${subscriptionId(subscription.endpoint)}`)
        .set(
            {
                ...subscription,
                boards,
                disabled: false,
                ua: request.headers.get('user-agent')?.slice(0, 300) ?? '',
                updatedAt: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp(),
            },
            // createdAt은 merge라 첫 저장 이후에도 덮인다. 정확한 최초 시각이 필요해지면 그때 분리한다.
            { merge: true },
        );

    return NextResponse.json({ subscribed: boards.length > 0, boards });
}

export async function DELETE(request: Request) {
    if (!isFirestoreConfigured || !isPushConfigured) return unavailable();

    const body = await request.json().catch(() => null);
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;
    if (!endpoint) return NextResponse.json({ error: 'endpoint 누락' }, { status: 400 });

    await adminDb().doc(`subscriptions/${subscriptionId(endpoint)}`).delete();
    return NextResponse.json({ subscribed: false, boards: [] });
}
