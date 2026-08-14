import 'server-only';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// Vercel 대시보드에 넣은 값은 바깥 따옴표가 벗겨지지 않아 PEM 파싱이 깨진다
// (ERR_OSSL_UNSUPPORTED / DECODER routines::unsupported). dgacademy에서 겪은 정규화를 그대로 쓴다.
function normalizePrivateKey(raw: string | undefined): string | undefined {
    return raw
        ?.trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\n/g, '\n');
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

export const isFirestoreConfigured = Boolean(projectId && clientEmail && privateKey);

let cached: Firestore | null = null;

export function adminDb(): Firestore {
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            'Firestore 미설정 — FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY 가 필요합니다.',
        );
    }

    if (!cached) {
        const app = getApps().length
            ? getApp()
            : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
        cached = getFirestore(app);
        // 선택 필드를 undefined로 두고 써도 죽지 않게 한다.
        cached.settings({ ignoreUndefinedProperties: true });
    }

    return cached;
}
