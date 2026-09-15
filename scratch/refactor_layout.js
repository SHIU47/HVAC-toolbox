const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'code_artifact.html');
let s = fs.readFileSync(file, 'utf8');
let c = 0;

function rep(old, nw, lbl) {
    if (!s.includes(old)) {
        console.error(`❌ NOT FOUND: ${lbl}`);
        process.exit(1);
    }
    s = s.replace(old, nw);
    c++;
    console.log(`✅ ${lbl}`);
}

// 2. Pumps
rep(
`                // 冰水泵 (CHWP) x 3
                createPump(-4.5, -2.5, 'CHWP-01', true);
                createPump(-3.0, -2.5, 'CHWP-02', true);
                createPump(-1.5, -2.5, 'CHWP-03', true);

                // 冷卻水泵 (CWP) x 3
                createPump(1.5, -2.5, 'CWP-01', false);
                createPump(3.0, -2.5, 'CWP-02', false);
                createPump(4.5, -2.5, 'CWP-03', false);`,
`                // 冰水泵 (CHWP) x 3 (獨立水泵島區)
                createPump(-6.5, -7.0, 'CHWP-01', true);
                createPump(-5.0, -7.0, 'CHWP-02', true);
                createPump(-3.5, -7.0, 'CHWP-03', true);

                // 冷卻水泵 (CWP) x 3 (獨立水泵島區)
                createPump(1.5, -7.0, 'CWP-01', false);
                createPump(3.0, -7.0, 'CWP-02', false);
                createPump(4.5, -7.0, 'CWP-03', false);`,
`Move Pumps`
);

// 3. PHX
rep(`createPHX(7.5, -1.5);`, `createPHX(7.5, -9.0);`, `Move PHX`);

// 4. Headers h1 & h2
rep(
`                // Header h1 (CHWS): y=3.8, z=-5.5, length=12
                const headerH1 = new THREE.Mesh(headerGeo, this.materials.pipeCHWS);
                headerH1.rotation.z = Math.PI / 2;
                headerH1.position.set(0, 3.8, -5.5);
                headerH1.castShadow = true;
                this.scene.add(headerH1);

                // Header h2 (CHWR): y=4.4, z=-5.5, length=12
                const headerH2 = new THREE.Mesh(headerGeo, this.materials.pipeCHWR);
                headerH2.rotation.z = Math.PI / 2;
                headerH2.position.set(0, 4.4, -5.5);
                headerH2.castShadow = true;
                this.scene.add(headerH2);`,
`                // Header h1 (CHWS): y=3.8, z=-11.0, length=15
                const headerGeoMod = new THREE.CylinderGeometry(0.2, 0.2, 15, 24);
                const headerH1 = new THREE.Mesh(headerGeoMod, this.materials.pipeCHWS);
                headerH1.rotation.z = Math.PI / 2;
                headerH1.position.set(-0.5, 3.8, -11.0);
                headerH1.castShadow = true;
                this.scene.add(headerH1);

                // Header h2 (CHWR): y=4.5, z=-11.0, length=15
                const headerH2 = new THREE.Mesh(headerGeoMod, this.materials.pipeCHWR);
                headerH2.rotation.z = Math.PI / 2;
                headerH2.position.set(-0.5, 4.5, -11.0);
                headerH2.castShadow = true;
                this.scene.add(headerH2);`,
`Move Headers`
);

