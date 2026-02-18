import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

// Cheongdo Middle School (cheongdoms) config
// From src/const/schools.ts
const URL_CONFIG = {
    sysId: 'cheongdoms',
    mi: '108947',
    bbsId: '39256'
};

async function debugNotice() {
    console.log('Fetching list...');
    // 1. Fetch List to get a valid nttSn
    const listUrl = `https://school.gyo6.net/${URL_CONFIG.sysId}/na/ntt/selectNttList.do?mi=${URL_CONFIG.mi}&bbsId=${URL_CONFIG.bbsId}`;
    const listRes = await axios.get(listUrl);
    const $list = cheerio.load(listRes.data);

    // Find first notice link
    // Usually in .bbs_list .subject a
    // The onClick usually has fn_view(nttSn);
    let nttSn = '';

    // Look for link in .bbs_ListA
    $list('.bbs_ListA tbody tr').each((_, element) => {
        const titleLink = $list(element).find('td.bbs_tit a');
        const id = titleLink.attr('data-id');
        if (id) {
            nttSn = id;
            console.log(`Found nttSn: ${nttSn}`);
            return false; // break
        }
    });

    if (!nttSn) {
        console.error('Could not find a notice nttSn');
        // Dump list html
        fs.writeFileSync('debug_list.html', listRes.data);
        console.log('Saved list HTML to debug_list.html');
        return;
    }

    console.log(`Found nttSn: ${nttSn}`);

    // 2. Fetch Detail
    const detailUrl = `https://school.gyo6.net/${URL_CONFIG.sysId}/na/ntt/selectNttInfo.do?mi=${URL_CONFIG.mi}&bbsId=${URL_CONFIG.bbsId}&nttSn=${nttSn}`;
    const params = new URLSearchParams();
    params.append('sysId', URL_CONFIG.sysId);

    // Headers to mimic browser
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    console.log(`Fetching detail from ${detailUrl}...`);
    const detailRes = await axios.post(detailUrl, params, { headers });

    // Save to file for inspection
    fs.writeFileSync('debug_notice.html', detailRes.data);
    console.log('Saved HTML to debug_notice.html');

    // 3. Test Parsing Logic
    const $ = cheerio.load(detailRes.data);

    const attachments: any[] = [];
    // Current selector
    $('.file_list a').each((_, element) => {
        const name = $(element).text().trim();
        const href = $(element).attr('href');
        if (href) {
            attachments.push({ name, href: `https://school.gyo6.net${href}` });
        }
    });
    console.log('Parsed attachments (current selector .file_list a):', attachments);

    // Try other selectors
    const otherAttachments: any[] = [];
    $('.board_file a').each((_, element) => {
        const name = $(element).text().trim();
        const href = $(element).attr('href');
        if (href && !href.includes('javascript')) {
            otherAttachments.push({ name, href, selector: '.board_file a' });
        }
    });
    console.log('Parsed attachments (alt selector .board_file a):', otherAttachments);

    // Check for the "첨부파일" text area
    // Usually formatted as table or dl/dt/dd
    const fileArea = $('.addedFile').html() || $('.file_view').html() || 'Not found';
    console.log('File Area HTML snippet:', fileArea.substring(0, 200));

}

debugNotice();
