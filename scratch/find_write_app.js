const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\.system_generated\\logs\\transcript.jsonl';

async function checkWrites() {
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
                if (call.name === 'write_to_file' && call.args?.TargetFile?.includes('app.js')) {
                    console.log(`Step ${obj.step_index}: write_to_file of ${call.args.TargetFile}`);
                    fs.writeFileSync(`scratch/step_${obj.step_index}_write_app.js`, call.args.CodeContent, 'utf8');
                    console.log(`Saved scratch/step_${obj.step_index}_write_app.js`);
                }
            }
        }
    }
}

checkWrites().catch(err => console.error(err));
