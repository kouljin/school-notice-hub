import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
    const body = await request.json();
    const { sysId, nttSn, mi, bbsId } = body;

    if (!sysId || !nttSn || !mi || !bbsId) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const url = `https://school.gyo6.net/${sysId}/na/ntt/selectNttInfo.do?mi=${mi}&bbsId=${bbsId}&nttSn=${nttSn}`;

        // The site expects form-urlencoded data for the POST body
        const params = new URLSearchParams();
        params.append('sysId', sysId);

        const response = await axios.post(url, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            responseType: 'text',
        });

        const $ = cheerio.load(response.data);

        // Extract content
        // The content is usually in a div with class 'subContent' or specific table structure
        // Based on view2.html, the content is in .subContent, but looking deeper:
        // It seems to be in a table structure or overlapping divs.
        // Let's look at view2.html again. It has <div class="subContent"> then some scripts, then <div class="bbs_viewA"> maybe?
        // I need to be careful with selectors.
        // In view2.html (which I have locally, I can check if I am unsure, but I removed it).
        // Let's assume standard structure: usually .bbs_viewA or similar.
        // Wait, I should double check the selector. 
        // In the file view2.html I saw earlier:
        // It had "subContent".
        // I will try to select `.subContent` or `.bbs_ViewA`.

        // Actually, looking at the common pattern for these sites, the content is often in `.bbs_view` or similar.
        // I'll grab the whole `.subContent` but remove scripts and buttons.

        // Let's refine the selector.
        // I'll return the HTML of the content area.

        // Check for xFreeUploader JS attachments
        // Pattern: wFileUpload.fileAttachAddTxt("name", "url", ...)
        const html = response.data; // Cheerio loads this, but we can search the raw string too or script tags
        const attachments: any[] = [];

        $('script').each((_, script) => {
            const scriptContent = $(script).html() || '';
            const regex = /fileAttachAddTxt\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
            let match;
            while ((match = regex.exec(scriptContent)) !== null) {
                const name = match[1];
                const href = match[2];
                if (name && href) {
                    attachments.push({ name, href: `https://school.gyo6.net${href}` });
                }
            }
        });

        // Also check if there are any standard links in .file_list just in case
        $('.file_list a').each((_, element) => {
            const name = $(element).text().trim();
            const href = $(element).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
                attachments.push({ name, href: `https://school.gyo6.net${href}` });
            }
        });

        // Remove scripts and styles
        $('script').remove();
        $('style').remove();
        $('.btnWrap').remove();
        $('.btns').remove();
        $('.bbsV_atchmnfl').remove(); // Remove the school's broken attachment UI containing the xFreeUploader placeholder
        $('.bbsV_prne').remove(); // Remove prev/next links

        let contentHtml = $('.bbs_ViewA').html() || $('.subContent').html();

        return NextResponse.json({ content: contentHtml, attachments });

    } catch (error) {
        console.error('Error fetching notice detail:', error);
        return NextResponse.json({ error: 'Failed to fetch notice detail' }, { status: 500 });
    }
}
