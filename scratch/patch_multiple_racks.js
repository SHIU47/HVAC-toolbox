const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../public/whitespace/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Replacement of the tray creation loop
const targetTrayLoop = `                for (let u = 0; u < totalU; u++) {
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

                        // VRM 設計
                        [-0.12, 0.12].forEach(vx => {
                            pushInst(instData.vrm, vx, ty + 0.005, -0.05, 0.08, 0.01, 0.04);
                        });

                        // 運算節點正面 (面板兩側) 明顯的 QDC 金屬盲插接頭
                        pushInst(instData.qdcMale, -trayW / 2 + 0.035, ty, trayD / 2 + 0.015, 0.022, 0.022, 0.06);
                        pushInst(instData.qdcMale, trayW / 2 - 0.035, ty, trayD / 2 + 0.015, 0.022, 0.022, 0.06);

                        // 後方液冷盲插接頭 (配合 Manifold) - 移至後方 (trayD / 2 + 0.008)
                        const qdcZ_Male = trayD / 2 + 0.008;
                        const qdcZ_Female = trayD / 2 + 0.035;
                        [-0.13, 0.13].forEach(qx => {
                            pushInst(instData.qdcMale, qx, ty, qdcZ_Male, 0.018, 0.018, 0.035);
                            pushInst(instData.qdcFemale, qx, ty, qdcZ_Female, 0.022, 0.022, 0.035);
                        });

                        // 冷卻板水管連接
                        [-0.15, -0.05, 0.05, 0.15].forEach(tx => {
                            pushInst(instData.coldTube, tx, ty + 0.01, 0.05, 0.006, 0.006, 0.38);
                        });
                    }
                    else if (isSwitch) {
                        pushInst(instData.pcb, 0, ty - uHeight * 0.25, 0, trayW * 0.92, 0.004, trayD * 0.88);
                        
                        // 大型 NVSwitch 核心晶片 (取代原本長條 SwitchPlate)
                        pushInst(instData.switchPlate, 0, ty, 0, trayW * 0.5, 0.015, 0.35);

                        // NVSwitch 正面面板高密度 OSFP 接口陣列 (排 24 個金屬方塊)
                        for (let port = 0; port < 24; port++) {
                            const px = -trayW / 2 + 0.03 + port * 0.018;
                            pushInst(instData.osfpPort, px, ty, trayD / 2 + 0.005, 0.012, uHeight * 0.35, 0.025);
                        }
                        
                        // 正面面板 NVIDIA 綠色飾條
                        pushInst(instData.ledStrip, 0, ty + uHeight * 0.35, trayD / 2 + 0.008, trayW * 0.92, 0.003, 0.002);

                        // 其他晶片輔助冷卻板
                        [-0.16, 0.16].forEach(sx => {
                            pushInst(instData.cpuPlate, sx, ty, -0.2, 0.04, 0.012, 0.06);
                            pushInst(instData.cpuPlate, sx, ty, 0.25, 0.04, 0.012, 0.06);
                        });
                        
                        // 後方液冷盲插接頭 (配合 Manifold) - 移至後方
                        const qdcZ_Male = trayD / 2 + 0.008;
                        const qdcZ_Female = trayD / 2 + 0.035;
                        [-0.13, 0.13].forEach(qx => {
                            pushInst(instData.qdcMale, qx, ty, qdcZ_Male, 0.018, 0.018, 0.035);
                            pushInst(instData.qdcFemale, qx, ty, qdcZ_Female, 0.022, 0.022, 0.035);
                        });

                        pushInst(instData.coldTube, -0.16, ty + 0.01, 0.025, 0.005, 0.005, 0.38);
                        pushInst(instData.coldTube, 0.16, ty + 0.01, 0.025, 0.005, 0.005, 0.38);
                    }
                }`;

