const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\.system_generated\\logs\\transcript.jsonl';

async function searchLog() {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let stepNum = 0;
    for await (const line of rl) {
        stepNum++;
        const obj = JSON.parse(line);
        if (obj.step_index === 178 || obj.step_index === 179) {
            console.log(`=== Step ${obj.step_index} ===`);
            console.log(JSON.stringify(obj, null, 2));
        }
    }
}

searchLog().catch(err => console.error(err));
