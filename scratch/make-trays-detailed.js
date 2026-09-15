const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add trayBottom to instData object using regex
const instDataRegex = /(const\s+instData\s*=\s*\{\s*trayBody:\s*\[\s*\],)/;
if (instDataRegex.test(content)) {
    content = content.replace(instDataRegex, '$1 trayBottom: [],');
    console.log("Added trayBottom to instData successfully.");
} else {
    console.error("Could not find instData regex target.");
    process.exit(1);
}

// 2. Add addInstMesh for trayBottom using regex
const addInstMeshRegex = /(addInstMesh\(\s*box1\s*,\s*darkMetal\s*,\s*instData\.trayBody\s*\);)/;
if (addInstMeshRegex.test(content)) {
    content = content.replace(addInstMeshRegex, '$1\n                 addInstMesh(box1, darkMetal, instData.trayBottom);');
    console.log("Added addInstMesh for trayBottom successfully.");
} else {
    console.error("Could not find addInstMesh regex target.");
    process.exit(1);
}

// 3. Replace the switch trays populating block (U4 to U12) using regex
const switchTraysRegex = /\/\/\s*U4\s*to\s*U12[\s\S]*?else\s*if\s*\(\s*u\s*>=\s*3\s*&&\s*u\s*<=\s*11\s*\)\s*\{([\s\S]*?)\}/;
const switchTraysReplacementContent = `                            // Open tray: Thin faceplate at front + bottom support sheet
                            pushInst(instData.trayBody, 0, ty, -trayD / 2 + 0.005, trayW, uHeight * 0.9, 0.01);
                            pushInst(instData.trayBottom, 0, ty - 0.002, 0, trayW * 0.96, 0.004, trayD * 0.98);

                            for (let port = 0; port < 24; port++) {
                                const px = -trayW / 2 + 0.03 + port * (trayW - 0.06)/23;
                                pushInst(instData.osfpPort, px, ty, -trayD / 2 - 0.005, 0.012, uHeight * 0.35, 0.025);
                            }
                            pushInst(instData.ledStrip, 0, ty + uHeight * 0.35, -trayD / 2 - 0.008, trayW * 0.92, 0.003, 0.002);
                            [-0.16, 0.16].forEach(sx => {
                                pushInst(instData.cpuPlate, sx, ty, -0.15, 0.06, 0.012, 0.06);
                                pushInst(instData.cpuPlate, sx, ty, 0.15, 0.06, 0.012, 0.06);
                            });
                            pushInst(instData.coldTube, -0.16, ty + 0.006, 0.0, 0.005, 0.005, 0.3);
                            pushInst(instData.coldTube, 0.16, ty + 0.006, 0.0, 0.005, 0.005, 0.3);`;

if (switchTraysRegex.test(content)) {
    content = content.replace(switchTraysRegex, (match, p1) => {
        return match.replace(p1, switchTraysReplacementContent);
    });
    console.log("Replaced switch trays block successfully.");
} else {
    console.error("Could not find switch trays block regex target.");
    process.exit(1);
}

// 4. Replace the compute trays populating block (U13 to U48) using regex
const computeTraysRegex = /\/\/\s*U13\s*to\s*U48[\s\S]*?else\s*if\s*\(\s*u\s*>=\s*12\s*&&\s*u\s*<=\s*47\s*&&\s*u\s*%\s*2\s*===\s*0\s*\)\s*\{([\s\S]*?pushInst\(\s*instData\.pcb\s*,\s*0\s*,\s*ty\s*\+\s*uHeight\s*\*\s*0\.25\s*,)/;
const computeTraysReplacementContent = `                            // Open tray: Thin faceplate at front + bottom support sheet
                            pushInst(instData.trayBody, 0, ty + uHeight * 0.5, -trayD / 2 + 0.005, trayW, uHeight * 1.8, 0.01);
                            pushInst(instData.trayBottom, 0, ty + 0.002, 0, trayW * 0.96, 0.004, trayD * 0.98);

                            // Pull-out handles on the faceplate
                            pushInst(instData.handle, -trayW / 2 + 0.03, ty + uHeight * 0.5, -trayD / 2 - 0.015, 0.015, uHeight * 0.8, 0.03);
                            pushInst(instData.handle, trayW / 2 - 0.03, ty + uHeight * 0.5, -trayD / 2 - 0.015, 0.015, uHeight * 0.8, 0.03);

                            // Faceplate detailed networking ports (representing high-density networking cables)
                            for (let p = 0; p < 8; p++) {
                                const px = -0.1 + p * 0.025;
                                pushInst(instData.osfpPort, px, ty + uHeight * 0.5, -trayD / 2 - 0.002, 0.015, uHeight * 0.4, 0.01);
                            }
                            // Faceplate status LED (glowing green/amber)
                            pushInst(instData.statusLed, -trayW / 2 + 0.05, ty + uHeight * 0.5, -trayD / 2 - 0.006, 0.006, 0.006, 0.006);

                            pushInst(instData.pcb, 0, ty + uHeight * 0.25, 0, trayW * 0.92, 0.004, trayD * 0.88);`;

if (computeTraysRegex.test(content)) {
    content = content.replace(computeTraysRegex, (match, p1) => {
        return match.replace(p1, computeTraysReplacementContent);
    });
    console.log("Replaced compute trays block successfully.");
} else {
    console.error("Could not find compute trays block regex target.");
    process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
