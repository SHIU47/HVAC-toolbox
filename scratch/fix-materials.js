const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Target string to replace
const targetStr = `                     this.materials.blueHose = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.2, roughness: 0.2 }); // Blue hose for supply
                     this.materials.redHose = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.2, roughness: 0.2 }); // Red hose for return
                     this.materials.brassDetail = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 }); // Brass fittings`;

// Replacement string
const replacementStr = `                     this.materials.blueHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 }); // Black braided hose (dark charcoal gray)
                     this.materials.redHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 }); // Black braided hose (dark charcoal gray)
                     this.materials.blueCollar = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.8, roughness: 0.2 }); // Blue collar (supply)
                     this.materials.redCollar = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 }); // Red collar (return)
                     this.materials.brassDetail = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 }); // Brass fittings`;

// Try CRLF first
if (content.includes(targetStr.replace(/\n/g, '\r\n'))) {
    content = content.replace(targetStr.replace(/\n/g, '\r\n'), replacementStr.replace(/\n/g, '\r\n'));
    console.log("Replaced CRLF target successfully.");
} else if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Replaced LF target successfully.");
} else {
    // If not matching, let's do a more robust regex replace
    console.error("Exact target not found, trying regex...");
    const regex = /this\.materials\.blueHose\s*=\s*new\s*THREE\.MeshStandardMaterial\([\s\S]*?this\.materials\.brassDetail\s*=\s*new\s*THREE\.MeshStandardMaterial\(\{[\s\S]*?\}\);\s*\/\/\s*Brass\s*fittings/;
    if (regex.test(content)) {
        content = content.replace(regex, `this.materials.blueHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 }); // Black braided hose (dark charcoal gray)
                     this.materials.redHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 }); // Black braided hose (dark charcoal gray)
                     this.materials.blueCollar = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.8, roughness: 0.2 }); // Blue collar (supply)
                     this.materials.redCollar = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 }); // Red collar (return)
                     this.materials.brassDetail = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 }); // Brass fittings`);
        console.log("Replaced via regex successfully.");
    } else {
        console.error("Regex target not found either.");
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
