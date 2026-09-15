const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'code_artifact.html');
let s = fs.readFileSync(file, 'utf8');

// 1. Modify createCoolingTower signature and position
s = s.replace(`const createCoolingTower = (ctX, ctZ, ctLbl) => {`, `const createCoolingTower = (ctX, ctY, ctZ, ctLbl) => {`);
s = s.replace(`g.position.set(ctX, 0, ctZ);`, `g.position.set(ctX, ctY, ctZ);`);
s = s.replace(`createCoolingTower(-3.5, -17.5, 'CT-01');`, `createCoolingTower(-3.5, 8.0, -17.5, 'CT-01');`);
s = s.replace(`createCoolingTower( 1.0, -17.5, 'CT-02');`, `createCoolingTower( 1.0, 8.0, -17.5, 'CT-02');`);

// 2. Add Roof Platform before floor
let floorStart = s.indexOf(`// 地板`);
let roofCode = `
                // 機房屋頂平台 (Roof Platform, y=8.0)
                const roof = new THREE.Mesh(
                    new THREE.PlaneGeometry(38, 12),
                    new THREE.MeshStandardMaterial({
                        color: 0x334155, roughness: 0.95
                    })
                );
                roof.rotation.x = -Math.PI / 2;
                roof.position.set(0, 8.0, -16.0); // Covers from z=-10 to z=-22 (outdoor area)
                roof.receiveShadow = true;
                this.scene.add(roof);

                `;
if (floorStart !== -1 && !s.includes('機房屋頂平台')) {
    s = s.substring(0, floorStart) + roofCode + s.substring(floorStart);
}

// 3. Replace all Piping Logic from "實體分水器/集水器集管" to "穿牆管路套管 (Sleeve) 與 3D Billboard 標籤"
let pipeStart = s.indexOf(`// [NEW] 實體分水器/集水器集管 (Header h1 & h2) 繪製`);
let pipeEnd = s.indexOf(`// 5. 隔膜式加壓膨脹水箱`);

if (pipeStart === -1 || pipeEnd === -1) {
    console.error('❌ Could not find piping boundaries');
    process.exit(1);
}

