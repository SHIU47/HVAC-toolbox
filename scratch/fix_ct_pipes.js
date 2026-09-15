const fs = require('fs');

let html = fs.readFileSync('public/code_artifact.html', 'utf8');

const OLD_BLOCK = `    // --- Main E-W headers ---
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
    _0xf475aa([[3, 8.4, -17.5], [3, _hyCWS, -17.5], [3, _hyCWS, _hzCWS]], this.materials.pipeCWS);`;

const NEW_BLOCK = `    // --- Main E-W headers ---
    _0xf475aa([[-7.0, _hyCHWS, _hzCHWS], [7.3, _hyCHWS, _hzCHWS]], this.materials.pipeCHWS);
    _0xf475aa([[-7.0, _hyCHWR, _hzCHWR], [7.3, _hyCHWR, _hzCHWR]], this.materials.pipeCHWR);
    _0xf475aa([[-3.5, _hyCWS,  _hzCWS ], [7.7, _hyCWS,  _hzCWS ]], this.materials.pipeCWS);
    _0xf475aa([[-3.5, _hyCWR,  _hzCWR ], [7.7, _hyCWR,  _hzCWR ]], this.materials.pipeCWR);

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

    // --- CT-01 (riser at x = -3.5) ---
    // CWR hot supply → long horizontal run → rise to CT hot inlet
    _0xf475aa([[-3.5, _hyCWR, _hzCWR], [-3.5, _hyCWR, -15.58], [-3.5, 10.3, -15.58]], this.materials.pipeCWR);
    // CWS cold return ← drop from CT cold outlet ← long horizontal run back
    _0xf475aa([[-3.5, 8.3, -15.58], [-3.5, _hyCWS, -15.58], [-3.5, _hyCWS, _hzCWS]], this.materials.pipeCWS);

    // --- CT-02 (riser at x = 1.0) ---
    _0xf475aa([[1.0, _hyCWR, _hzCWR], [1.0, _hyCWR, -15.58], [1.0, 10.3, -15.58]], this.materials.pipeCWR);
    _0xf475aa([[1.0, 8.3, -15.58], [1.0, _hyCWS, -15.58], [1.0, _hyCWS, _hzCWS]], this.materials.pipeCWS);`;

if (!html.includes(OLD_BLOCK)) {
  console.error("ERROR: Could not find OLD_BLOCK in public/code_artifact.html!");
  process.exit(1);
}

html = html.replace(OLD_BLOCK, NEW_BLOCK);
fs.writeFileSync('public/code_artifact.html', html, 'utf8');
console.log("SUCCESS: Replaced CT piping lines in public/code_artifact.html!");
