const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\.system_generated\\logs\\transcript.jsonl';

async function listViews() {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let stepNum = 0;
    for await (const line of rl) {
        stepNum++;
        const obj = JSON.parse(line);
        if (obj.type === 'VIEW_FILE') {
            console.log(`Step ${obj.step_index}: path = ${obj.tool_calls?.[0]?.args?.AbsolutePath || obj.AbsolutePath || 'unknown'}, length = ${obj.content?.length || 0}`);
        }
    }
}

listViews().catch(err => console.error(err));
