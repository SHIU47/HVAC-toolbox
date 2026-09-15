const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'whitespace.html');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = '<script src="./app.js"></script>';
const replacementStr = '<script src="./app.js?v=3"></script>';

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Replaced app.js script tag with cache-buster.");
} else if (content.includes('<script src="./app.js?v=')) {
    // Already has cache buster, let's increment it
    content = content.replace(/<script src="\.\/app\.js\?v=(\d+)"><\/script>/, (match, p1) => {
        const nextVer = parseInt(p1) + 1;
        return `<script src="./app.js?v=${nextVer}"></script>`;
    });
    console.log("Incremented app.js script cache-buster.");
} else {
    console.error("Could not find app.js script tag in whitespace.html");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
