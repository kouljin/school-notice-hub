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
        try {
            // 선택 필드를 undefined로 두고 써도 죽지 않게 한다.
            cached.settings({ ignoreUndefinedProperties: true });
        } catch {
            // settings()는 Firestore 인스턴스당 한 번만 허용된다. cached는 모듈 단위인데
            // firebase-admin의 앱 레지스트리는 프로세스 단위라, 같은 프로세스에서 이 모듈이
            // 두 번 평가되면(dev HMR: 홈 SSR로 한 번, API 라우트로 또 한 번) 두 번째가 던진다.
            // 이미 적용돼 있다는 뜻이니 무시하면 된다.
        }
    }

    return cached;
}
