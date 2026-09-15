const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Target string to remove
const targetStr = `                            if (!mesh.instanceColor) {
                                const colors = new Float32Array(mesh.count * 3);
                                colors.fill(1.0); // default white
                                mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
                            }`;

if (content.includes(targetStr.replace(/\n/g, '\r\n'))) {
    content = content.replace(targetStr.replace(/\n/g, '\r\n'), '');
    console.log("Removed manual instanceColor (CRLF) successfully.");
} else if (content.includes(targetStr)) {
    content = content.replace(targetStr, '');
    console.log("Removed manual instanceColor (LF) successfully.");
} else {
    // Try regex
    console.error("Exact instanceColor target not found, trying regex...");
    const regex = /if\s*\(!mesh\.instanceColor\)\s*\{[\s\S]*?mesh\.instanceColor\s*=\s*new\s*THREE\.InstancedBufferAttribute\([\s\S]*?\);\s*\}/;
    if (regex.test(content)) {
        content = content.replace(regex, '');
        console.log("Removed manual instanceColor via regex successfully.");
    } else {
        console.error("Regex target not found either.");
        process.exit(1);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
