const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Target string
const targetStr = `            toggleCFD() {
                this.cfdMode = !this.cfdMode;`;

// Replacement string
const replacementStr = `            toggleCFD() {
                try {
                    this.cfdMode = !this.cfdMode;`;

if (content.includes(targetStr.replace(/\n/g, '\r\n'))) {
    content = content.replace(targetStr.replace(/\n/g, '\r\n'), replacementStr.replace(/\n/g, '\r\n'));
} else if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
} else {
    console.error("Could not find start of toggleCFD");
    process.exit(1);
}

// Find the end of toggleCFD. It is before "createCfdParticles() {"
const endTargetStr = `                }
            },

            createCfdParticles() {`;

const endReplacementStr = `                }
                } catch (e) {
                    console.error("Error in toggleCFD:", e);
                    if (window.onerror) {
                        window.onerror(e.message, "app.js", 3058, 1, e);
                    }
                }
            },

            createCfdParticles() {`;

if (content.includes(endTargetStr.replace(/\n/g, '\r\n'))) {
    content = content.replace(endTargetStr.replace(/\n/g, '\r\n'), endReplacementStr.replace(/\n/g, '\r\n'));
    console.log("Wrapped toggleCFD with try-catch (CRLF).");
} else if (content.includes(endTargetStr)) {
    content = content.replace(endTargetStr, endReplacementStr);
    console.log("Wrapped toggleCFD with try-catch (LF).");
} else {
    console.error("Could not find end of toggleCFD");
    process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
