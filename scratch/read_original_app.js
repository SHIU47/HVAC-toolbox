const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\02a0c332-6890-42ce-941c-b88f97ccaf4f\\.system_generated\\logs\\transcript.jsonl';

async function findOriginal() {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let stepNum = 0;
    for await (const line of rl) {
        stepNum++;
        const obj = JSON.parse(line);
        // Find if the file was viewed, or search for "createRack" in content
        if (obj.type === 'VIEW_FILE' && obj.content && obj.content.includes('createRack(')) {
            console.log(`Found VIEW_FILE in step ${obj.step_index}`);
            fs.writeFileSync('scratch/original_app.js', obj.content, 'utf8');
            console.log("Saved content to scratch/original_app.js");
            return;
        }
    }
    console.log("No VIEW_FILE step found with createRack");
}

findOriginal().catch(err => console.error(err));
