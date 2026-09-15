const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Target string
const targetStr = `                 const instData = {
                     trayBody: [], pcb: [], handle: [],
                     gpuPlate: [], cpuPlate: [], switchPlate: [],
                     plateCover: [], fittings: [],
                     qdcMale: [], qdcFemale: [],
                     osfpPort: [], psuModule: [], statusLed: [], ledStrip: [],
                     blankPanel: [], coldTube: [], coldTubeBlue: [], coldTubeRed: [],
                     psuFanGrill: [], psuHandle: [],
                     memModule: [], vrm: [],
                 };`;

// Replacement string
const replacementStr = `                 const instData = {
                     trayBody: [], pcb: [], handle: [],
                     gpuPlate: [], cpuPlate: [], switchPlate: [],
                     plateCover: [], fittings: [],
                     qdcMale: [], qdcFemale: [],
                     osfpPort: [], psuModule: [], statusLed: [], ledStrip: [],
                     blankPanel: [], coldTube: [], coldTubeBlue: [], coldTubeRed: [],
                     hoseCollarBlue: [], hoseCollarRed: [],
                     psuFanGrill: [], psuHandle: [],
                     memModule: [], vrm: [],
                 };`;

// Try CRLF
if (content.includes(targetStr.replace(/\n/g, '\r\n'))) {
    content = content.replace(targetStr.replace(/\n/g, '\r\n'), replacementStr.replace(/\n/g, '\r\n'));
    console.log("Replaced CRLF instData successfully.");
} else if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Replaced LF instData successfully.");
} else {
    console.error("Exact instData target not found, trying regex...");
    const regex = /const\s+instData\s*=\s*\{[\s\S]*?blankPanel:[\s\S]*?coldTubeRed:\s*\[\s*\],([\s\S]*?psuFanGrill:\s*\[\s*\],)/;
    if (regex.test(content)) {
        content = content.replace(regex, (match, p1) => {
            return match.replace(p1, `\n                     hoseCollarBlue: [], hoseCollarRed: [],\n                     psuFanGrill: [],`);
        });
        console.log("Replaced via regex successfully.");
    } else {
        console.error("Regex target not found either.");
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