// 5. Replace All Piping Logic (Lines 1427 to 1571)
// Wait, since I don't know the exact string, I'll extract it dynamically or use a simpler split replace
// Let's use string manipulation based on boundaries
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
                // 冰機蒸發器出水 → Header h1 (高空直接平行向後)
                // ============================================================================
                drawOrthogonalPipe([
                    [-4.0, 0.58, 2.45], [-4.0, 3.8, 2.45], [-4.0, 3.8, -11.0]
                ], this.materials.pipeCHWS); // CH-01

                drawOrthogonalPipe([
                    [4.0, 0.58, 2.45], [4.0, 3.8, 2.45], [4.0, 3.8, -11.0]
                ], this.materials.pipeCHWS); // CH-02

                // ============================================================================
                // 迴路 B：冰水回水 CHWR（紅色）
                // Header h2 → 下降 → 各 CHWP 進水 → CHWP 出水集管 → 冰機蒸發器進水
                // ============================================================================
                // Header h2 下降至各 CHWP 進水 (z=-6.48)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 4.5, -11.0], [px, 1.0, -11.0], [px, 1.0, -6.48], [px, 0.32, -6.48]
                    ], this.materials.pipeCHWR);
                });

                // 各 CHWP 出水 (z=-6.70) 匯入共用出水集管 (y=1.8, z=-5.0)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 0.85, -6.70], [px, 1.8, -6.70], [px, 1.8, -5.0]
                    ], this.materials.pipeCHWR);
                });

                // CHWP 出水共用集管 (橫跨 x=-6.5 至 x=7.3，供 PHX 與冰機)
                drawOrthogonalPipe([
                    [-6.5, 1.8, -5.0], [7.3, 1.8, -5.0]
                ], this.materials.pipeCHWR);

                // 從集管連接至 CH-01 蒸發器進水 (z=2.15)
                drawOrthogonalPipe([
                    [-4.0, 1.8, -5.0], [-4.0, 1.8, 2.15], [-4.0, 0.58, 2.15]
                ], this.materials.pipeCHWR);

                // 從集管連接至 CH-02 蒸發器進水 (z=2.15)
                drawOrthogonalPipe([
                    [4.0, 1.8, -5.0], [4.0, 1.8, 2.15], [4.0, 0.58, 2.15]
                ], this.materials.pipeCHWR);

                // ============================================================================
                // 迴路 C：冷卻水供水 CWS（藍綠色）
                // 穿牆進入 → 升高至管架 (y=2.5) → 分配至各 CWP → CWP 出水集管 → 冰機冷凝器進水
                // ============================================================================
                // CWS 穿牆進入管架
                drawOrthogonalPipe([
                    [1.5, 1.0, -13.0], [1.5, 2.5, -13.0], [1.5, 2.5, -9.0]
                ], this.materials.pipeCWS);

                // CWS 管架分配橫管 (y=2.5, z=-9.0)
                drawOrthogonalPipe([
                    [1.5, 2.5, -9.0], [4.5, 2.5, -9.0]
                ], this.materials.pipeCWS);

                // 管架降至各 CWP 進水 (z=-6.48)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 2.5, -9.0], [px, 2.5, -6.48], [px, 0.32, -6.48]
                    ], this.materials.pipeCWS);
                });

                // 各 CWP 出水 (z=-6.70) 匯入共用出水集管 (y=1.4, z=-4.0)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 0.85, -6.70], [px, 1.4, -6.70], [px, 1.4, -4.0]
                    ], this.materials.pipeCWS);
                });

                // CWP 出水共用集管 (橫跨 x=-4.0 至 x=4.5)
                drawOrthogonalPipe([
                    [-4.0, 1.4, -4.0], [4.5, 1.4, -4.0]
                ], this.materials.pipeCWS);

                // 從集管連接至 CH-01 冷凝器進水 (z=1.55)
                drawOrthogonalPipe([
                    [-4.0, 1.4, -4.0], [-4.0, 1.4, 1.55], [-4.0, 0.54, 1.55]
                ], this.materials.pipeCWS);

                // 從集管連接至 CH-02 冷凝器進水 (z=1.55)
                drawOrthogonalPipe([
                    [4.0, 1.4, -4.0], [4.0, 1.4, 1.55], [4.0, 0.54, 1.55]
                ], this.materials.pipeCWS);

                // ============================================================================
                // 迴路 D：冷卻水回水 CWR（深綠色）
                // 冷凝器出水 → 高架回水集管 (y=3.2, z=-8.0) → 穿牆出室
                // ============================================================================
                drawOrthogonalPipe([
                    [-4.0, 0.54, 1.85], [-4.0, 3.2, 1.85], [-4.0, 3.2, -8.0]
                ], this.materials.pipeCWR); // CH-01

                drawOrthogonalPipe([
                    [4.0, 0.54, 1.85], [4.0, 3.2, 1.85], [4.0, 3.2, -8.0]
                ], this.materials.pipeCWR); // CH-02

                // 高架回水集管橫跨 (x=-4.0 至 x=4.0)
                drawOrthogonalPipe([
                    [-4.0, 3.2, -8.0], [4.0, 3.2, -8.0]
                ], this.materials.pipeCWR);

                // 匯流後穿牆出室外
                drawOrthogonalPipe([
                    [2.0, 3.2, -8.0], [2.0, 3.2, -11.5], [2.0, 1.0, -11.5], [2.0, 1.0, -13.0]
                ], this.materials.pipeCWR);

                // ============================================================================
                // PHX 與附屬管路連接
                // ============================================================================
                // PHX (7.5, -9.0) 一次側進水 (來自 Header h1 右端 x=7.0)
                // 接管嘴 World: (7.30, 1.12, -8.26)
                drawOrthogonalPipe([
                    [7.0, 3.8, -11.0], [7.3, 3.8, -11.0], [7.3, 3.8, -8.26], [7.3, 1.12, -8.26]
                ], this.materials.pipeCHWS);

                // PHX 一次側出水 (回流至 CHWR 集管 x=7.3, y=1.8, z=-5.0)
                // 接管嘴 World: (7.30, 0.44, -8.26)
                drawOrthogonalPipe([
                    [7.3, 0.44, -8.26], [7.3, 0.44, -5.0], [7.3, 1.8, -5.0]
                ], this.materials.pipeCHWR);

