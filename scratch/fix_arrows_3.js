const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'code_artifact.html');
let s = fs.readFileSync(file, 'utf8');

// Fix animate offset
let animateStr = `if(mat.map) mat.map.offset.x = -time * 0.5;`;
if (s.includes(animateStr)) {
    s = s.replace(animateStr, `if(mat.map) mat.map.offset.y = -time * 0.5;`);
    console.log('✅ animate updated offset.y');
} else {
    // maybe it has different spacing
    let animateRegex = /if\s*\(mat\.map\)\s*mat\.map\.offset\.x\s*=\s*-time\s*\*\s*0\.5;/;
    if (animateRegex.test(s)) {
        s = s.replace(animateRegex, `if(mat.map) mat.map.offset.y = -time * 0.5;`);
        console.log('✅ animate updated offset.y (Regex)');
    } else {
        console.error('❌ animate offset not found');
    }
}

fs.writeFileSync(file, s, 'utf8');
console.log('✅ DONE!');
