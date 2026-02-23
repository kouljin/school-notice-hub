const axios = require('axios');
async function test() {
    const listRes = await axios.get("http://localhost:3000/api/notices?schoolId=mogyehs&boardId=family_letter&page=1&search=");
    const notices = listRes.data.notices;
    
    // Find first notice with an attachment
    for(const n of notices) {
           console.log("Checking:", n.title);
           try {
             const detailRes = await axios.post("http://localhost:3000/api/notice-detail", n.linkParams);
             if(detailRes.data.attachments && detailRes.data.attachments.length > 0) {
                 console.log("Found attachments!", detailRes.data.attachments);
                 const file = detailRes.data.attachments[0];
                 const dlUrl = `http://localhost:3000/api/download?url=${encodeURIComponent(file.href)}&filename=${encodeURIComponent(file.name)}`;
                 console.log("Trying local download proxy:", dlUrl);
                 const dlRes = await axios.get(dlUrl, { responseType: 'arraybuffer', validateStatus: () => true });
                 console.log("DL Status:", dlRes.status, dlRes.headers['content-type'], dlRes.data.length, "bytes");
                 
                 // Let's actually check the first 100 bytes of the file, it might be HTML!
                 const content = Buffer.from(dlRes.data).toString('utf-8').substring(0, 100);
                 console.log("Content start:", content);
                 break;
             }
           } catch(e) { console.log(e.message); }
    }
}
test();
