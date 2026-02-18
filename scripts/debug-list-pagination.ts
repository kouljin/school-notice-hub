import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

// Cheongdo Middle School (cheongdoms) config
const URL_CONFIG = {
    sysId: 'cheongdoms',
    mi: '108947',
    bbsId: '39256'
};

async function debugListPagination() {
    console.log('Fetching list...');
    const listUrl = `https://school.gyo6.net/${URL_CONFIG.sysId}/na/ntt/selectNttList.do`;

    // Fetch page 1
    const response = await axios.get(listUrl, {
        params: {
            mi: URL_CONFIG.mi,
            bbsId: URL_CONFIG.bbsId,
            currPage: 1
        }
    });

    const $ = cheerio.load(response.data);

    // Dump pagination HTML
    // Common classes: .paging, .page_list, .bbs_page
    const pagingHtml = $('.paging').html() || $('.page').html() || $('.bbs_paging').html() || 'Pagination NOT FOUND';

    console.log('--- Pagination HTML ---');
    console.log(pagingHtml);
    console.log('-----------------------');

    // Try to find total count
    // Often in .total or .list_info
    const totalHtml = $('.total').html() || $('.list_info').html() || 'Total count NOT FOUND';
    console.log('--- Total Info HTML ---');
    console.log(totalHtml);
    console.log('-----------------------');

    fs.writeFileSync('debug_list.html', response.data);
    console.log('Saved list HTML to debug_list.html');
}

debugListPagination();
