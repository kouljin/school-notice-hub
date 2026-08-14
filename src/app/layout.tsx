import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaSetup from '@/components/PwaSetup';

export const metadata: Metadata = {
    title: '청도학교 정보 — 공지사항 모음',
    description: '청도 지역 학교의 공지사항·가정통신문을 한곳에서 보고 새 글 알림을 받습니다.',
    applicationName: '청도학교 정보',
    // iOS는 홈 화면에 추가된 standalone 앱에서만 웹 푸시를 허용한다.
    appleWebApp: { capable: true, title: '청도학교', statusBarStyle: 'default' },
    // 학교 공지 원문을 그대로 싣고 있어 검색엔진에 중복 노출될 이유가 없다.
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    themeColor: '#2563eb',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="ko">
            <body className="antialiased">
                {children}
                <PwaSetup />
            </body>
        </html>
    );
}
