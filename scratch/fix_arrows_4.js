const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'code_artifact.html');
let s = fs.readFileSync(file, 'utf8');

// 1. Fix arrow density
if (s.includes('useMat.map.repeat.set(1, len * 1.5)')) {
    s = s.replace('useMat.map.repeat.set(1, len * 1.5)', 'useMat.map.repeat.set(1, len * 0.6)');
    console.log('✅ Arrow density fixed');
} else {
    console.error('❌ Arrow density string not found');
}

// 2. Fix CWS pipe crossing headers
let cwsOld = `                // 1. CWS 穿牆進入管架
                drawOrthogonalPipe([
                    [1.5, 1.0, -13.0], [1.5, 3.8, -13.0], [1.5, 3.8, -9.0]
                ], this.materials.pipeCWS);`;

let cwsNew = `                // 1. CWS 穿牆進入管架 (升至 y=5.0 避開 h1/h2 集管)
                drawOrthogonalPipe([
                    [1.5, 1.0, -13.0], [1.5, 5.0, -13.0], [1.5, 5.0, -9.0], [1.5, 3.8, -9.0]
                ], this.materials.pipeCWS);`;

if (s.includes(cwsOld)) {
    s = s.replace(cwsOld, cwsNew);
    console.log('✅ CWS pipe routing fixed');
} else {
    console.error('❌ CWS routing string not found');
}

// 3. Fix CWR pipe crossing headers
let cwrOld = `                // 4. 匯流後穿牆出室外
                drawOrthogonalPipe([
                    [2.0, 4.7, -8.0], [2.0, 4.7, -11.5], [2.0, 1.0, -11.5], [2.0, 1.0, -13.0]
                ], this.materials.pipeCWR);`;

let cwrNew = `                // 4. 匯流後穿牆出室外 (升至 y=5.0 避開 h1/h2 集管)
                drawOrthogonalPipe([
                    [2.0, 4.7, -8.0], [2.0, 5.0, -8.0], [2.0, 5.0, -11.5], [2.0, 1.0, -11.5], [2.0, 1.0, -13.0]
                ], this.materials.pipeCWR);`;

if (s.includes(cwrOld)) {
    s = s.replace(cwrOld, cwrNew);
    console.log('✅ CWR pipe routing fixed');
} else {
    console.error('❌ CWR routing string not found');
}

fs.writeFileSync(file, s, 'utf8');
console.log('✅ DONE!');
