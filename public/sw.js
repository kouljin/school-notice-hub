// 푸시 알림 전용 서비스 워커.
// fetch 핸들러는 일부러 두지 않는다 — 오프라인 캐싱은 요구사항이 아니고,
// 빈 fetch 핸들러는 모든 요청에 서비스워커 왕복 비용만 얹는다.
// ponytail: Chrome은 설치 조건에서 fetch 핸들러 요구를 없앴다(모바일 108, 데스크톱 112).
//           나중에 "유효한 오프라인 페이지" 검사로 바뀔 수 있다고 예고했으니,
//           설치가 막히는 날이 오면 그때 오프라인 폴백 한 장을 추가하면 된다.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }

    const title = data.title || '새 공지가 올라왔습니다';

    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            // 같은 게시판 알림이 여러 개 쌓이지 않도록 게시판 키로 묶는다.
            tag: data.tag || undefined,
            renotify: Boolean(data.tag),
            data: { url: data.url || '/' },
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });

            // 이미 열려 있는 창이 있으면 그쪽으로 이동시킨다(앱이 두 번 뜨지 않게).
            for (const client of windows) {
                try {
                    await client.focus();
                    if ('navigate' in client) await client.navigate(url);
                    return;
                } catch {
                    // navigate는 서비스워커가 제어 중인 창에서만 된다 — 실패하면 새 창으로 떨어진다.
                }
            }

            await self.clients.openWindow(url);
        })(),
    );
});
