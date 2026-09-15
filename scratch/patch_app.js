const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../public/whitespace/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// The target content we want to replace
const targetContent = `                    if (rot === 0) { 
                        if (side === -1 && x < -1.2) explodeDist = -0.6; 
                        if (side === 1 && x > 1.2) explodeDist = 0.6;   
                    } else { 
                        if (side === 1 && x < -1.2) explodeDist = 0.6;   
                        if (side === -1 && x > 1.2) explodeDist = -                        // VRM 設計`;

const replacementContent = `                        if (side === -1 && x > 1.2) explodeDist = -0.6;  
                    }

                    sideGroup.userData = { isShell: true, origPos: sideGroup.position.clone(), explodeDir: new THREE.Vector3(explodeDist, 0, 0) };
                    if (explodeDist !== 0) {
                        this.explodeShells.push(sideGroup);
                    }

                    const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.015, h - 0.1, d - 0.08), rackFrame);
                    sideGroup.add(sidePanel);
                    
                    [-0.3, 0.3].forEach(cy => {
                        const clip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.015), chromeDetail);
                        clip.position.set(side * 0.005, cy, d / 2 - 0.08);
                        sideGroup.add(clip);
                    });
                    group.add(sideGroup);
                });

                const instData = {
                    trayBody: [], pcb: [], handle: [],
                    gpuPlate: [], cpuPlate: [], switchPlate: [],
                    qdcMale: [], qdcFemale: [],
                    osfpPort: [], psuModule: [], statusLed: [], ledStrip: [],
                    blankPanel: [], coldTube: [],
                    psuFanGrill: [], psuHandle: [],
                    memModule: [], vrm: [],
                };

                const pushInst = (arr, px, py, pz, sx = 1, sy = 1, sz = 1, ry = 0) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(px, py, pz);
                    dummy.scale.set(sx, sy, sz);
                    dummy.rotation.y = ry;
                    dummy.updateMatrix();
                    arr.push(dummy.dummyMatrix || dummy.matrix);
                };

                const totalU = 42;
                const uHeight = 0.0444; // 1.75 inches
                const startY = -h / 2 + 0.08;
                const trayW = w - 0.08;
                const trayD = d - 0.12;

                const isAisleA = Math.abs(z - (-1.2)) < 0.1;
                const colIdx = Math.round((x + 1.24) / 0.62);

                const isSwitchRack = colIdx === 0 || colIdx === 4;
                const isPowerRack = colIdx === 2;
                const isComputeRack = !isSwitchRack && !isPowerRack;

                for (let u = 0; u < totalU; u++) {
                    const isCompute = (u >= 4 && u <= 13) || (u >= 23 && u <= 32);
                    const isSwitch = (u >= 14 && u <= 22);
                    if (!isCompute && !isSwitch) continue;

                    const ty = startY + u * uHeight;

                    if (isCompute) {
                        pushInst(instData.trayBody, 0, ty, 0, trayW, uHeight * 0.85, trayD);
                        
                        // 前端把手
                        pushInst(instData.handle, -trayW / 2 + 0.03, ty, -trayD / 2 - 0.015, 0.015, uHeight * 0.4, 0.03);
                        pushInst(instData.handle, trayW / 2 - 0.03, ty, -trayD / 2 - 0.015, 0.015, uHeight * 0.4, 0.03);
                        
                        // PCB 基板
                        pushInst(instData.pcb, 0, ty - uHeight * 0.25, 0, trayW * 0.92, 0.004, trayD * 0.88);
                        
                        // Blackwell GPUs/CPUs 冷卻板 (雙晶片節點設計)
                        // GPU plates (copper)
                        [-0.1, 0.1].forEach(gx => {
                            [-0.15, -0.02].forEach(gz => {
                                pushInst(instData.gpuPlate, gx, ty, gz, 0.09, 0.015, 0.09);
                            });
                        });
                        
                        // CPU plates (copper)
                        [-0.1, 0.1].forEach(cx => {
                            pushInst(instData.cpuPlate, cx, ty, 0.18, 0.075, 0.015, 0.075);
                        });

                        // 記憶體模組
                        for (let mem = 0; mem < 16; mem++) {
                            const mx = -0.16 + (mem % 8) * 0.012 + (mem >= 8 ? 0.22 : 0);
                            const mz = mem >= 8 ? 0.22 : 0.05;
                            pushInst(instData.memModule, mx, ty + 0.005, mz, 0.005, 0.015, 0.045);
                        }

                        // VRM 設計`;

if (content.includes(targetContent)) {
    content = content.replace(targetContent, replacementContent);
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log("Successfully patched app.js!");
} else {
    console.error("Could not find target content in app.js! File might be different.");
}
