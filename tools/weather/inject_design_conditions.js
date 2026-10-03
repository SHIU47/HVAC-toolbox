'use strict';

const fs = require('fs');
const path = require('path');
const { parseEpwDesignConditions } = require('../../public/Data center Cal/js/ashrae_design_conditions.js');

const builtinPath = path.resolve(__dirname, '../../public/Data center Cal/js/weather_builtin.js');
let builtinContent = fs.readFileSync(builtinPath, 'utf8');

const epwDir = path.resolve(__dirname, '../../public/Data center Cal/weather/ZIP檔');

function findEPWs(dir) {
    let res = [];
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) res = res.concat(findEPWs(p));
        else if (f.toLowerCase().endsWith('.epw')) res.push(p);
    }
    return res;
}

const epwFiles = findEPWs(epwDir);
console.log(`Found ${epwFiles.length} EPW files in ${epwDir}`);

// Build map from location -> designConditions
const locationToDc = {};
for (const file of epwFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    if (!lines[0].startsWith('LOCATION')) continue;
    const locCols = lines[0].split(',');
    const location = (locCols[1] || '').trim();
    const line2 = lines.find(l => l.startsWith('DESIGN CONDITIONS')) || lines[1];
    const dc = parseEpwDesignConditions(line2);
    locationToDc[location] = { file: path.basename(file), dc };
}

// Read current builtin data keys and stationInfo
const fn = new Function('window', builtinContent);
const fakeWindow = {};
fn(fakeWindow);
const data = fakeWindow.BUILTIN_WEATHER_DATA;

const oldSize = Buffer.byteLength(builtinContent, 'utf8');
let injectedCount = 0;

for (const [cityKey, cityObj] of Object.entries(data)) {
    const loc = cityObj.stationInfo?.location;
    const match = locationToDc[loc];
    if (!match) {
        console.warn(`No EPW match for city "${cityKey}" (location: "${loc}")`);
        continue;
    }
    console.log(`Matching "${cityKey}" -> ${match.file}`);
    console.log(`  cooling:`, match.dc.cooling);
    console.log(`  extremes:`, match.dc.extremes ? 'Present' : 'null');

    // Surgically inject designConditions right after stationInfo
    const stationInfoStr = JSON.stringify(cityObj.stationInfo);
    // Find pattern: "stationInfo":{...},
    // We look for `"stationInfo":` followed by the exact JSON or match
    const target = `"stationInfo":${stationInfoStr},`;
    const replacement = `"stationInfo":${stationInfoStr},"designConditions":${JSON.stringify(match.dc)},`;

    if (!builtinContent.includes(target)) {
        throw new Error(`Target not found in file for city "${cityKey}": ${target}`);
    }
    builtinContent = builtinContent.replace(target, replacement);
    injectedCount++;
}

console.log(`\nInjected designConditions into ${injectedCount} cities.`);
fs.writeFileSync(builtinPath, builtinContent, 'utf8');
const newSize = Buffer.byteLength(builtinContent, 'utf8');
console.log(`Old size: ${oldSize} bytes, New size: ${newSize} bytes (diff: +${(newSize - oldSize)} bytes)`);
