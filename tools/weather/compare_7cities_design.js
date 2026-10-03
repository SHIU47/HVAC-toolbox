const fs = require('fs');
const path = require('path');
const fn = new Function('window', fs.readFileSync(path.resolve(__dirname, '../../public/Data center Cal/js/weather_builtin.js'), 'utf8'));
const fakeWindow = {};
fn(fakeWindow);
const data = fakeWindow.BUILTIN_WEATHER_DATA;

console.log('| 城市 | 舊 TMY 0.4% DB | 新 ASHRAE 0.4% DB | 舊 TMY 0.4% WB | 新 ASHRAE 0.4% WB | peakDb (n=20) | freezeDb (n=50) |');
console.log('|---|---|---|---|---|---|---|');

for (const [name, c] of Object.entries(data)) {
    const dbSorted = c.hourlyData.map(h => h.db).sort((a,b) => b-a);
    const wbSorted = c.hourlyData.map(h => h.wb).sort((a,b) => b-a);
    const oldDb = dbSorted[34];
    const oldWb = wbSorted[34];
    const dc = c.designConditions;
    const newDb = dc?.cooling?.db004 ?? oldDb;
    const newWb = dc?.cooling?.evapWb004 ?? oldWb;
    const peak = dc?.extremes?.dbMax?.[20] ?? (dbSorted[0] + 2.0);
    const freeze = dc?.extremes?.dbMin?.[50] ?? 'N/A';
    console.log(`| ${name} | ${oldDb}°C | ${newDb}°C | ${oldWb}°C | ${newWb}°C | ${peak}°C | ${freeze}°C |`);
}
