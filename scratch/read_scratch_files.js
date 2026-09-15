const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\user\\OneDrive\\桌面\\HVAC-Pro\\scratch';
const files = fs.readdirSync(scratchDir);

for (const file of files) {
    const filePath = path.join(scratchDir, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile() && file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('createRack')) {
            console.log(`Match in ${file}: size = ${stats.size} bytes`);
        }
    }
}
