const fs = require('fs');

const content = fs.readFileSync('public/whitespace/app.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.includes('createRack(') && !line.includes('createRack(x, y, z')) {
        console.log(`Line ${i + 1}: ${line.trim()}`);
    }
});
