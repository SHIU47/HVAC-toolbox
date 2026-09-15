const fs = require('fs');

const content = fs.readFileSync('scratch/cleaned_original_app.js', 'utf8');
const lines = content.split('\n');

const createRackStart = lines.findIndex(l => l.includes('createRack(x, y, z, rot, name)'));
const buildPipingStart = lines.findIndex(l => l.includes('buildPiping()'));

console.log(`createRack start: ${createRackStart}`);
console.log(`buildPiping start: ${buildPipingStart}`);

if (createRackStart !== -1 && buildPipingStart !== -1) {
    const createRackLines = lines.slice(createRackStart, buildPipingStart);
    fs.writeFileSync('scratch/original_create_rack.js', createRackLines.join('\n'), 'utf8');
    console.log("Saved original createRack to scratch/original_create_rack.js");
}
