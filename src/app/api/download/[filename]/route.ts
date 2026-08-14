import { NextResponse } from 'next/server';
import { ORIGIN } from '@/lib/gyo6/fetch';

const MAX_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

export async function GET(request: Request) {
    const urlObj = new URL(request.url);
    const targetUrl = urlObj.searchParams.get('url');

    // 경로 마지막 조각(/api/download/[filename])을 파일명 폴백으로 쓴다.
    const pathFilename = decodeURIComponent(urlObj.pathname.split('/').pop() || '');
    const filename = urlObj.searchParams.get('filename') || pathFilename || 'download.bin';

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // 이 라우트가 없으면 임의 URL을 서버가 대신 받아 되돌려주는 열린 프록시가 된다
    // (내부망·메타데이터 엔드포인트 포함). 정당한 값은 첨부 파서가 만든 school.gyo6.net URL뿐이다.
    let parsed: URL;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return NextResponse.json({ error: 'Malformed url parameter' }, { status: 400 });
    }
    if (parsed.origin !== ORIGIN) {
        return NextResponse.json({ error: 'Forbidden download origin' }, { status: 400 });
    }

    try {
        const response = await fetch(parsed, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                Referer: `${ORIGIN}/`,
            },
            redirect: 'manual', // 리다이렉트로 허용 오리진 밖을 가리키게 만드는 우회를 막는다
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }

        const declaredSize = Number(response.headers.get('content-length'));
        if (declaredSize > MAX_BYTES) {
            return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }

        const remoteContentType = response.headers.get('content-type') || '';
        if (remoteContentType.includes('text/html')) {
            // 학교 서버가 파일 대신 HTML 페이지를 돌려준 경우. 그대로 흘려보내면
            // 100KB짜리 깨진 .hwp가 저장된다. 대신 안내 텍스트 파일을 내려준다.
            console.error('[download] remote returned HTML instead of a file', parsed.pathname);

            const errorBytes = new TextEncoder().encode(
                '학교 서버가 파일 대신 안내 페이지를 반환했습니다.\n' +
                    '파일이 삭제되었거나 링크가 변경되었을 수 있습니다.\n' +
                    '학교 홈페이지에서 직접 내려받아 주세요.',
            );

            return new NextResponse(errorBytes, {
                status: 200, // 200이어야 브라우저가 다운로드로 처리해 사용자에게 안내가 닿는다
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Length': String(errorBytes.length),
                    'Content-Disposition': `attachment; filename="error.txt"; filename*=UTF-8''${encodeURIComponent('학교서버_다운로드_오류안내.txt')}`,
                },
            });
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) {
            return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }

        // RFC 5987. Chrome on Mac은 filename에도 인코딩된 문자열이 들어가야 한글 이름을 제대로 살린다.
        const encodedFilename = encodeURIComponent(filename)
            .replace(/['()]/g, escape)
            .replace(/\*/g, '%2A');

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': remoteContentType || 'application/octet-stream',
                // Content-Length를 명시해야 Next의 스트림 청크 분할로 파일이 깨지지 않는다.
                'Content-Length': String(arrayBuffer.byteLength),
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodedFilename}`,
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (error) {
        console.error('[download] proxy error', parsed.href, error);
        return NextResponse.json({ error: 'Failed to download file' }, { status: 502 });
    }
}