// Ensure we don't accidentally cut the expansion tank logic itself
let pipeCode = `// [NEW] 實體分水器/集水器集管 (Header h1 & h2) 繪製
                // ============================================================================
                const headerGeoMod = new THREE.CylinderGeometry(0.2, 0.2, 15, 24);
                
                // Header h1 (CHWS): y=3.2, z=-11.0 (改為 Layer 5)
                const headerH1 = new THREE.Mesh(headerGeoMod, this.materials.pipeCHWS);
                headerH1.rotation.z = Math.PI / 2;
                headerH1.position.set(-0.5, 3.2, -11.0);
                headerH1.castShadow = true;
                this.scene.add(headerH1);

                // Header h2 (CHWR): y=5.6, z=-11.0 (改為 Layer 1)
                const headerH2 = new THREE.Mesh(headerGeoMod, this.materials.pipeCHWR);
                headerH2.rotation.z = Math.PI / 2;
                headerH2.position.set(-0.5, 5.6, -11.0);
                headerH2.castShadow = true;
                this.scene.add(headerH2);

                // ============================================================================
                // PCB 雙層高程佈線規則：東西向(EW) 走 Layer 1,3,5；南北向(NS) 走 Layer 2,4
                // Layer 1 (y=5.6), Layer 2 (y=5.0), Layer 3 (y=4.4), Layer 4 (y=3.8), Layer 5 (y=3.2)
                // ============================================================================

                // === 冰機 CH-01 直落管 ===
                // CHWS (Blue): z=1.45. Drop at x=-2.75. NS travels at Layer 4 (y=3.8). EW header at y=3.2.
                drawOrthogonalPipe([[-2.75, 3.2, -11.0], [-2.75, 3.8, -11.0], [-2.75, 3.8, 1.45], [-2.75, 0.58, 1.45]], this.materials.pipeCHWS);
                // CHWR (Red): z=1.15. Drop at x=-2.75. NS travels at Layer 2 (y=5.0). EW header at y=4.4.
                drawOrthogonalPipe([[-2.75, 4.4, -6.5], [-2.75, 5.0, -6.5], [-2.75, 5.0, 1.15], [-2.75, 0.58, 1.15]], this.materials.pipeCHWR);
                // CWR (Dark Green): z=0.85. Drop at x=-2.75. NS travels at Layer 2 (y=5.0). EW header at y=4.4.
                drawOrthogonalPipe([[-2.75, 4.4, -8.0], [-2.75, 5.0, -8.0], [-2.75, 5.0, 0.85], [-2.75, 0.54, 0.85]], this.materials.pipeCWR);
                // CWS (Light Green): z=0.55. Drop at x=-2.75. NS travels at Layer 4 (y=3.8). EW header at y=3.2.
                drawOrthogonalPipe([[-2.75, 3.2, -7.0], [-2.75, 3.8, -7.0], [-2.75, 3.8, 0.55], [-2.75, 0.54, 0.55]], this.materials.pipeCWS);

                // === 冰機 CH-02 直落管 ===
                // CHWS (Blue): z=1.45. Drop at x=5.25. NS travels at Layer 4 (y=3.8).
                drawOrthogonalPipe([[5.25, 3.2, -11.0], [5.25, 3.8, -11.0], [5.25, 3.8, 1.45], [5.25, 0.58, 1.45]], this.materials.pipeCHWS);
                // CHWR (Red): z=1.15. Drop at x=5.25. NS travels at Layer 2 (y=5.0).
                drawOrthogonalPipe([[5.25, 4.4, -6.5], [5.25, 5.0, -6.5], [5.25, 5.0, 1.15], [5.25, 0.58, 1.15]], this.materials.pipeCHWR);
                // CWR (Dark Green): z=0.85. Drop at x=5.25. NS travels at Layer 2 (y=5.0).
                drawOrthogonalPipe([[5.25, 4.4, -8.0], [5.25, 5.0, -8.0], [5.25, 5.0, 0.85], [5.25, 0.54, 0.85]], this.materials.pipeCWR);
                // CWS (Light Green): z=0.55. Drop at x=5.25. NS travels at Layer 4 (y=3.8).
                drawOrthogonalPipe([[5.25, 3.2, -7.0], [5.25, 3.8, -7.0], [5.25, 3.8, 0.55], [5.25, 0.54, 0.55]], this.materials.pipeCWS);

                // === 水泵 CHWP 與 CWP 配管 ===
                // CHWP Suction: from h2 (y=5.6, z=-11.0) -> NS (y=5.0) -> Drop front (z=-4.5) -> Flange (y=0.32, z=-5.16)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([[px, 5.6, -11.0], [px, 5.0, -11.0], [px, 5.0, -4.5], [px, 0.32, -4.5], [px, 0.32, -5.16]], this.materials.pipeCHWR);
                });
                // CHWP Discharge: from Flange (y=1.21, z=-5.84) -> UP to Header (y=4.4, z=-6.5)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([[px, 1.21, -5.84], [px, 4.4, -5.84], [px, 4.4, -6.5]], this.materials.pipeCHWR);
                });
                // CHWP Discharge Header: EW (Layer 3: y=4.4, z=-6.5)
                drawOrthogonalPipe([[-6.5, 4.4, -6.5], [7.3, 4.4, -6.5]], this.materials.pipeCHWR);

                // CWP Suction: from CWS Manifold (y=5.6, z=-9.0) -> NS (y=5.0) -> Drop front (z=-4.5) -> Flange (y=0.32, z=-5.16)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([[px, 5.6, -9.0], [px, 5.0, -9.0], [px, 5.0, -4.5], [px, 0.32, -4.5], [px, 0.32, -5.16]], this.materials.pipeCWS);
                });
                // CWP Discharge: from Flange (y=1.21, z=-5.84) -> UP to Header (y=3.2, z=-7.0)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([[px, 1.21, -5.84], [px, 3.2, -5.84], [px, 3.2, -7.0]], this.materials.pipeCWS);
                });
                // CWP Discharge Header: EW (Layer 5: y=3.2, z=-7.0)
                drawOrthogonalPipe([[-2.5, 3.2, -7.0], [6.0, 3.2, -7.0]], this.materials.pipeCWS);

                // === CWS / CWR 高空集水管 (Manifolds) ===
                // CWS Manifold: EW (Layer 1: y=5.6, z=-9.0)
                drawOrthogonalPipe([[1.5, 5.6, -9.0], [5.5, 5.6, -9.0]], this.materials.pipeCWS);
                // CWR Manifold: EW (Layer 3: y=4.4, z=-8.0)
                drawOrthogonalPipe([[-2.0, 4.4, -8.0], [6.0, 4.4, -8.0]], this.materials.pipeCWR);

                // === 板熱 PHX 連接 ===
                // CHWS In (from h1 y=3.2, z=-11.0 to PHX y=1.12, z=-8.26). NS travels at Layer 4 (y=3.8).
                drawOrthogonalPipe([[7.3, 3.2, -11.0], [7.3, 3.8, -11.0], [7.3, 3.8, -7.5], [7.3, 1.12, -7.5], [7.3, 1.12, -8.26]], this.materials.pipeCHWS);
                // CHWR Out (from PHX y=0.44, z=-8.26 to CHWP Discharge y=4.4, z=-6.5). Passes completely under all EW layers!
                drawOrthogonalPipe([[7.3, 0.44, -8.26], [7.3, 0.44, -6.5], [7.3, 4.4, -6.5]], this.materials.pipeCHWR);

                // ============================================================================
                // [NEW] 穿牆管路套管 (Sleeve) 與 3D Billboard 標籤
                // ============================================================================
                const sleeveGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 16);

                const sleeveCWS = new THREE.Mesh(sleeveGeo, this.materials.darkMetal);
                sleeveCWS.rotation.x = Math.PI/2;
                sleeveCWS.position.set(1.5, 5.0, -13.0);
                this.scene.add(sleeveCWS);

                const sleeveCWR = new THREE.Mesh(sleeveGeo, this.materials.darkMetal);
                sleeveCWR.rotation.x = Math.PI/2;
                sleeveCWR.position.set(2.0, 5.0, -13.0);
                this.scene.add(sleeveCWR);

                // 戶外冷卻水管路（延伸至屋頂冷卻水塔）
                // CWR 熱水：Manifold (y=4.4) -> 升至 Layer 2 (y=5.0) -> 穿牆 (z=-13.0) -> 室外爬升至水塔上方 (y=10.30)
                drawOrthogonalPipe([[2.0, 4.4, -8.0], [2.0, 5.0, -8.0], [2.0, 5.0, -13.5], [2.0, 10.30, -13.5], [-2.3, 10.30, -13.5], [-2.3, 10.30, -16.0]], this.materials.pipeCWR); // CT-01
                drawOrthogonalPipe([[2.0, 10.30, -13.5], [2.2, 10.30, -13.5], [2.2, 10.30, -16.0]], this.materials.pipeCWR); // CT-02
                
                // CWS 冷水：水塔集水盤 (y=8.30) -> 室外下降至 y=5.0 -> 穿牆回室內 -> Manifold (y=5.6)
                drawOrthogonalPipe([[-2.3, 8.30, -16.0], [-2.3, 8.30, -14.0], [1.5, 8.30, -14.0], [1.5, 5.0, -14.0], [1.5, 5.0, -9.0], [1.5, 5.6, -9.0]], this.materials.pipeCWS); // CT-01
                drawOrthogonalPipe([[2.2, 8.30, -16.0], [2.2, 8.30, -14.0], [1.5, 8.30, -14.0]], this.materials.pipeCWS); // CT-02

                // 建立精緻 3D Billboard 標籤
                const labelCanvas = document.createElement('canvas');
                labelCanvas.width = 256; labelCanvas.height = 64;
                const labelCtx = labelCanvas.getContext('2d');
                labelCtx.fillStyle = 'rgba(8, 12, 20, 0.85)';
                labelCtx.beginPath();
                labelCtx.roundRect(0, 0, 256, 64, 12);
                labelCtx.fill();
                labelCtx.strokeStyle = '#38bdf8';
                labelCtx.lineWidth = 3;
                labelCtx.stroke();
                
                labelCtx.fillStyle = '#ffffff';
                labelCtx.font = 'bold 16px "Segoe UI", sans-serif';
                labelCtx.textAlign = 'center';
                labelCtx.textBaseline = 'middle';
                labelCtx.fillText('↑ 往屋頂冷卻水塔 (Rooftop CT)', 128, 32);
                
                const labelTexture = new THREE.CanvasTexture(labelCanvas);
                const spriteMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.set(1.75, 5.8, -12.5);
                sprite.scale.set(3.0, 0.75, 1.0);
                this.scene.add(sprite);

                // ============================================================================
                `;

