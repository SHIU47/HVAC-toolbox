const fs = require('fs');

const originalContent = fs.readFileSync('scratch/original_app.js', 'utf8');

// The file might contain line numbers prefixed like "123: text" because it was viewed. Let's clean it up first.
const lines = originalContent.split('\n');
const cleanedLines = lines.map(line => {
    const match = line.match(/^\d+:\s?(.*)$/);
    return match ? match[1] : line;
});

const cleanedContent = cleanedLines.join('\n');
fs.writeFileSync('scratch/cleaned_original_app.js', cleanedContent, 'utf8');

// Now let's extract the createRack function
const createRackStart = cleanedContent.indexOf('createRack(x, y, z, rot, name)');
if (createRackStart === -1) {
    console.log("Could not find createRack(x, y, z, rot, name)");
} else {
    // Find the matching closing bracket or a reasonable chunk of lines
    // Let's print 300 lines starting from createRackStart
    const sub = cleanedContent.substring(createRackStart);
    const subLines = sub.split('\n');
    console.log(subLines.slice(0, 300).join('\n'));
}
