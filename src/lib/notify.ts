import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { appNoticePath, type BoardRef } from '@/lib/boards';
import { parseSubscription, type SubscriptionDoc } from '@/lib/subscriptions';
import { isPushConfigured, sendPush } from '@/lib/push';
import type { ParsedNotice } from '@/lib/gyo6/parse';

export interface NewNotice extends ParsedNotice {
    board: BoardRef;
}

export interface NotifySummary {
    sent: number;
    skipped: number;
    failed: number;
    expired: number;
}

// 같은 (구독자, 공지)에 대해 딱 한 번만 발송되게 하는 표식.
// Firestore의 create()는 문서가 이미 있으면 실패한다 — 그 원자성이 곧 중복 방지다.
// ponytail: create()와 실제 발송 사이에 프로세스가 죽으면 그 알림 1건은 유실된다(재시도 없음).
//   공지는 이미 seenIds에 들어가 다시 "새 글"로 잡히지 않기 때문이다. 유실이 문제가 되면
//   dgacademy의 claimForSend(claimed→sent + stale claim 재시도)로 갈아끼우면 된다.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function claim(db: Firestore, subId: string, noticeKey: string): Promise<boolean> {
    try {
        await db.doc(`deliveries/${subId}__${noticeKey}`).create({
            sentAt: FieldValue.serverTimestamp(),
            // Firebase 콘솔 → Firestore → TTL 에서 deliveries.expireAt 정책을 켜면
            // 이 표식들이 자동으로 청소된다. 안 켜도 동작은 하지만 문서가 계속 쌓인다.
            expireAt: new Date(Date.now() + THIRTY_DAYS_MS),
        });
        return true;
    } catch {
        return false; // ALREADY_EXISTS — 이미 보냈다
    }
}

export async function notifyNewNotices(
    db: Firestore,
    fresh: NewNotice[],
): Promise<NotifySummary> {
    const summary: NotifySummary = { sent: 0, skipped: 0, failed: 0, expired: 0 };
    if (!isPushConfigured || fresh.length === 0) return summary;

    // 구독자는 게시판 키 배열을 들고 있다. 새 글이 걸린 게시판들만 한 번에 조회한다.
    const boardKeys = [...new Set(fresh.map((n) => n.board.key))];

    // array-contains-any는 한 번에 30개까지다. 게시판이 그보다 많으면 나눠 조회한다.
    const subscribers = new Map<string, SubscriptionDoc>();
    for (let i = 0; i < boardKeys.length; i += 30) {
        const snap = await db
            .collection('subscriptions')
            .where('boards', 'array-contains-any', boardKeys.slice(i, i + 30))
            .get();
        for (const doc of snap.docs) subscribers.set(doc.id, doc.data() as SubscriptionDoc);
    }

    for (const notice of fresh) {
        const noticeKey = `${notice.board.key}_${notice.nttSn}`;

        for (const [subId, stored] of subscribers) {
            if (stored.disabled || !stored.boards?.includes(notice.board.key)) continue;

            const subscription = parseSubscription(stored);
            if (!subscription) continue;

            if (!(await claim(db, subId, noticeKey))) {
                summary.skipped += 1;
                continue;
            }

            const result = await sendPush(subscription, {
                title: `${notice.board.schoolName} ${notice.board.boardName}`,
                body: notice.title,
                url: appNoticePath(notice.board, notice.nttSn),
                tag: notice.board.key,
            });

            if (result === 'sent') summary.sent += 1;
            else if (result === 'expired') {
                summary.expired += 1;
                await db.doc(`subscriptions/${subId}`).delete();
                subscribers.delete(subId);
            } else {
                summary.failed += 1;
            }
        }
    }

    return summary;
}