let boundaryString = `// 5. 隔膜式加壓膨脹水箱`;

// Look for expansion tank logic, which starts with `const tankGroup = new THREE.Group();`
// Just cut everything between pipeStart and boundaryString
s = s.substring(0, pipeStart) + pipeCode + s.substring(s.indexOf(boundaryString, pipeStart));

// Wait, I also need to update Expansion Tank connection to h2
let tkPipeStart = s.indexOf(`// 膨脹水箱 → CHWR 系統補水管路`);
if (tkPipeStart !== -1) {
    let tkPipeEnd = s.indexOf(`this.scene.add(this.mainGroup);`, tkPipeStart);
    if (tkPipeEnd !== -1) {
        let newTkPipe = `// 膨脹水箱 → CHWR 系統補水管路 (紅色, 小管徑 r=0.06)
                // 水箱系統接口: 世界座標 (-9.0, 0.82, -7.30) → Header h2 左端 (-7.0, 5.6, -11.0)
                // ============================================================================
                drawOrthogonalPipe([
                    [-9.0, 0.82, -7.30],
                    [-9.0, 0.82, -11.0],
                    [-7.0, 0.82, -11.0],
                    [-7.0, 5.6, -11.0]
                ], this.materials.pipeCHWR, 0.06);

                `;
        s = s.substring(0, tkPipeStart) + newTkPipe + s.substring(tkPipeEnd);
    }
}

fs.writeFileSync(file, s, 'utf8');
console.log('✅ Rewrite complete');
