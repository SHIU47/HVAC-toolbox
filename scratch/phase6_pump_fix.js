const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'code_artifact.html');
let s = fs.readFileSync(file, 'utf8');

// Find the section for Pumps
let startMarker = '// === 水泵 CHWP 與 CWP 配管 ===';
let endMarker = '// === CWS / CWR 高空集水管 (Manifolds) ===';

let startIdx = s.indexOf(startMarker);
let endIdx = s.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find markers');
    process.exit(1);
}

let newPumpCode = `// === 水泵 CHWP 與 CWP 配管 ===
                // 泵中心 px, pz=-7.0, 無旋轉。Suction faces +Z at [px, 0.32, -6.15]. Discharge faces +Y at [px, 1.21, -6.70].
                
                // CHWP Suction: from h2 (y=5.6, z=-11.0) -> NS (y=5.0) -> Drop (z=-4.5) -> Flange (z=-6.15)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([[px, 5.6, -11.0], [px, 5.0, -11.0], [px, 5.0, -4.5], [px, 0.32, -4.5], [px, 0.32, -6.15]], this.materials.pipeCHWR);
                });
                
                // CHWP Discharge: from Flange (y=1.21, z=-6.70) -> UP to Header (y=4.4, z=-6.5)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([[px, 1.21, -6.70], [px, 4.4, -6.70], [px, 4.4, -6.5]], this.materials.pipeCHWR);
                });
                
                // CHWP Discharge Header: EW (Layer 3: y=4.4, z=-6.5)
                drawOrthogonalPipe([[-6.5, 4.4, -6.5], [7.3, 4.4, -6.5]], this.materials.pipeCHWR);

                // CWP Suction: from CWS Manifold (y=5.6, z=-9.0) -> NS (y=5.0) -> Drop (z=-4.5) -> Flange (z=-6.15)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([[px, 5.6, -9.0], [px, 5.0, -9.0], [px, 5.0, -4.5], [px, 0.32, -4.5], [px, 0.32, -6.15]], this.materials.pipeCWS);
                });
                
                // CWP Discharge: from Flange (y=1.21, z=-6.70) -> UP to Header (y=3.2, z=-7.0)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([[px, 1.21, -6.70], [px, 3.2, -6.70], [px, 3.2, -7.0]], this.materials.pipeCWS);
                });
                
                // CWP Discharge Header: EW (Layer 5: y=3.2, z=-7.0)
                drawOrthogonalPipe([[-0.5, 3.2, -7.0], [6.0, 3.2, -7.0]], this.materials.pipeCWS);

                `;

s = s.substring(0, startIdx) + newPumpCode + s.substring(endIdx);

fs.writeFileSync(file, s, 'utf8');
console.log('✅ Pump logic fixed');
