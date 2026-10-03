const fs = require('fs');
const { execSync } = require('child_process');

const oldJs = execSync('git show "HEAD:public/天氣資料/weather_data.js"', { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' });
const newJs = fs.readFileSync('public/天氣資料/weather_data.js', 'utf8');

const oldStations = JSON.parse(oldJs.match(/window\.BUILTIN_WEATHER_STATIONS\s*=\s*(\[[\s\S]*?\]);/)[1]);
const newStations = JSON.parse(newJs.match(/window\.BUILTIN_WEATHER_STATIONS\s*=\s*(\[[\s\S]*?\]);/)[1]);

console.log('Old stations count:', oldStations.length);
console.log('New stations count:', newStations.length);

const oldSize = Buffer.byteLength(oldJs, 'utf8');
const newSize = Buffer.byteLength(newJs, 'utf8');
const diffKb = (newSize - oldSize) / 1024;
console.log('Old size:', oldSize, 'bytes');
console.log('New size:', newSize, 'bytes');
console.log('Diff:', diffKb.toFixed(2), 'KB');

let hasDcCount = 0;
let fieldDiffs = [];

for (let i = 0; i < newStations.length; i++) {
    const ns = newStations[i];
    const os = oldStations[i];
    if (ns.id !== os.id) {
        fieldDiffs.push({ id: ns.id, error: 'ID mismatch' });
        continue;
    }
    if ('designConditions' in ns) hasDcCount++;

    // Compare all keys except designConditions
    const allKeys = Array.from(new Set([...Object.keys(os), ...Object.keys(ns)]));
    for (const k of allKeys) {
        if (k === 'designConditions') continue;
        if (JSON.stringify(os[k]) !== JSON.stringify(ns[k])) {
            fieldDiffs.push({ id: ns.id, key: k, oldVal: os[k], newVal: ns[k] });
        }
    }
}

console.log('Stations with designConditions:', hasDcCount, '/', newStations.length);
console.log('Other field diffs count:', fieldDiffs.length);
if (fieldDiffs.length > 0) {
    console.log('Field diffs details:', JSON.stringify(fieldDiffs, null, 2));
}
