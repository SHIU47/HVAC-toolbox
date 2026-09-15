const fs = require('fs');

const content = fs.readFileSync('scratch/cleaned_original_app.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    if (line.match(/^\s{12}[a-zA-Z0-9_]+\(/)) {
        console.log(`Line ${i}: ${line.trim()}`);
    }
});
