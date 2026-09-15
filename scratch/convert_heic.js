const fs = require('fs').promises;
const path = require('path');
const convert = require('heic-convert');

const srcDir = 'C:\\Users\\user\\OneDrive\\桌面\\computex';

async function main() {
    try {
        const files = await fs.readdir(srcDir);
        const heicFiles = files.filter(f => f.toLowerCase().endsWith('.heic'));
        console.log(`Found ${heicFiles.length} HEIC files to convert.`);
        
        for (const file of heicFiles) {
            const inputPath = path.join(srcDir, file);
            const outputPath = path.join(srcDir, file.substring(0, file.length - 5) + '.jpg');
            
            // Check if already exists
            try {
                await fs.access(outputPath);
                console.log(`Skipping ${file} - JPG already exists.`);
                continue;
            } catch (e) {
                // File does not exist, proceed to convert
            }
            
            console.log(`Converting ${file}...`);
            const inputBuffer = await fs.readFile(inputPath);
            const outputBuffer = await convert({
                buffer: inputBuffer,
                format: 'JPEG',
                quality: 0.85
            });
            await fs.writeFile(outputPath, outputBuffer);
            console.log(`Saved ${path.basename(outputPath)}`);
        }
        console.log('Conversion complete!');
    } catch (err) {
        console.error('Error during conversion:', err);
    }
}

main();
