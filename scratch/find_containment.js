const fs = require('fs');

const content = fs.readFileSync('public/whitespace/app.js', 'utf8');
const lines = content.split('\n');

const start = lines.findIndex(l => l.includes('buildHotAisleContainment(') && l.includes('{'));
console.log("buildHotAisleContainment start:", start);

if (start !== -1) {
    for (let i = start; i < start + 80; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
