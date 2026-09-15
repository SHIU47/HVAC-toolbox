const fs = require('fs');

const content = fs.readFileSync('public/whitespace/app.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.includes('cfd') || line.includes('CFD') || line.includes('toggle_pipes') || line.includes('animateFlow')) {
        console.log(`Line ${i + 1}: ${line.trim()}`);
    }
});
