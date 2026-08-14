// 저장소 상태 점검. 실행: npm run inspect
// 크론이 게시판을 제대로 훑고 있는지, 구독·발송이 쌓이는지 눈으로 확인하는 용도.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } =
    process.env;

if (!FIREBASE_ADMIN_PRIVATE_KEY) {
    console.error('FIREBASE_ADMIN_* 환경변수가 없습니다. node --env-file=.env.local 로 실행하세요.');
    process.exit(1);
}

const db = getFirestore(
    initializeApp({
        credential: cert({
            projectId: FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n'),
        }),
    }),
);

console.log(`프로젝트: ${FIREBASE_ADMIN_PROJECT_ID}\n`);

for (const name of ['boards', 'subscriptions', 'deliveries']) {
    const { count } = await db.collection(name).count().get().then((s) => s.data());
    console.log(`  ${name.padEnd(14)} ${count}개`);
}

const boards = await db.collection('boards').orderBy('schoolName').get();
console.log('');

for (const doc of boards.docs) {
    const d = doc.data();
    const fail = (d.failCount ?? 0) > 0 ? `  ⚠︎ 실패 ${d.failCount}회` : '';
    // latest[0]은 상단고정 글일 수 있다 — 실제 최신은 날짜 최댓값으로 본다.
    const newest = (d.latest ?? []).map((n) => n.date).filter(Boolean).sort().at(-1) ?? '—';
    const pinned = (d.latest?.length ?? 0) - 10;
    console.log(
        `  ${(d.schoolName + ' / ' + d.boardName).padEnd(24)} ` +
            `최신 ${newest}  기억 ${String(d.seenIds?.length ?? 0).padStart(2)}건` +
            `${pinned > 0 ? `  고정 ${pinned}건` : ''}${fail}`,
    );
}

const subs = await db.collection('subscriptions').get();
if (subs.size) {
    console.log('\n  구독 기기:');
    for (const doc of subs.docs) {
        const d = doc.data();
        console.log(`    ${doc.id.slice(0, 8)}…  게시판 ${d.boards?.length ?? 0}개  ${d.ua?.slice(0, 50) ?? ''}`);
    }
}
