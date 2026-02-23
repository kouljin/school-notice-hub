const axios = require('axios');
const fs = require('fs');

async function test() {
    const fileUrl = "https://school.gyo6.net/upload/cheongdoms/na/bbs_39256/ntt_16611242/doc_8ba2c00c-3e52-46fb-a0cc-4254bcfb7db81756a6930b87415.hwp";
    const filename = "test.hwp";
    
    // Direct
    const directRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync('direct.hwp', directRes.data);
    
    // Proxy
    const proxyUrl = `http://localhost:3000/api/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;
    const proxyRes = await axios.get(proxyUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync('proxy.hwp', proxyRes.data);
    
    console.log("Direct size:", fs.statSync('direct.hwp').size);
    console.log("Proxy size:", fs.statSync('proxy.hwp').size);
    
    const directBuf = fs.readFileSync('direct.hwp');
    const proxyBuf = fs.readFileSync('proxy.hwp');
    console.log("Are they equal?", directBuf.equals(proxyBuf));
}
test();
