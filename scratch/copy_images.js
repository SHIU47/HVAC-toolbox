const fs = require('fs').promises;
const path = require('path');

const srcDir = 'C:\\Users\\user\\OneDrive\\桌面\\computex';
const destDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\computex_ref';

async function main() {
    try {
        await fs.mkdir(destDir, { recursive: true });
        const files = await fs.readdir(srcDir);
        const jpgFiles = files.filter(f => f.toLowerCase().endsWith('.jpg'));
        for (const file of jpgFiles) {
            const src = path.join(srcDir, file);
            const dest = path.join(destDir, file);
            await fs.copyFile(src, dest);
            console.log(`Copied ${file} to artifacts`);
        }
        console.log('Copy complete!');
    } catch (e) {
        console.error(e);
    }
}
main();