const replacementTrayLoop = `                for (let u = 0; u < totalU; u++) {
                    const ty = startY + u * uHeight;

                    if (isComputeRack) {
                        // 18 compute trays from u = 3 to 20
                        if (u >= 3 && u <= 20) {
                            pushInst(instData.trayBody, 0, ty, 0, trayW, uHeight * 1.8, trayD);
                            
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

                            // VRM 設計
                            [-0.12, 0.12].forEach(vx => {
                                pushInst(instData.vrm, vx, ty + 0.005, -0.05, 0.08, 0.01, 0.04);
                            });

                            // 運算節點正面 (面板兩側) 明顯的 QDC 金屬盲插接頭
                            pushInst(instData.qdcMale, -trayW / 2 + 0.035, ty, trayD / 2 + 0.015, 0.022, 0.022, 0.06);
                            pushInst(instData.qdcMale, trayW / 2 - 0.035, ty, trayD / 2 + 0.015, 0.022, 0.022, 0.06);

                            // 後方液冷盲插接頭 (配合 Manifold) - 移至後方 (trayD / 2 + 0.008)
                            const qdcZ_Male = trayD / 2 + 0.008;
                            const qdcZ_Female = trayD / 2 + 0.035;
                            [-0.13, 0.13].forEach(qx => {
                                pushInst(instData.qdcMale, qx, ty, qdcZ_Male, 0.018, 0.018, 0.035);
                                pushInst(instData.qdcFemale, qx, ty, qdcZ_Female, 0.022, 0.022, 0.035);
                            });

                            // 冷卻板水管連接
                            [-0.15, -0.05, 0.05, 0.15].forEach(tx => {
                                pushInst(instData.coldTube, tx, ty + 0.01, 0.05, 0.006, 0.006, 0.38);
                            });
                        } else {
                            // Blanking panel for empty slots
                            pushInst(instData.blankPanel, 0, ty, -trayD/2 - 0.002, trayW, uHeight * 0.9, 0.01);
                        }
                    }
                    else if (isPowerRack) {
                        // PSU Shelves (2U each) at u = 4, 12, 20
                        if (u === 4 || u === 12 || u === 20) {
                            // Draw 6 PSU modules side by side
                            for (let p = 0; p < 6; p++) {
                                const px = -trayW/2 + 0.04 + p * (trayW - 0.08)/5;
                                pushInst(instData.psuModule, px, ty, 0, 0.06, uHeight * 1.6, trayD * 0.95);
                                pushInst(instData.psuFanGrill, px, ty, -trayD/2 - 0.002, 0.05, uHeight * 1.5, 0.005);
                                pushInst(instData.psuHandle, px - 0.02, ty, -trayD/2 - 0.005, 0.008, uHeight * 1.0, 0.01);
                                pushInst(instData.statusLed, px + 0.02, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                            }
                        }
                        // BBU Shelves (2U each) at u = 8, 16, 24
                        else if (u === 8 || u === 16 || u === 24) {
                            // Draw 4 Battery packs side by side
                            for (let b = 0; b < 4; b++) {
                                const bx = -trayW/2 + 0.05 + b * (trayW - 0.1)/3;
                                pushInst(instData.trayBody, bx, ty, 0, 0.1, uHeight * 1.6, trayD * 0.9);
                                pushInst(instData.statusLed, bx, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                            }
                        }
                        // Other slots have blanking panels
                        else {
                            pushInst(instData.blankPanel, 0, ty, -trayD/2 - 0.002, trayW, uHeight * 0.9, 0.01);
                        }
                    }
                    else if (isSwitchRack) {
                        // 9 Switch Trays at u = 6, 8, 10, 12, 14, 16, 18, 20, 22
                        if (u >= 6 && u <= 22 && u % 2 === 0) {
                            pushInst(instData.trayBody, 0, ty, 0, trayW, uHeight * 1.8, trayD);
                            
                            // NVSwitch ports (24 ports)
                            for (let port = 0; port < 24; port++) {
                                const px = -trayW / 2 + 0.03 + port * (trayW - 0.06)/23;
                                pushInst(instData.osfpPort, px, ty, -trayD / 2 - 0.005, 0.012, uHeight * 0.35, 0.025);
                            }
                            
                            // NVIDIA Green strip
                            pushInst(instData.ledStrip, 0, ty + uHeight * 0.35, -trayD / 2 - 0.008, trayW * 0.92, 0.003, 0.002);
                            
                            // 晶片冷卻板
                            [-0.16, 0.16].forEach(sx => {
                                pushInst(instData.cpuPlate, sx, ty, -0.15, 0.06, 0.015, 0.06);
                                pushInst(instData.cpuPlate, sx, ty, 0.15, 0.06, 0.015, 0.06);
                            });
                            
                            // 後方 QDCs (Switch 也用水冷)
                            const qdcZ_Male = trayD / 2 + 0.008;
                            const qdcZ_Female = trayD / 2 + 0.035;
                            [-0.13, 0.13].forEach(qx => {
                                pushInst(instData.qdcMale, qx, ty, qdcZ_Male, 0.018, 0.018, 0.035);
                                pushInst(instData.qdcFemale, qx, ty, qdcZ_Female, 0.022, 0.022, 0.035);
                            });

                            pushInst(instData.coldTube, -0.16, ty + 0.01, 0.0, 0.005, 0.005, 0.3);
                            pushInst(instData.coldTube, 0.16, ty + 0.01, 0.0, 0.005, 0.005, 0.3);
                        } else {
                            // Blanking panels
                            pushInst(instData.blankPanel, 0, ty, -trayD/2 - 0.002, trayW, uHeight * 0.9, 0.01);
                        }
                    }
                }`;

