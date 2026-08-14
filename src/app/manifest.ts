import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: '청도학교 정보 — 공지사항 모음',
        short_name: '청도학교',
        description: '청도 지역 학교의 공지사항·가정통신문을 한곳에서 보고 새 글 알림을 받습니다.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        // iOS는 홈 화면에 추가된 standalone 앱에서만 웹 푸시를 허용한다.
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}
