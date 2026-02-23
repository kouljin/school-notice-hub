const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const sysId = 'cheongdoms';
    // Let's get the list of notices first to find one with an attachment
    const listUrl = `https://school.gyo6.net/${sysId}/na/ntt/selectNttList.do?mi=108947&bbsId=39256`;
    console.log("Fetching list...", listUrl);
    const listRes = await axios.get(listUrl);

    const $ = cheerio.load(listRes.data);
    let nttSn = null;

    // Find the first notice with an attachment icon (class icAttach)
    $('tr').each((i, el) => {
      if ($(el).find('.icAttach').length > 0) {
        const onclick = $(el).find('a').attr('onclick');
        if (onclick) {
          // nttSn is usually argument to fn_view
          const match = /fn_view\('([^']+)'\)/.exec(onclick) || /nttSn=([^&]+)/.exec($(el).find('a').attr('href') || '');
          if (match) {
            nttSn = match[1];
            console.log("Found notice with attachment:", nttSn);
          }
        }
      }
    });

    if (!nttSn) {
      console.log("No notice with attachments found in the first page!");
      return;
    }

    // Now fetch details
    const mi = '108947';
    const bbsId = '39256';
    const params = new URLSearchParams();
    params.append('sysId', sysId);

    const url = `https://school.gyo6.net/${sysId}/na/ntt/selectNttInfo.do?mi=${mi}&bbsId=${bbsId}&nttSn=${nttSn}`;
    console.log("Fetching detail from:", url);
    const res = await axios.post(url, params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, responseType: 'text' });

    const html = res.data;
    const regex = /fileAttachAddTxt\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
    let match;
    const attachments = [];
    while ((match = regex.exec(html)) !== null) {
      attachments.push({ name: match[1], href: match[2] });
    }

    // Check .file_list a
    const $2 = cheerio.load(html);
    $2('.file_list a').each((_, element) => {
      const name = $2(element).text().trim();
      const href = $2(element).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
        attachments.push({ name, href: href });
      }
    });

    console.log("Found attachments:", attachments);

    if (attachments.length > 0) {
      let attachUrl = attachments[0].href;
      if (!attachUrl.startsWith('http')) {
        attachUrl = `https://school.gyo6.net${attachUrl.startsWith('/') ? '' : '/'}${attachUrl}`;
      }
      console.log("Trying to download:", attachUrl);
      const dlRes = await axios.get(attachUrl, { responseType: 'arraybuffer' });
      console.log("Download status:", dlRes.status, dlRes.headers['content-type'], dlRes.data.length, "bytes");
    }
  } catch (e) {
    console.error(e.message);
    if (e.response) console.error(e.response.status, e.response.statusText);
  }
}

test();
