const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\.system_generated\\logs\\transcript.jsonl';

async function writeContents() {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        const obj = JSON.parse(line);
        if (obj.step_index === 179 || obj.step_index === 254) {
            fs.writeFileSync(`scratch/step_${obj.step_index}_content.txt`, obj.content || '', 'utf8');
            console.log(`Wrote scratch/step_${obj.step_index}_content.txt`);
        }
    }
}

writeContents().catch(err => console.error(err));
