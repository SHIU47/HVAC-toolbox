const fs = require('fs');

const content = fs.readFileSync('public/whitespace/whitespace.html', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.includes('btn') || line.includes('id="btn') || line.includes('class="btn')) {
        console.log(`Line ${i + 1}: ${line.trim()}`);
    }
});
