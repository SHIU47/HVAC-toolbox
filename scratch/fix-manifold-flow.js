const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Target string
const targetStr = `                    const spineSupply = new THREE.Mesh(spineGeo, pipeBlueM);
                    spineSupply.position.set(-0.13, 0, trayD / 2 + 0.07);
                    rackPipingGroup.add(spineSupply);`;

// Replacement string
const replacementStr = `                    const spineSupply = new THREE.Mesh(spineGeo, pipeBlueM);
                    spineSupply.position.set(-0.13, 0, trayD / 2 + 0.07);
                    spineSupply.rotation.z = Math.PI; // Flip flow direction to be top-to-bottom (inlet)
                    rackPipingGroup.add(spineSupply);`;

if (content.includes(targetStr.replace(/\n/g, '\r\n'))) {
    content = content.replace(targetStr.replace(/\n/g, '\r\n'), replacementStr.replace(/\n/g, '\r\n'));
    console.log("Flipped spineSupply rotation (CRLF) successfully.");
} else if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Flipped spineSupply rotation (LF) successfully.");
} else {
    console.error("Could not find spineSupply definition block.");
    process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
