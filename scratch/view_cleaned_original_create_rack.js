const fs = require('fs');

const content = fs.readFileSync('scratch/cleaned_original_app.js', 'utf8');
const lines = content.split('\n');

const createRackStart = lines.findIndex(l => l.includes('createRack(x, y, z, rot, name)'));
console.log("createRack start index:", createRackStart);

if (createRackStart !== -1) {
    // Print 150 lines from createRackStart
    for (let i = createRackStart; i < createRackStart + 150; i++) {
        console.log(`${i}: ${lines[i]}`);
    }
}
