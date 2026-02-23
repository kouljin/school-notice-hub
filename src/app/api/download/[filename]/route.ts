import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const urlObj = new URL(request.url);
    const targetUrl = urlObj.searchParams.get('url');

    // Extract filename from the URL path (/api/download/[filename]) as a fallback to query params
    const pathSegments = urlObj.pathname.split('/');
    const pathFilename = decodeURIComponent(pathSegments[pathSegments.length - 1] || '');
    const filename = urlObj.searchParams.get('filename') || pathFilename || 'download.bin';

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                // Fake a referer to prevent blocking by some school servers
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://school.gyo6.net/',
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }

        const remoteContentType = response.headers.get('content-type') || '';
        if (remoteContentType.includes('text/html')) {
            // The school server returned an HTML error page instead of the actual file
            console.error("Download blocked: Remote server returned an HTML error page.");

            // Return a small user-friendly text file instead of a corrupted 100KB HTML file
            const errorMsg = "해당 파일은 학교 서버 보안 문제로 인해 현재 다운로드할 수 없습니다. (접근 권한 만료 또는 잘못된 링크)\n학교 홈페이지에 직접 방문하셔서 다운로드해 주시기 바랍니다.";
            const encoder = new TextEncoder();
            const errorBytes = encoder.encode(errorMsg);

            const errHeaders = new Headers();
            errHeaders.set('Content-Type', 'text/plain; charset=utf-8');
            errHeaders.set('Content-Length', errorBytes.length.toString());

            // Send back a txt file with an error alert name
            const errFilename = encodeURIComponent("학교서버_다운로드_오류안내.txt");
            errHeaders.set('Content-Disposition', `attachment; filename="error.txt"; filename*=UTF-8''${errFilename}`);

            return new NextResponse(errorBytes, {
                status: 200, // Keep 200 so download popup triggers with the text file
                headers: errHeaders,
            });
        }

        const arrayBuffer = await response.arrayBuffer();

        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        headers.set('Content-Length', arrayBuffer.byteLength.toString());

        // Use RFC 5987 encoding for filenames with non-ASCII characters
        const originalFilename = filename || 'download.bin';
        const encodedFilename = encodeURIComponent(originalFilename).replace(/['()]/g, escape).replace(/\*/g, '%2A');

        // Ensure the fallback filename has an extension so OS knows what it is even if UTF-8 parsing fails
        const extensionMatch = originalFilename.match(/\.[0-9a-z]+$/i);
        const extension = extensionMatch ? extensionMatch[0] : '';
        const fallbackFilename = `download_file${extension}`;

        // Chrome on Mac is notoriously fickle. It prefers the raw encoded string in the regular filename attribute, 
        // alongside the standard RFC 5987 `filename*` attribute. 
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"; filename*=UTF-8''${encodedFilename}`);

        // Return ArrayBuffer to avoid Next.js stream chunking corruption without Content-Length
        return new NextResponse(arrayBuffer, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Download proxy error:', error);
        return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }
}