// 2. Replacement of the manifolds, vertical ropes, and troughs
const targetManifoldSection = `                // ==========================================
                // 5. 盲插歧管 (Blind-Mate Manifold) + 避讓群組
                // ==========================================
                const spineH = totalU * uHeight;

                // 新增避讓群組：將機櫃背後的管路全數裝進來，爆炸時往熱通道側(正Z方向)退讓
                const rackPipingGroup = new THREE.Group();
                rackPipingGroup.userData = { 
                    isShell: true, 
                    origPos: new THREE.Vector3(0, 0, 0), 
                    explodeDir: new THREE.Vector3(0, 0, 0.8) // 往機櫃背後退開 0.8 米 (正Z方向)
                };
                this.explodeShells.push(rackPipingGroup);
                group.add(rackPipingGroup);

                const spineGeo = new THREE.CylinderGeometry(0.028, 0.028, spineH, 16);
                const spineSupply = new THREE.Mesh(spineGeo, pipeBlueM);
                spineSupply.position.set(-0.13, 0, trayD / 2 + 0.07);
                rackPipingGroup.add(spineSupply);

                const spineReturn = new THREE.Mesh(spineGeo, pipeRedM);
                spineReturn.position.set(0.13, 0, trayD / 2 + 0.07);
                rackPipingGroup.add(spineReturn);

                const insulGeo = new THREE.CylinderGeometry(0.035, 0.035, spineH, 16);
                const insulMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, transparent: true, opacity: 0.4, roughness: 1.0 });
                const insulS = new THREE.Mesh(insulGeo, insulMat);
                insulS.position.copy(spineSupply.position);
                rackPipingGroup.add(insulS);
                const insulR = new THREE.Mesh(insulGeo, insulMat);
                insulR.position.copy(spineReturn.position);
                rackPipingGroup.add(insulR);

                for (let u = 0; u < totalU; u++) {
                    const isCompute = (u >= 4 && u <= 13) || (u >= 23 && u <= 32);
                    const isSwitch = (u >= 14 && u <= 22);
                    if (!isCompute && !isSwitch) continue;

                    const branchY = startY + u * uHeight;
                    const branchLength = 0.06;

                    const bSupply = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeBlueM);
                    bSupply.rotation.x = Math.PI / 2;
                    bSupply.position.set(-0.13, branchY, trayD / 2 + 0.04);
                    rackPipingGroup.add(bSupply);

                    const bReturn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeRedM);
                    bReturn.rotation.x = Math.PI / 2;
                    bReturn.position.set(0.13, branchY, trayD / 2 + 0.04);
                    rackPipingGroup.add(bReturn);
                }

                [-0.13, 0.13].forEach((fx, idx) => {
                    const fl = createFlange(0.04, 0.015, 4);
                    fl.position.set(fx, spineH / 2 + 0.01, trayD / 2 + 0.07);
                    rackPipingGroup.add(fl);
                    const barb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 12), chromeDetail);
                    barb.position.set(fx, spineH / 2 + 0.04, trayD / 2 + 0.07);
                    rackPipingGroup.add(barb);
                    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x3b82f6 : 0xef4444 }));
                    band.position.set(fx, spineH / 2 + 0.025, trayD / 2 + 0.07);
                    rackPipingGroup.add(band);
                });

                [-0.13, 0.13].forEach(fx => {
                    const drainValve = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }));
                    drainValve.position.set(fx, -spineH / 2 - 0.01, trayD / 2 + 0.07);
                    rackPipingGroup.add(drainValve);
                });

                const dripTray = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.015, d - 0.06), new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5, roughness: 0.6 }));
                dripTray.position.set(0, -h / 2 + 0.05, 0);
                group.add(dripTray);

                [
                    [0, 0, d / 2 - 0.04, w - 0.04, 0.02, 0.01],
                    [0, 0, -d / 2 + 0.04, w - 0.04, 0.02, 0.01],
                    [-w / 2 + 0.03, 0, 0, 0.01, 0.02, d - 0.06],
                    [w / 2 - 0.03, 0, 0, 0.01, 0.02, d - 0.06],
                ].forEach(r => {
                    const rim = new THREE.Mesh(new THREE.BoxGeometry(r[3], r[4], r[5]), new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5 }));
                    rim.position.set(r[0], -h / 2 + 0.06, r[2]);
                    group.add(rim);
                });

                const leakRope = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), leakSensor);
                leakRope.rotation.z = Math.PI / 2;
                leakRope.position.set(0, -h / 2 + 0.055, trayD / 2 + 0.07);
                rackPipingGroup.add(leakRope);

                const leakController = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), leakSensor);
                leakController.position.set(0.2, -h / 2 + 0.08, trayD / 2 + 0.07);
                rackPipingGroup.add(leakController);

                // 把垂直走線槽也歸入背板避讓群組
                [-w / 2 + 0.03, w / 2 - 0.03].forEach(cx => {
                    const cableTrough = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.7, 0.04), darkMetal);
                    cableTrough.position.set(cx, 0.1, d / 2 - 0.06);
                    rackPipingGroup.add(cableTrough);
                    for (let ring = 0; ring < 6; ring++) {
                        const cableRing = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 6, 12), darkMetal);
                        cableRing.rotation.y = Math.PI / 2;
                        cableRing.position.set(cx, -0.3 + ring * 0.15, d / 2 - 0.06);
                        rackPipingGroup.add(cableRing);
                    }
                });`;

