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
                // ============================================================================
                // CH-01 Evap Out: x=-2.75, y=0.58, z=1.45 (Flange faces +X)
                // Drop at x=-1.0 to avoid vertical crossing
                drawOrthogonalPipe([
                    [-1.0, 3.8, -11.0], [-1.0, 3.8, 1.45], [-1.0, 0.58, 1.45], [-2.75, 0.58, 1.45]
                ], this.materials.pipeCHWS);

                // CH-02 Evap Out: x=5.25, y=0.58, z=1.45 (Flange faces +X)
                // Drop at x=7.0 to avoid vertical crossing
                drawOrthogonalPipe([
                    [7.0, 3.8, -11.0], [7.0, 3.8, 1.45], [7.0, 0.58, 1.45], [5.25, 0.58, 1.45]
                ], this.materials.pipeCHWS);

                // ============================================================================
                // 迴路 B：冰水回水 CHWR（紅色）
                // ============================================================================
                // 1. Header h2 (y=4.5) 下降至各 CHWP 進水 (y=0.32, z=-6.188, Faces +Z)
                // 偏移 x+0.6 繞過水泵，避免與垂直出水管打架
                [-6.5, -5.0, -3.5].forEach(px => {
                    const ox = px + 0.6;
                    drawOrthogonalPipe([
                        [px, 4.5, -11.0], [ox, 4.5, -11.0], [ox, 4.5, -5.5], [px, 4.5, -5.5], [px, 0.32, -5.5], [px, 0.32, -6.188]
                    ], this.materials.pipeCHWR);
                });

                // 2. 各 CHWP 垂直出水 (y=1.168, z=-6.70) 升至共用高空出水集管 (y=4.4, z=-5.0)
                [-6.5, -5.0, -3.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 1.168, -6.70], [px, 4.4, -6.70], [px, 4.4, -5.0]
                    ], this.materials.pipeCHWR);
                });

                // 3. CHWP 出水共用集管 (橫跨 x=-6.5 至 x=7.3)
                drawOrthogonalPipe([
                    [-6.5, 4.4, -5.0], [7.3, 4.4, -5.0]
                ], this.materials.pipeCHWR);

                // 4. 從集管連接至 CH-01 蒸發器進水 (x=-2.75, y=0.58, z=1.15, Faces +X)
                // Drop at x=-1.5
                drawOrthogonalPipe([
                    [-1.5, 4.4, -5.0], [-1.5, 4.4, 1.15], [-1.5, 0.58, 1.15], [-2.75, 0.58, 1.15]
                ], this.materials.pipeCHWR);

                // 5. 從集管連接至 CH-02 蒸發器進水 (x=5.25, y=0.58, z=1.15, Faces +X)
                // Drop at x=6.5
                drawOrthogonalPipe([
                    [6.5, 4.4, -5.0], [6.5, 4.4, 1.15], [6.5, 0.58, 1.15], [5.25, 0.58, 1.15]
                ], this.materials.pipeCHWR);

                // ============================================================================
                // 迴路 C：冷卻水供水 CWS（藍綠色）
                // ============================================================================
                // 1. CWS 穿牆進入管架
                drawOrthogonalPipe([
                    [1.5, 1.0, -13.0], [1.5, 3.8, -13.0], [1.5, 3.8, -9.0]
                ], this.materials.pipeCWS);

                // 2. CWS 管架分配橫管 (y=3.8, z=-9.0)
                drawOrthogonalPipe([
                    [1.5, 3.8, -9.0], [5.5, 3.8, -9.0]
                ], this.materials.pipeCWS);

                // 3. 管架降至各 CWP 水平進水 (y=0.32, z=-6.188, Faces +Z)
                // 偏移 x+0.6 繞過水泵，避免與垂直出水管打架
                [1.5, 3.0, 4.5].forEach(px => {
                    const ox = px + 0.6;
                    drawOrthogonalPipe([
                        [px, 3.8, -9.0], [ox, 3.8, -9.0], [ox, 3.8, -5.5], [px, 3.8, -5.5], [px, 0.32, -5.5], [px, 0.32, -6.188]
                    ], this.materials.pipeCWS);
                });

                // 4. 各 CWP 垂直出水 (y=1.168, z=-6.70) 匯入共用出水集管 (y=4.1, z=-4.0)
                [1.5, 3.0, 4.5].forEach(px => {
                    drawOrthogonalPipe([
                        [px, 1.168, -6.70], [px, 4.1, -6.70], [px, 4.1, -4.0]
                    ], this.materials.pipeCWS);
                });

                // 5. CWP 出水共用集管 (橫跨 x=-2.5 至 x=6.0)
                drawOrthogonalPipe([
                    [-2.5, 4.1, -4.0], [6.0, 4.1, -4.0]
                ], this.materials.pipeCWS);

                // 6. 從集管連接至 CH-01 冷凝器進水 (x=-2.75, y=0.54, z=0.55, Faces +X)
                // Drop at x=-2.5
                drawOrthogonalPipe([
                    [-2.5, 4.1, -4.0], [-2.5, 4.1, 0.55], [-2.5, 0.54, 0.55], [-2.75, 0.54, 0.55]
                ], this.materials.pipeCWS);

                // 7. 從集管連接至 CH-02 冷凝器進水 (x=5.25, y=0.54, z=0.55, Faces +X)
                // Drop at x=5.5
                drawOrthogonalPipe([
                    [5.5, 4.1, -4.0], [5.5, 4.1, 0.55], [5.5, 0.54, 0.55], [5.25, 0.54, 0.55]
                ], this.materials.pipeCWS);

                // ============================================================================
                // 迴路 D：冷卻水回水 CWR（深綠色）
                // ============================================================================
                // 1. CH-01 Cond Out: x=-2.75, y=0.54, z=0.85 (Flange faces +X)
                // Drop at x=-2.0
                drawOrthogonalPipe([
                    [-2.75, 0.54, 0.85], [-2.0, 0.54, 0.85], [-2.0, 4.7, 0.85], [-2.0, 4.7, -8.0]
                ], this.materials.pipeCWR);

                // 2. CH-02 Cond Out: x=5.25, y=0.54, z=0.85 (Flange faces +X)
                // Drop at x=6.0
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
                // 1. 一次側進水 (來自 Header h1)
                // Drop at z=-7.5 to avoid intersecting with outlet drop at z=-6.5
                drawOrthogonalPipe([
                    [7.0, 3.8, -11.0], [7.3, 3.8, -11.0], [7.3, 3.8, -7.5], [7.3, 1.12, -7.5], [7.3, 1.12, -8.26]
                ], this.materials.pipeCHWS);

                // 2. 一次側出水 (回流至 CHWP 出水集管)
                // Drop at z=-6.5 to pass under the inlet drop
                drawOrthogonalPipe([
                    [7.3, 0.44, -8.26], [7.3, 0.44, -6.5], [7.3, 4.4, -6.5], [7.3, 4.4, -5.0]
                ], this.materials.pipeCHWR);

`;

s = s.substring(0, pipingStartIndex) + newPipingStr + s.substring(pipingEndIndex);
console.log('✅ Refined Piping Intersections');
fs.writeFileSync(file, s, 'utf8');
