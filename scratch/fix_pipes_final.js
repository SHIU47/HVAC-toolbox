const fs = require('fs');

// ============================================================
// EQUIPMENT WORLD POSITIONS (verified from deobfuscated code)
// ============================================================
// CH-01 at (-4, 0, 1):  evap nozzles x=-2.75, cond nozzles x=-2.75
// CH-02 at ( 4, 0, 1):  evap nozzles x= 5.25, cond nozzles x= 5.25
//
// Evap nozzles (local x=1.25, y=0.58, z=±0.15/0.45 from group center):
//   CHWS in  (z=+0.45 from group): CH-01 = (-2.75, 0.58, 1.45), CH-02 = (5.25, 0.58, 1.45)
//   CHWR out (z=+0.15 from group): CH-01 = (-2.75, 0.58, 1.15), CH-02 = (5.25, 0.58, 1.15)
// Cond nozzles (local x=1.25, y=0.54, z=−0.45/−0.15 from group center):
//   CWR in   (z=−0.45 from group): CH-01 = (-2.75, 0.54, 0.55), CH-02 = (5.25, 0.54, 0.55)
//   CWS out  (z=−0.15 from group): CH-01 = (-2.75, 0.54, 0.85), CH-02 = (5.25, 0.54, 0.85)
//
// CHWPs at x=-6.5,-5,-3.5, z=-7:
//   Suction front (local z=+0.812): world z = -7+0.812 = -6.188
//   Discharge top  (local y=0.85, z=+0.3): world y=0.85, z=-7+0.3=-6.7
//
// CWPs at x=1.5,3,4.5, z=-7:  same geometry
//
// CT-01 at (-3.5, 8, -17.5): hot-in valve at (-1.5, 10.6, -17.5), cold-out at (-1.5, 8.4, -17.5)
// CT-02 at (  1,  8, -17.5): hot-in valve at (  3,  10.6, -17.5), cold-out at (3, 8.4, -17.5)
//
// PHX at (7.5, 0, -9): CHWS/CHWR nozzles at x=7.3, y=1.12/0.44, z=-8.26
//                       CWS/CWR  nozzles at x=7.7, y=1.12/0.44, z=-8.26
// ============================================================

// HEADER PLANES (distinct heights + distinct Z to avoid ALL collisions)
// CHWS: Y=3.2, Z=-11.0   (matches the existing big horizontal cylinder)
// CHWR: Y=5.6, Z=-11.0   (matches the existing big horizontal cylinder)
// CWS:  Y=4.6, Z= -9.0   (separate Z plane, between CHWS and CHWR height)
// CWR:  Y=5.1, Z= -8.5   (separate Z plane, between CWS and CHWR height)

