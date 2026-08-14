'use client';

import { useEffect } from 'react';

// 서비스워커를 미리 등록해 둔다. 알림 권한과는 별개로, 등록이 되어 있어야
// 나중에 사용자가 알림을 켤 때 곧바로 구독할 수 있다.
export default function PwaSetup() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker
            .register('/sw.js')
            .catch((error) => console.error('서비스워커 등록 실패', error));
    }, []);

    return null;
}
