const fs = require('fs');
const path = require('path');

const publicFile = path.join(__dirname, '../public/冰水管路計算.html');
const distFile = path.join(__dirname, '../dist/冰水管路計算.html');

function checkFile(filePath, label) {
    const buffer = fs.readFileSync(filePath);
    console.log(`=== ${label} ===`);
    console.log("Size:", buffer.length, "bytes");
    console.log("First 10 bytes hex:", buffer.slice(0, 10).toString('hex'));
    
    // Check for UTF-8 BOM
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        console.log("Has UTF-8 BOM!");
    } else {
        console.log("No UTF-8 BOM");
    }

    // Try to decode as UTF-8 and find some Chinese character
    const utf8Str = buffer.toString('utf8');
    const hasChineseUtf8 = /[\u4e00-\u9fa5]/.test(utf8Str);
    console.log("Has Chinese characters in UTF-8 decode:", hasChineseUtf8);
    
    // Print lines around "tabEditor" in UTF-8 decode
    const lines = utf8Str.split('\n');
    const idx = lines.findIndex(line => line.includes('tabEditor') || line.includes('製圖') || line.includes('製?'));
    if (idx !== -1) {
        console.log(`Line ${idx + 1} UTF-8:`, lines[idx]);
    } else {
        console.log("Could not find line with tabEditor/製圖");
    }
}

checkFile(publicFile, "public");
checkFile(distFile, "dist");
