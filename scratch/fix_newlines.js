const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/step_178_args.json', 'utf8'));
let content = data.ReplacementContent;

// Unescape literal \n, \t, etc.
content = content.replace(/\\n/g, '\n');
content = content.replace(/\\t/g, '\t');
content = content.replace(/\\"/g, '"');
content = content.replace(/\\\\/g, '\\');

fs.writeFileSync('scratch/fixed_replacement.txt', content, 'utf8');
console.log("Unescaped literal slashes written to scratch/fixed_replacement.txt");
