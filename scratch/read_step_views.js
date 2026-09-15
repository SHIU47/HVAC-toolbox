const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\.system_generated\\logs\\transcript.jsonl';

async function checkSteps() {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let stepNum = 0;
    for await (const line of rl) {
        stepNum++;
        const obj = JSON.parse(line);
        if (obj.content && obj.content.includes('sideGroup')) {
            console.log(`Step ${obj.step_index}: type=${obj.type}, len=${obj.content.length}`);
        }
    }
}

checkSteps().catch(err => console.error(err));