const replacementManifoldSection = `                // ==========================================
                // 5. 盲插歧管 (Blind-Mate Manifold) + 避讓群組
                // ==========================================
                const spineH = totalU * uHeight;

                if (!isPowerRack) {
                    const rackPipingGroup = new THREE.Group();
                    rackPipingGroup.userData = { 
                        isShell: true, 
                        origPos: new THREE.Vector3(0, 0, 0), 
                        explodeDir: new THREE.Vector3(0, 0, 0.8) // 往機櫃背後退開 0.8 米 (正Z方向)
                    };
                    this.explodeShells.push(rackPipingGroup);
                    group.add(rackPipingGroup);

                    const spineGeo = new THREE.CylinderGeometry(0.028, 0.028, spineH, 16);
                    const spineSupply = new THREE.Mesh(spineGeo, pipeBlueM);
                    spineSupply.position.set(-0.13, 0, trayD / 2 + 0.07);
                    rackPipingGroup.add(spineSupply);

                    const spineReturn = new THREE.Mesh(spineGeo, pipeRedM);
                    spineReturn.position.set(0.13, 0, trayD / 2 + 0.07);
                    rackPipingGroup.add(spineReturn);

                    const insulGeo = new THREE.CylinderGeometry(0.035, 0.035, spineH, 16);
                    const insulMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, transparent: true, opacity: 0.4, roughness: 1.0 });
                    const insulS = new THREE.Mesh(insulGeo, insulMat);
                    insulS.position.copy(spineSupply.position);
                    rackPipingGroup.add(insulS);
                    const insulR = new THREE.Mesh(insulGeo, insulMat);
                    insulR.position.copy(spineReturn.position);
                    rackPipingGroup.add(insulR);

                    for (let u = 0; u < totalU; u++) {
                        const isCompute = isComputeRack && (u >= 3 && u <= 20);
                        const isSwitch = isSwitchRack && (u >= 6 && u <= 22 && u % 2 === 0);
                        if (!isCompute && !isSwitch) continue;

                        const branchY = startY + u * uHeight;
                        const branchLength = 0.06;

                        const bSupply = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeBlueM);
                        bSupply.rotation.x = Math.PI / 2;
                        bSupply.position.set(-0.13, branchY, trayD / 2 + 0.04);
                        rackPipingGroup.add(bSupply);

                        const bReturn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeRedM);
                        bReturn.rotation.x = Math.PI / 2;
                        bReturn.position.set(0.13, branchY, trayD / 2 + 0.04);
                        rackPipingGroup.add(bReturn);
                    }

                    [-0.13, 0.13].forEach((fx, idx) => {
                        const fl = createFlange(0.04, 0.015, 4);
                        fl.position.set(fx, spineH / 2 + 0.01, trayD / 2 + 0.07);
                        rackPipingGroup.add(fl);
                        const barb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 12), chromeDetail);
                        barb.position.set(fx, spineH / 2 + 0.04, trayD / 2 + 0.07);
                        rackPipingGroup.add(barb);
                        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x3b82f6 : 0xef4444 }));
                        band.position.set(fx, spineH / 2 + 0.025, trayD / 2 + 0.07);
                        rackPipingGroup.add(band);
                    });

                    [-0.13, 0.13].forEach(fx => {
                        const drainValve = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }));
                        drainValve.position.set(fx, -spineH / 2 - 0.01, trayD / 2 + 0.07);
                        rackPipingGroup.add(drainValve);
                    });

                    const leakRope = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), leakSensor);
                    leakRope.rotation.z = Math.PI / 2;
                    leakRope.position.set(0, -h / 2 + 0.055, trayD / 2 + 0.07);
                    rackPipingGroup.add(leakRope);

                    const leakController = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), leakSensor);
                    leakController.position.set(0.2, -h / 2 + 0.08, trayD / 2 + 0.07);
                    rackPipingGroup.add(leakController);
                }

                // Power Rack 重點特色：背後重型銅排 Busbar
                if (isPowerRack) {
                    const busbarW = 0.015, busbarH = h - 0.1, busbarD = 0.03;
                    [-0.15, 0, 0.15].forEach(bx => {
                        const busbar = new THREE.Mesh(new THREE.BoxGeometry(busbarW, busbarH, busbarD), this.materials.copperDetail || copperTube);
                        busbar.position.set(bx, 0, trayD / 2 - 0.02);
                        group.add(busbar);
                    });
                }

                // Switch/Transmission Rack 重點特色：前端密集光纖繞線
                if (isSwitchRack) {
                    const fiberMatBlue = new THREE.LineBasicMaterial({ color: 0x0ea5e9 });
                    const fiberMatGreen = new THREE.LineBasicMaterial({ color: 0x22c55e });
                    
                    for (let u = 6; u <= 22; u += 2) {
                        const ty = startY + u * uHeight;
                        [-0.18, -0.06, 0.06, 0.18].forEach((fx, idx) => {
                            const start = new THREE.Vector3(fx, ty, -trayD/2 - 0.01);
                            const side = fx < 0 ? -1 : 1;
                            const end = new THREE.Vector3(side * (w/2 - 0.02), ty - 0.04, -d/2 + 0.15 + idx * 0.05);
                            const control = new THREE.Vector3(fx + side * 0.05, ty, -trayD/2 - 0.08);
                            
                            const curve = new THREE.QuadraticBezierCurve3(start, control, end);
                            const points = curve.getPoints(8);
                            const fiberGeo = new THREE.BufferGeometry().setFromPoints(points);
                            const fiberLine = new THREE.Line(fiberGeo, idx % 2 === 0 ? fiberMatBlue : fiberMatGreen);
                            group.add(fiberLine);
                        });
                    }
                }

                const dripTray = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.015, d - 0.06), new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5, roughness: 0.6 }));
                dripTray.position.set(0, -h / 2 + 0.05, 0);
                group.add(dripTray);

                [
                    [0, 0, d / 2 - 0.04, w - 0.04, 0.02, 0.01],
                    [0, 0, -d / 2 + 0.04, w - 0.04, 0.02, 0.01],
                    [-w / 2 + 0.03, 0, 0, 0.01, 0.02, d - 0.06],
                    [w / 2 - 0.03, 0, 0, 0.01, 0.02, d - 0.06],
                ].forEach(r => {
                    const rim = new THREE.Mesh(new THREE.BoxGeometry(r[3], r[4], r[5]), new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5 }));
                    rim.position.set(r[0], -h / 2 + 0.06, r[2]);
                    group.add(rim);
                });

                // 把垂直走線槽也歸入背板避讓群組
                const cableParentGroup = isPowerRack ? group : (group.getObjectByName("rackPipingGroup") || group.children[group.children.length - 2] || group); // Safe fallback
                // Note: since we added rackPipingGroup only for non-power racks, let's use a specific group:
                const targetCableGroup = isPowerRack ? group : (group.children.find(c => c.userData && c.userData.explodeDir) || group);

                [-w / 2 + 0.03, w / 2 - 0.03].forEach(cx => {
                    const cableTrough = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.7, 0.04), darkMetal);
                    cableTrough.position.set(cx, 0.1, d / 2 - 0.06);
                    targetCableGroup.add(cableTrough);
                    for (let ring = 0; ring < 6; ring++) {
                        const cableRing = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 6, 12), darkMetal);
                        cableRing.rotation.y = Math.PI / 2;
                        cableRing.position.set(cx, -0.3 + ring * 0.15, d / 2 - 0.06);
                        targetCableGroup.add(cableRing);
                    }
                });`;

