const axios = require('axios');
async function test() {
    const listRes = await axios.get("http://localhost:3000/api/notices?schoolId=cheongdoms&boardId=notice&page=1&search=");
    const notices = listRes.data.notices;
    
    // Find first notice with an attachment
    let target = null;
    for(const n of notices) {
        if(n.title.includes('붙임') || n.title.includes('첨부') || n.title.includes('안내') || n.title.includes('계획')) {
           target = n;
           try {
             console.log("Checking:", n.title);
             const detailRes = await axios.post("http://localhost:3000/api/notice-detail", n.linkParams);
             if(detailRes.data.attachments && detailRes.data.attachments.length > 0) {
                 console.log("Found attachments!", detailRes.data.attachments);
                 const file = detailRes.data.attachments[0];
                 const dlUrl = `http://localhost:3000/api/download?url=${encodeURIComponent(file.href)}&filename=${encodeURIComponent(file.name)}`;
                 console.log("Trying local download proxy:", dlUrl);
                 const dlRes = await axios.get(dlUrl, { responseType: 'arraybuffer', validateStatus: () => true });
                 console.log("DL Status:", dlRes.status, dlRes.headers['content-type'], dlRes.data.length, "bytes");
                 break;
             }
           } catch(e) { console.log(e.message); }
        }
    }
}
test();
