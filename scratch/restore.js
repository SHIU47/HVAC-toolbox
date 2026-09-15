const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../dist/冰水管路計算.html');
const publicPath = path.join(__dirname, '../public/冰水管路計算.html');

// 1. Read dist file
let distHtml = fs.readFileSync(distPath, 'utf8');

// 2. Remove the obfuscated injected security script
// It is the script tag right after <head>
const pattern = /<head>\s*<script>[\s\S]*?<\/script>/i;
distHtml = distHtml.replace(pattern, '<head>');

// 3. Write back to public
fs.writeFileSync(publicPath, distHtml, 'utf8');
console.log("Restored public/冰水管路計算.html from dist!");
