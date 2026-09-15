const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\.system_generated\\logs\\transcript.jsonl';

async function checkEdits() {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let stepNum = 0;
    for await (const line of rl) {
        stepNum++;
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
            for (const call of obj.tool_calls) {
                if ((call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') && call.args?.TargetFile?.includes('app.js')) {
                    console.log(`Step ${obj.step_index}: ${call.name} description: ${call.args.Description || call.args.Instruction}`);
                }
            }
        }
    }
}

checkEdits().catch(err => console.error(err));
