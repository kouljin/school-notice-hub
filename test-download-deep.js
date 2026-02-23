const axios = require('axios');
const fs = require('fs');

async function test() {
    const fileUrl = "https://school.gyo6.net/upload/cheongdoms/na/bbs_39256/ntt_16611242/doc_8ba2c00c-3e52-46fb-a0cc-4254bcfb7db81756a6930b87415.hwp";
    const filename = "test.hwp";
    
    // Direct Download (Known Good)
    console.log("Downloading Direct...");
    const directRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync('direct2.hwp', directRes.data);
    
    // Proxy Download (Suspected Bad)
    console.log("Downloading Proxy...");
    const proxyUrl = `http://localhost:3000/api/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;
    const proxyRes = await axios.get(proxyUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync('proxy2.hwp', proxyRes.data);
    
    console.log("Direct size:", fs.statSync('direct2.hwp').size);
    console.log("Proxy size:", fs.statSync('proxy2.hwp').size);
    
    const directBuf = fs.readFileSync('direct2.hwp');
    const proxyBuf = fs.readFileSync('proxy2.hwp');
    
    console.log("Are they completely identical bytes?", directBuf.equals(proxyBuf));
    
    if (!directBuf.equals(proxyBuf)) {
        // Find first difference
        for (let i = 0; i < Math.min(directBuf.length, proxyBuf.length); i++) {
            if (directBuf[i] !== proxyBuf[i]) {
                console.log(`Difference found at byte ${i}`);
                console.log(`Direct: ${directBuf[i]} | Proxy: ${proxyBuf[i]}`);
                break;
            }
        }
    }
}
test();
