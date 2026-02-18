import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const filename = searchParams.get('filename');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: {
                // Fake a referer if needed, or just let it be empty/generic
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://school.gyo6.net/',
            }
        });

        const headers = new Headers();
        headers.set('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename || 'download')}"`);

        return new NextResponse(response.data, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Download proxy error:', error);
        return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }
}
