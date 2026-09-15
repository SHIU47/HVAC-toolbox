const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'code_artifact.html');
let s = fs.readFileSync(file, 'utf8');

let startBoundary = `                // ============================================================================
                // 迴路 A：冰水供水 CHWS（藍色）`;
let endBoundary = `                // ============================================================================
                // [NEW] 穿牆管路套管 (Sleeve) 與 3D Billboard 標籤`;

let pipingStartIndex = s.indexOf(startBoundary);
let pipingEndIndex = s.indexOf(endBoundary);

if (pipingStartIndex === -1 || pipingEndIndex === -1) {
    console.error("❌ Boundaries not found");
    process.exit(1);
}

const newPipingStr = `                // ============================================================================
                // 迴路 A：冰水供水 CHWS（藍色）
                // 冰機蒸發器出水 → 側邊上升至高空管架 (y=3.8) → Header h1
                // ============================================================================
                // CH-01 Evap Out: x=-2.75, y=0.58, z=1.45 (Flange faces +X)
                drawOrthogonalPipe([
                    [-2.75, 0.58, 1.45], [-2.0, 0.58, 1.45], [-2.0, 3.8, 1.45], [-2.0, 3.8, -11.0]
                ], this.materials.pipeCHWS);

                // CH-02 Evap Out: x=5.25, y=0.58, z=1.45 (Flange faces +X)
                drawOrthogonalPipe([
                    [5.25, 0.58, 1.45], [6.0, 0.58, 1.45], [6.0, 3.8, 1.45], [6.0, 3.8, -11.0]
                ], this.materials.pipeCHWS);

                // ============================================================================
                // 迴路 B：冰水回水 CHWR（紅色）
                // Header h2 → 高空下降至 CHWP 前方水平進水 → CHWP 上方垂直出水至高空集管 → 冰機蒸發器進水
                // ============================================================================
                // 1. Header h2 (y=4.5) 下降至各 CHWP 進水 (y=0.32, z=-6.188, Faces +Z)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 4.5, -11.0], [px, 4.5, -5.5], [px, 0.32, -5.5], [px, 0.32, -6.188]
                    ], this.materials.pipeCHWR);
                });

                // 2. 各 CHWP 垂直出水 (y=1.168, z=-6.70) 升至共用高空出水集管 (y=4.4, z=-5.0)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 1.168, -6.70], [px, 4.4, -6.70], [px, 4.4, -5.0]
                    ], this.materials.pipeCHWR);
                });

                // 3. CHWP 出水共用集管 (橫跨 x=-6.5 至 x=7.3，供 PHX 與冰機)
                drawOrthogonalPipe([
                    [-6.5, 4.4, -5.0], [7.3, 4.4, -5.0]
                ], this.materials.pipeCHWR);

                // 4. 從集管連接至 CH-01 蒸發器進水 (x=-2.75, y=0.58, z=1.15, Faces +X)
                drawOrthogonalPipe([
                    [-2.0, 4.4, -5.0], [-2.0, 4.4, 1.15], [-2.0, 0.58, 1.15], [-2.75, 0.58, 1.15]
                ], this.materials.pipeCHWR);

                // 5. 從集管連接至 CH-02 蒸發器進水 (x=5.25, y=0.58, z=1.15, Faces +X)
                drawOrthogonalPipe([
                    [6.0, 4.4, -5.0], [6.0, 4.4, 1.15], [6.0, 0.58, 1.15], [5.25, 0.58, 1.15]
                ], this.materials.pipeCHWR);

                // ============================================================================
                // 迴路 C：冷卻水供水 CWS（藍綠色）
                // 穿牆進入 → 升高至管架 (y=3.8) → 前方水平落入 CWP → CWP 垂直出水至高空集管 → 冰機冷凝器進水
                // ============================================================================
                // 1. CWS 穿牆進入管架
                drawOrthogonalPipe([
                    [1.5, 1.0, -13.0], [1.5, 3.8, -13.0], [1.5, 3.8, -9.0]
                ], this.materials.pipeCWS);

                // 2. CWS 管架分配橫管 (y=3.8, z=-9.0)
                drawOrthogonalPipe([
                    [1.5, 3.8, -9.0], [4.5, 3.8, -9.0]
                ], this.materials.pipeCWS);

                // 3. 管架降至各 CWP 水平進水 (y=0.32, z=-6.188, Faces +Z)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 3.8, -9.0], [px, 3.8, -5.5], [px, 0.32, -5.5], [px, 0.32, -6.188]
                    ], this.materials.pipeCWS);
                });

                // 4. 各 CWP 垂直出水 (y=1.168, z=-6.70) 匯入共用出水集管 (y=4.1, z=-4.0)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 1.168, -6.70], [px, 4.1, -6.70], [px, 4.1, -4.0]
                    ], this.materials.pipeCWS);
                });

                // 5. CWP 出水共用集管 (橫跨 x=-2.0 至 x=6.0)
                drawOrthogonalPipe([
                    [-2.0, 4.1, -4.0], [6.0, 4.1, -4.0]
                ], this.materials.pipeCWS);

                // 6. 從集管連接至 CH-01 冷凝器進水 (x=-2.75, y=0.54, z=0.55, Faces +X)
                drawOrthogonalPipe([
                    [-2.0, 4.1, -4.0], [-2.0, 4.1, 0.55], [-2.0, 0.54, 0.55], [-2.75, 0.54, 0.55]
                ], this.materials.pipeCWS);

                // 7. 從集管連接至 CH-02 冷凝器進水 (x=5.25, y=0.54, z=0.55, Faces +X)
                drawOrthogonalPipe([
                    [6.0, 4.1, -4.0], [6.0, 4.1, 0.55], [6.0, 0.54, 0.55], [5.25, 0.54, 0.55]
                ], this.materials.pipeCWS);

                // ============================================================================
                // 迴路 D：冷卻水回水 CWR（深綠色）
                // 冷凝器出水 → 側邊升至高架回水集管 (y=4.7, z=-8.0) → 穿牆出室
                // ============================================================================
                // 1. CH-01 Cond Out: x=-2.75, y=0.54, z=0.85 (Flange faces +X)
                drawOrthogonalPipe([
                    [-2.75, 0.54, 0.85], [-2.0, 0.54, 0.85], [-2.0, 4.7, 0.85], [-2.0, 4.7, -8.0]
                ], this.materials.pipeCWR);

                // 2. CH-02 Cond Out: x=5.25, y=0.54, z=0.85 (Flange faces +X)
                drawOrthogonalPipe([
                    [5.25, 0.54, 0.85], [6.0, 0.54, 0.85], [6.0, 4.7, 0.85], [6.0, 4.7, -8.0]
                ], this.materials.pipeCWR);

                // 3. 高架回水集管橫跨 (x=-2.0 至 x=6.0)
                drawOrthogonalPipe([
                    [-2.0, 4.7, -8.0], [6.0, 4.7, -8.0]
                ], this.materials.pipeCWR);

                // 4. 匯流後穿牆出室外
                drawOrthogonalPipe([
                    [2.0, 4.7, -8.0], [2.0, 4.7, -11.5], [2.0, 1.0, -11.5], [2.0, 1.0, -13.0]
                ], this.materials.pipeCWR);

                // ============================================================================
                // PHX 與附屬管路連接
                // ============================================================================
                // PHX (7.5, -9.0) 管嘴位於正前方 (z=-8.26, Faces +Z)
                // 1. 一次側進水 (來自 Header h1 右端 x=7.0, y=3.8, z=-11.0)
                // 在 PHX 前方 (z=-7.5) 下降，然後水平插入法蘭
                drawOrthogonalPipe([
                    [7.0, 3.8, -11.0], [7.3, 3.8, -11.0], [7.3, 3.8, -7.5], [7.3, 1.12, -7.5], [7.3, 1.12, -8.26]
                ], this.materials.pipeCHWS);

                // 2. 一次側出水 (回流至 CHWP 出水集管 x=7.3, y=4.4, z=-5.0)
                // 從法蘭水平出管至 z=-7.5，上升至 y=4.4
                drawOrthogonalPipe([
                    [7.3, 0.44, -8.26], [7.3, 0.44, -7.5], [7.3, 4.4, -7.5], [7.3, 4.4, -5.0]
                ], this.materials.pipeCHWR);

`;

