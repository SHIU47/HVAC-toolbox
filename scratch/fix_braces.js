const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../public/whitespace/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

const targetContent = `                    let explodeDist = 0;
                        if (side === -1 && x > 1.2) explodeDist = -0.6;  
                    }`;

const replacementContent = `                    let explodeDist = 0;
                    if (rot === 0) { 
                        if (side === -1 && x < -1.2) explodeDist = -0.6; 
                        if (side === 1 && x > 1.2) explodeDist = 0.6;   
                    } else { 
                        if (side === 1 && x < -1.2) explodeDist = 0.6;   
                        if (side === -1 && x > 1.2) explodeDist = -0.6;  
                    }`;

if (content.includes(targetContent)) {
    content = content.replace(targetContent, replacementContent);
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log("Successfully fixed braces in app.js!");
} else {
    // Let's do a more robust find/replace if spacing is slightly different
    console.error("Target content not found exactly. Trying regex...");
    const regex = /let explodeDist = 0;\s+if \(side === -1 && x > 1\.2\) explodeDist = -0\.6;\s+}/;
    if (regex.test(content)) {
        content = content.replace(regex, replacementContent);
        fs.writeFileSync(appJsPath, content, 'utf8');
        console.log("Successfully fixed braces using regex!");
    } else {
        console.error("Braces fix failed.");
    }
}
