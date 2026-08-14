import { NextResponse } from 'next/server';
import { School } from '@/types';
import { adminDb, isFirestoreConfigured } from '@/lib/firebase-admin';
import { boardKey } from '@/lib/boards';
import { ORIGIN, fetchHtml, isSysId, isNumericId, mapLimit } from '@/lib/gyo6/fetch';
import { parseKstDate, parseNoticeList, type ParsedNotice } from '@/lib/gyo6/parse';

const MAX_BOARDS = 60; // 기본 8개 학교 = 18개 게시판. 요청 본문으로 팬아웃을 키우지 못하게 막는다.
const CONCURRENCY = 5;
const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const hasRecent = (notices: ParsedNotice[] | undefined, now: number): boolean =>
    (notices ?? []).some((n) => {
        const posted = parseKstDate(n.date ?? '');
        if (posted === null) return false;
        const age = now - posted;
        return age <= NEW_WINDOW_MS && age >= -DAY_MS; // 미래 날짜로 올리는 공지가 있다
    });

export async function POST(request: Request) {
    try {
        const { schools } = (await request.json()) as { schools?: School[] };
        if (!Array.isArray(schools)) {
            return NextResponse.json({ error: 'Invalid schools data' }, { status: 400 });
        }

        const targets = schools.flatMap((school) =>
            (school.boards ?? [])
                .filter(
                    (board) =>
                        isSysId(school.sysId) && isNumericId(board.mi) && isNumericId(board.bbsId),
                )
                .map((board) => ({ school, board, key: boardKey(school.sysId, board.bbsId) })),
        );

        if (targets.length > MAX_BOARDS) {
            return NextResponse.json({ error: 'Too many boards' }, { status: 400 });
        }

        const now = Date.now();
        const result: Record<string, Record<string, boolean>> = {};
        for (const school of schools) result[school.id] = {};

        // 크론이 이미 모아 둔 목록이 있으면 그걸 읽는다 — 조회 한 번이면 끝난다.
        // 예전에는 화면을 열 때마다 학교 서버로 18번을 나갔다.
        let remaining = targets;

        if (isFirestoreConfigured && targets.length > 0) {
            const db = adminDb();
            const snaps = await db.getAll(...targets.map((t) => db.doc(`boards/${t.key}`)));
            const cached = new Map(snaps.map((s, i) => [targets[i].key, s.exists ? s.data() : null]));

            remaining = targets.filter((t) => {
                const doc = cached.get(t.key);
                if (!doc) return true; // 아직 크론이 안 훑은 게시판(예: 사용자가 추가한 학교)
                result[t.school.id][t.board.id] = hasRecent(doc.latest as ParsedNotice[], now);
                return false;
            });
        }

        // Firestore에 없는 것만 직접 긁는다.
        await mapLimit(remaining, CONCURRENCY, async ({ school, board }) => {
            const url = `${ORIGIN}/${school.sysId}/na/ntt/selectNttList.do?mi=${board.mi}&bbsId=${board.bbsId}`;
            try {
                const { notices } = parseNoticeList(await fetchHtml(url, { revalidate: 3600 }));
                result[school.id][board.id] = hasRecent(notices, now);
            } catch (error) {
                console.error(`[status] ${school.id}/${board.id} 실패`, error);
                result[school.id][board.id] = false;
            }
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('[status] request failed', error);
        return NextResponse.json({ error: 'Failed to check notices status' }, { status: 500 });
    }
}
