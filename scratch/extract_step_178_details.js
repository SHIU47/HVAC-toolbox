const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/step_178_args.json', 'utf8'));

function unescapeStr(str) {
    return str.replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
}

fs.writeFileSync('scratch/step_178_target.txt', unescapeStr(data.TargetContent), 'utf8');
fs.writeFileSync('scratch/step_178_replacement.txt', unescapeStr(data.ReplacementContent), 'utf8');

console.log("Step 178 target and replacement unescaped successfully!");
