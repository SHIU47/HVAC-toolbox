const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/step_178_args.json', 'utf8'));
fs.writeFileSync('scratch/replacement_text.txt', data.ReplacementContent, 'utf8');
console.log("Replacement content written to scratch/replacement_text.txt");
