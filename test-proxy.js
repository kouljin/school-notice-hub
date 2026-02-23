const axios = require('axios');

async function test() {
    try {
        const fileUrl = encodeURIComponent("https://school.gyo6.net/upload/cheongdoms/na/bbs_39256/ntt_16611242/doc_8ba2c00c-3e52-46fb-a0cc-4254bcfb7db81756a6930b87415.hwp");
        const filename = encodeURIComponent("요강 및 서류 안내.hwp");
        
        const proxyUrl = `http://localhost:3000/api/download?url=${fileUrl}&filename=${filename}`;
        console.log("Fetching:", proxyUrl);
        const res = await axios.get(proxyUrl, { responseType: 'arraybuffer' });
        console.log("Headers:", res.headers);
        console.log("Status:", res.status);
    } catch(e) {
        console.error("Error:", e.message);
        if(e.response) console.error(e.response.status, e.response.statusText);
    }
}
test();