const newPipeBlock = `
    // ================================================================
    // CORRECTED PIPING NETWORK — no collisions, exact nozzle alignment
    // ================================================================
    const _hyCHWS = 3.2,  _hzCHWS = -11.0;
    const _hyCHWR = 5.6,  _hzCHWR = -11.0;
    const _hyCWS  = 4.6,  _hzCWS  = -9.0;
    const _hyCWR  = 5.1,  _hzCWR  = -8.5;

    // --- CH-01 nozzle branches (x = -2.75) ---
    _0xf475aa([[-2.75, 0.58, 1.45], [-2.75, _hyCHWS, 1.45], [-2.75, _hyCHWS, _hzCHWS]], this.materials.pipeCHWS);
    _0xf475aa([[-2.75, 0.58, 1.15], [-2.75, _hyCHWR, 1.15], [-2.75, _hyCHWR, _hzCHWR]], this.materials.pipeCHWR);
    _0xf475aa([[-2.75, 0.54, 0.55], [-2.75, _hyCWR,  0.55], [-2.75, _hyCWR,  _hzCWR ]], this.materials.pipeCWR);
    _0xf475aa([[-2.75, 0.54, 0.85], [-2.75, _hyCWS,  0.85], [-2.75, _hyCWS,  _hzCWS ]], this.materials.pipeCWS);

    // --- CH-02 nozzle branches (x = 5.25) ---
    _0xf475aa([[5.25, 0.58, 1.45], [5.25, _hyCHWS, 1.45], [5.25, _hyCHWS, _hzCHWS]], this.materials.pipeCHWS);
    _0xf475aa([[5.25, 0.58, 1.15], [5.25, _hyCHWR, 1.15], [5.25, _hyCHWR, _hzCHWR]], this.materials.pipeCHWR);
    _0xf475aa([[5.25, 0.54, 0.55], [5.25, _hyCWR,  0.55], [5.25, _hyCWR,  _hzCWR ]], this.materials.pipeCWR);
    _0xf475aa([[5.25, 0.54, 0.85], [5.25, _hyCWS,  0.85], [5.25, _hyCWS,  _hzCWS ]], this.materials.pipeCWS);

    // --- Main E-W headers ---
    _0xf475aa([[-7.0, _hyCHWS, _hzCHWS], [7.3, _hyCHWS, _hzCHWS]], this.materials.pipeCHWS);
    _0xf475aa([[-7.0, _hyCHWR, _hzCHWR], [7.3, _hyCHWR, _hzCHWR]], this.materials.pipeCHWR);
    _0xf475aa([[-1.5, _hyCWS,  _hzCWS ], [7.7, _hyCWS,  _hzCWS ]], this.materials.pipeCWS);
    _0xf475aa([[-1.5, _hyCWR,  _hzCWR ], [7.7, _hyCWR,  _hzCWR ]], this.materials.pipeCWR);

    // --- CHWPs (x = -6.5, -5, -3.5 ; z = -7) ---
    // Suction: CHWR header → drop → forward to pump front at z=-6.19
    // Discharge: pump top (y=0.85, z=-6.7) → rise → CHWS header
    [-6.5, -5, -3.5].forEach(function(_px) {
      _0xf475aa([[_px, _hyCHWR, _hzCHWR], [_px, _hyCHWR, -7.6], [_px, 0.32, -7.6], [_px, 0.32, -6.19]], this.materials.pipeCHWR);
      _0xf475aa([[_px, 0.85, -6.7], [_px, _hyCHWS, -6.7], [_px, _hyCHWS, _hzCHWS]], this.materials.pipeCHWS);
    }.bind(this));

    // --- CWPs (x = 1.5, 3, 4.5 ; z = -7) ---
    // Suction: CWS header → drop → forward to pump front
    // Discharge: pump top → rise → CWR header
    [1.5, 3, 4.5].forEach(function(_px) {
      _0xf475aa([[_px, _hyCWS, _hzCWS], [_px, _hyCWS, -7.6], [_px, 0.32, -7.6], [_px, 0.32, -6.19]], this.materials.pipeCWS);
      _0xf475aa([[_px, 0.85, -6.7], [_px, _hyCWR, -6.7], [_px, _hyCWR, _hzCWR]], this.materials.pipeCWR);
    }.bind(this));

    // --- CT-01 (riser at x = -1.5) ---
    // CWR hot supply → long horizontal run → rise to CT hot inlet
    _0xf475aa([[-1.5, _hyCWR, _hzCWR], [-1.5, _hyCWR, -17.5], [-1.5, 10.6, -17.5]], this.materials.pipeCWR);
    // CWS cold return ← drop from CT cold outlet ← long horizontal run back
    _0xf475aa([[-1.5, 8.4, -17.5], [-1.5, _hyCWS, -17.5], [-1.5, _hyCWS, _hzCWS]], this.materials.pipeCWS);

    // --- CT-02 (riser at x = 3.0) ---
    _0xf475aa([[3, _hyCWR, _hzCWR], [3, _hyCWR, -17.5], [3, 10.6, -17.5]], this.materials.pipeCWR);
    _0xf475aa([[3, 8.4, -17.5], [3, _hyCWS, -17.5], [3, _hyCWS, _hzCWS]], this.materials.pipeCWS);

    // --- PHX (nozzles at x=7.3/7.7, z=-8.26) ---
    // CHWS into PHX primary side
    _0xf475aa([[7.3, _hyCHWS, _hzCHWS], [7.3, _hyCHWS, -8.26], [7.3, 1.12, -8.26]], this.materials.pipeCHWS);
    // CHWR out of PHX primary side
    _0xf475aa([[7.3, 0.44, -8.26], [7.3, _hyCHWR, -8.26], [7.3, _hyCHWR, _hzCHWR]], this.materials.pipeCHWR);
    // CWS into PHX secondary side
    _0xf475aa([[7.7, _hyCWS, _hzCWS], [7.7, _hyCWS, -8.26], [7.7, 1.12, -8.26]], this.materials.pipeCWS);
    // CWR out of PHX secondary side
    _0xf475aa([[7.7, 0.44, -8.26], [7.7, _hyCWR, -8.26], [7.7, _hyCWR, _hzCWR]], this.materials.pipeCWR);
`;

// ============================================================
// Apply the fix to code_artifact.html
// ============================================================
let html = fs.readFileSync('public/code_artifact.html', 'utf8');

// Find the old pipe block: from first _0xf475aa call to _0x1c43ac canvas
const OLD_START = `    _0xf475aa([[0.5, 3.2, -11], [0.5, 3.8, -11], [0.5, 3.8, 1.45], [0.5, 0.58, 1.45], [-0.25, 0.58, 1.45]], this.materials.pipeCHWS);`;
const OLD_END_MARKER = `    const _0x1c43ac = document.createElement("canvas");`;

const startIdx = html.indexOf(OLD_START);
const endIdx   = html.indexOf(OLD_END_MARKER);

if (startIdx === -1) {
  console.error('ERROR: Could not find old pipe block start!');
  process.exit(1);
}
if (endIdx === -1) {
  console.error('ERROR: Could not find old pipe block end!');
  process.exit(1);
}

console.log(`Replacing pipe block: chars ${startIdx} to ${endIdx}`);
console.log(`Old block length: ${endIdx - startIdx} chars`);

const newHtml = html.substring(0, startIdx) + newPipeBlock + '\n    ' + html.substring(endIdx);
fs.writeFileSync('public/code_artifact.html', newHtml, 'utf8');
console.log('SUCCESS: Pipe block replaced!');
console.log(`New file size: ${newHtml.length} bytes`);
