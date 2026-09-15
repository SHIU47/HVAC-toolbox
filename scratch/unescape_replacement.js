const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/step_178_args.json', 'utf8'));
const content = data.ReplacementContent;
fs.writeFileSync('scratch/unescaped_replacement.txt', content, 'utf8');
console.log("Unescaped content written to scratch/unescaped_replacement.txt");
