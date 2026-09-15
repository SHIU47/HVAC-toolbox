const fs = require('fs');

const targetLines = fs.readFileSync('scratch/step_178_target.txt', 'utf8').split('\n');
const replacementLines = fs.readFileSync('scratch/step_178_replacement.txt', 'utf8').split('\n');

console.log(`Target: ${targetLines.length} lines`);
console.log("--- First 10 lines of Target ---");
console.log(targetLines.slice(0, 10).join('\n'));
console.log("--- Last 10 lines of Target ---");
console.log(targetLines.slice(-10).join('\n'));

console.log(`\nReplacement: ${replacementLines.length} lines`);
console.log("--- First 10 lines of Replacement ---");
console.log(replacementLines.slice(0, 10).join('\n'));
console.log("--- Last 10 lines of Replacement ---");
console.log(replacementLines.slice(-10).join('\n'));