// 3. Skip Power Racks in buildPiping vertical drop creation
const targetPipingLoop = `                const xs = [-1.24, -0.62, 0, 0.62, 1.24];
                xs.forEach(x => {
                    // Rack A (z = -1.2, rot = 0)`;

const replacementPipingLoop = `                const xs = [-1.24, -0.62, 0, 0.62, 1.24];
                xs.forEach(x => {
                    if (x === 0) return; // 跳過 Power Rack (無水冷管路)
                    // Rack A (z = -1.2, rot = 0)`;

// Execute replacements
let matches = 0;
if (content.includes(targetTrayLoop)) {
    content = content.replace(targetTrayLoop, replacementTrayLoop);
    matches++;
} else {
    console.error("targetTrayLoop not found!");
}

if (content.includes(targetManifoldSection)) {
    content = content.replace(targetManifoldSection, replacementManifoldSection);
    matches++;
} else {
    console.error("targetManifoldSection not found!");
}

if (content.includes(targetPipingLoop)) {
    content = content.replace(targetPipingLoop, replacementPipingLoop);
    matches++;
} else {
    console.error("targetPipingLoop not found!");
}

if (matches === 3) {
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log("Successfully updated app.js with specialized rack configurations!");
} else {
    console.error(`Failed to apply some patches. Match count: ${matches}`);
}
