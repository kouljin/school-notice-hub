// 브라우저 쪽 푸시 헬퍼. 서버 모듈(firebase-admin, web-push)과 섞이지 않게 파일을 분리해 둔다.

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export const pushSupported = (): boolean =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

// iPadOS 13+는 데스크톱 Safari로 위장하므로 터치 포인트로 함께 판별한다.
export const isIos = (): boolean =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// iOS는 "홈 화면에 추가"로 설치된 standalone 앱에서만 웹 푸시를 허용한다.
export const isStandalone = (): boolean =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

// VAPID 공개키는 base64url이고 applicationServerKey는 바이트 배열을 요구한다.
function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
    // PwaSetup이 이미 등록해 두지만, 알림을 먼저 켜는 경우를 대비해 여기서도 보장한다.
    await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
    if (!pushSupported()) return null;
    return (await registration()).pushManager.getSubscription();
}

// 반드시 사용자 탭(클릭) 안에서 불러야 한다 — 페이지 로드 중 호출하면 브라우저가 무시한다.
export async function subscribe(): Promise<PushSubscription> {
    if (!VAPID_PUBLIC_KEY) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY 가 설정되지 않았습니다.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');

    const reg = await registration();
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    return reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
}

export async function unsubscribe(): Promise<string | null> {
    const sub = await currentSubscription();
    if (!sub) return null;
    const { endpoint } = sub;
    await sub.unsubscribe();
    return endpoint;
}