`;

s = s.substring(0, pipingStartIndex) + newPipingStr + s.substring(pipingEndIndex);
console.log('✅ Replace All Piping Route Logic');

// 6. Tank connection modification
rep(`tankGroup.position.set(-9.0, 0, -3.0);`, `tankGroup.position.set(-9.0, 0, -8.0);`, `Move Tank Group`);
// Using boundaries for Tank piping
let tankPipingStart = s.indexOf(`                // 膨脹水箱 → CHWR 系統補水管路`);
let tankPipingEnd = s.indexOf(`            },`, tankPipingStart);
if (tankPipingStart !== -1 && tankPipingEnd !== -1) {
    let newTankPipingStr = `                // 膨脹水箱 → CHWR 系統補水管路 (紅色, 小管徑 r=0.06)
                // 水箱系統接口: 世界座標 (-9.0, 0.82, -7.30) → Header h2 左端 (-7.0, 4.5, -11.0)
                // ============================================================================
                drawOrthogonalPipe([
                    [-9.0, 0.82, -7.30],
                    [-9.0, 0.82, -11.0],
                    [-7.0, 0.82, -11.0],
                    [-7.0, 4.5, -11.0]
                ], this.materials.pipeCHWR, 0.06);
`;
    s = s.substring(0, tankPipingStart) + newTankPipingStr + s.substring(tankPipingEnd);
    console.log('✅ Update Tank Piping');
} else {
    console.error("❌ Tank Piping boundaries not found");
}

// 7. Update Ceiling Pipe Hanger Racks Coordinates
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

                // 1. Header 下方管架橫樑 (支撐 CHWS/CHWR 集管 h1 h2, z=-11.0)
                const hdrBeam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.10, 0.18), _bracketMat);
                hdrBeam.position.set(-0.5, 3.50, -11.0); hdrBeam.castShadow = true;
                this.scene.add(hdrBeam);
                [-6.5, -3.5, -0.5, 2.5, 5.5].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.0, 8), _hangerMat);
                    rod.position.set(hx, 4.50, -11.0); this.scene.add(rod);
                    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.08), _bracketMat);
                    clamp.position.set(hx, 3.48, -11.0); this.scene.add(clamp);
                });

                // 2. CWS 管架橫樑 (支撐 CWS 進水分配管, y=2.5, z=-9.0)
                const cwsBeam = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 0.14), _bracketMat);
                cwsBeam.position.set(3.0, 2.42, -9.0); this.scene.add(cwsBeam);
                [1.5, 3.0, 4.5].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.0, 8), _hangerMat);
                    rod.position.set(hx, 3.92, -9.0); this.scene.add(rod);
                });

                // 3. CWP 出水集管管架 (y=1.4, z=-4.0)
                const cwpOutBeam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.14), _bracketMat);
                cwpOutBeam.position.set(0.25, 1.32, -4.0); this.scene.add(cwpOutBeam);
                [-4.0, 0.0, 4.5].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 4.0, 8), _hangerMat);
                    rod.position.set(hx, 3.32, -4.0); this.scene.add(rod);
                });

                // 4. CHWP 出水集管管架 (y=1.8, z=-5.0)
                const chwpOutBeam = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.08, 0.14), _bracketMat);
                chwpOutBeam.position.set(0.4, 1.72, -5.0); this.scene.add(chwpOutBeam);
                [-6.5, -2.0, 2.5, 7.0].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.6, 8), _hangerMat);
                    rod.position.set(hx, 3.52, -5.0); this.scene.add(rod);
                });

                // 5. CWR 高架回水集管管架 (y=3.2, z=-8.0)
                const cwrBeam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.14), _bracketMat);
                cwrBeam.position.set(0.0, 3.12, -8.0); this.scene.add(cwrBeam);
                [-4.0, 0.0, 4.0].forEach(hx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.3, 8), _hangerMat);
                    rod.position.set(hx, 4.27, -8.0); this.scene.add(rod);
                });

`;
    s = s.substring(0, rackStart) + newRackStr + s.substring(rackEnd);
    console.log('✅ Update Ceiling Pipe Hangers');
} else {
    console.error("❌ Rack boundaries not found");
}


fs.writeFileSync(file, s, 'utf8');
console.log(`\n✅ ALL DONE!`);
