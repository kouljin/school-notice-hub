import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, isFirestoreConfigured } from '@/lib/firebase-admin';
import { assertCron } from '@/lib/cron-auth';
import { boardsFromConfig, listUrl } from '@/lib/boards';
import { fetchHtml, mapLimit } from '@/lib/gyo6/fetch';
import { parseKstDate, parseNoticeList } from '@/lib/gyo6/parse';
import { notifyNewNotices, type NewNotice } from '@/lib/notify';

export const maxDuration = 120;

const CONCURRENCY = 5;
// 목록 1페이지가 10건이므로 40개면 한 번의 폴링 사이에 밀려나갈 일이 없다.
const SEEN_LIMIT = 40;
// 목록 1페이지에는 상단고정(공지) 글이 섞여 있다. 학교가 오래된 글을 새로 고정하면
// 그 글의 nttSn이 우리에겐 처음 보이는 값이라 "새 글"로 오인된다.
// 게시일이 이 기간을 벗어난 글은 알리지 않는다. 크론이 며칠 멈췄다 살아나도
// 밀린 글이 한꺼번에 터지지 않는 효과도 같이 얻는다.
const NOTIFY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface BoardState {
    seeded?: boolean;
    seenIds?: string[];
}

export async function GET(request: Request) {
    const denied = assertCron(request);
    if (denied) return denied;

    // 자격증명 없이 돌면 스택트레이스가 찍힌 500이 남는다. 크론 로그에서 원인이 바로 보이게 닫는다.
    if (!isFirestoreConfigured) {
        return NextResponse.json({ error: 'Firestore 미설정 — 환경변수를 확인하세요.' }, { status: 503 });
    }

    const db = adminDb();
    const boards = boardsFromConfig();

    const snapshots = await db.getAll(...boards.map((b) => db.doc(`boards/${b.key}`)));
    const state = new Map<string, BoardState>(
        snapshots.map((snap, i) => [boards[i].key, (snap.data() as BoardState) ?? {}]),
    );

    const fresh: NewNotice[] = [];
    const failures: { board: string; error: string }[] = [];
    const batch = db.batch();
    let seededNow = 0;

    await mapLimit(boards, CONCURRENCY, async (board) => {
        const ref = db.doc(`boards/${board.key}`);
        try {
            // no-store가 중요하다 — 데이터 캐시에서 읽으면 크론이 영원히 새 글을 못 본다.
            const { notices, totalPages } = parseNoticeList(
                await fetchHtml(listUrl(board), { cache: 'no-store' }),
            );

            const prev = state.get(board.key) ?? {};
            const seen = new Set(prev.seenIds ?? []);

            // 첫 수집은 저장만 하고 알리지 않는다. 안 그러면 게시판마다 수십 건이 한꺼번에 터진다.
            if (prev.seeded) {
                const now = Date.now();
                for (const n of notices) {
                    if (seen.has(n.nttSn)) continue;
                    const posted = parseKstDate(n.date);
                    // 날짜를 못 읽으면 알린다 — 조용히 놓치는 것보다 낫다.
                    if (posted !== null && now - posted > NOTIFY_MAX_AGE_MS) continue;
                    fresh.push({ ...n, board });
                }
            } else {
                seededNow += 1;
            }

            // 새 ID를 앞에 두고 자른다 — 오래된 것부터 밀려난다.
            const seenIds = [...new Set([...notices.map((n) => n.nttSn), ...(prev.seenIds ?? [])])].slice(
                0,
                SEEN_LIMIT,
            );

            batch.set(
                ref,
                {
                    ...board,
                    enabled: true,
                    seeded: true,
                    seenIds,
                    // 목록 API가 스크레이프 없이 즉시 응답하는 캐시 (src/lib/notices.ts)
                    latest: notices,
                    totalPages,
                    lastPolledAt: FieldValue.serverTimestamp(),
                    lastOkAt: FieldValue.serverTimestamp(),
                    failCount: 0,
                    lastError: FieldValue.delete(),
                },
                { merge: true },
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push({ board: board.key, error: message });
            console.error(`[cron/poll] ${board.key} 실패`, error);

            // 실패해도 문서는 남긴다 — failCount가 쌓이면 어느 게시판이 죽었는지 드러난다.
            batch.set(
                ref,
                {
                    ...board,
                    enabled: true,
                    lastPolledAt: FieldValue.serverTimestamp(),
                    failCount: FieldValue.increment(1),
                    lastError: message.slice(0, 300),
                },
                { merge: true },
            );
        }
    });

    // 먼저 커밋한다. 발송 도중 죽더라도 같은 공지를 다음 실행이 다시 "새 글"로 잡지 않게 한다
    // (중복 알림 > 알림 1건 유실).
    await batch.commit();

    const delivery = await notifyNewNotices(db, fresh);

    return NextResponse.json({
        polled: boards.length,
        seededNow,
        newCount: fresh.length,
        delivery,
        failures,
        newNotices: fresh.map((n) => ({
            board: n.board.key,
            school: n.board.schoolName,
            boardName: n.board.boardName,
            nttSn: n.nttSn,
            title: n.title,
            date: n.date,
        })),
    });
}