s = s.substring(0, pipingStartIndex) + newPipingStr + s.substring(pipingEndIndex);
console.log('✅ Replaced Piping Route Logic');

// Update Ceiling Pipe Hanger Racks Coordinates
let rackStart = s.indexOf(`                // ============================================================================
                // 管架吊桿結構 (Ceiling-mounted Pipe Hanger System)`);
let rackEnd = s.indexOf(`                // ============================================================================
                // 冷卻水塔 (Induced Draft Cooling Tower)`);
if (rackStart !== -1 && rackEnd !== -1) {
    let newRackStr = `                // ============================================================================
                // 管架吊桿結構 (Ceiling-mounted Pipe Hanger System)
                // ============================================================================
                const _hangerMat = new THREE.MeshStandardMaterial({color: 0x475569, metalness: 0.72, roughness: 0.38});
                const _bracketMat = new THREE.MeshStandardMaterial({color: 0x374151, metalness: 0.68, roughness: 0.42});

                // 1. Header 下方管架橫樑 (支撐 CHWS/CHWR 集管 h1 h2, y=3.5, z=-11.0)
                const hdrBeam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.10, 0.18), _bracketMat);
                hdrBeam.position.set(-0.5, 3.50, -11.0); hdrBeam.castShadow = true;
                this.scene.add(hdrBeam);
                [-6.5, -3.5, -0.5, 2.5, 5.5].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.0, 8), _hangerMat);
                    rod.position.set(hx, 4.50, -11.0); this.scene.add(rod);
                    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.08), _bracketMat);
                    clamp.position.set(hx, 3.48, -11.0); this.scene.add(clamp);
                });

                // 2. CWS 管架橫樑 (支撐 CWS 進水分配管, y=3.5, z=-9.0)
                const cwsBeam = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 0.14), _bracketMat);
                cwsBeam.position.set(3.0, 3.50, -9.0); this.scene.add(cwsBeam);
                [1.5, 3.0, 4.5].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.0, 8), _hangerMat);
                    rod.position.set(hx, 4.50, -9.0); this.scene.add(rod);
                });

                // 3. CWP 出水集管管架 (y=3.8, z=-4.0)
                const cwpOutBeam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.14), _bracketMat);
                cwpOutBeam.position.set(2.0, 3.80, -4.0); this.scene.add(cwpOutBeam);
                [-2.0, 2.0, 6.0].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.7, 8), _hangerMat);
                    rod.position.set(hx, 4.65, -4.0); this.scene.add(rod);
                });

                // 4. CHWP 出水集管管架 (y=4.1, z=-5.0)
                const chwpOutBeam = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.08, 0.14), _bracketMat);
                chwpOutBeam.position.set(0.4, 4.10, -5.0); this.scene.add(chwpOutBeam);
                [-6.5, -2.0, 2.5, 7.0].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 8), _hangerMat);
                    rod.position.set(hx, 4.80, -5.0); this.scene.add(rod);
                });

                // 5. CWR 高架回水集管管架 (y=4.4, z=-8.0)
                const cwrBeam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.14), _bracketMat);
                cwrBeam.position.set(2.0, 4.40, -8.0); this.scene.add(cwrBeam);
                [-2.0, 2.0, 6.0].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), _hangerMat);
                    rod.position.set(hx, 4.95, -8.0); this.scene.add(rod);
                });

`;
    s = s.substring(0, rackStart) + newRackStr + s.substring(rackEnd);
    console.log('✅ Updated Ceiling Pipe Hangers Heights');
} else {
    console.error("❌ Rack boundaries not found");
}

fs.writeFileSync(file, s, 'utf8');
console.log(`\n✅ ALL DONE!`);
