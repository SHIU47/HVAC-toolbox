/**
 * createRack(x, y, z, rot, name)
 * 
 * This is the GPU Rack / Cabinet module extracted from c:\Users\30468\Desktop\whitespace\app.js.
 * Feel free to refine/elaborate/modify this code. When you are done, send it back and I will 
 * replace the original function in app.js with your modified version.
 * 
 * Note on dependencies inside the DTC object:
 * - `this.materials`: Standard materials used throughout the scene (e.g. copperDetail, pcbGreen, chromeDetail, darkMetal, goldPin, ledGreen, rubberBlack, blankingPanel, copperTube, leakSensor, blueHose, redHose, blueCollar, redCollar, brassDetail, rackFrame, meshDoor, pipeBlueM, pipeRedM).
 * - `this.explodeShells`: Array to push meshes that are part of the exploded view.
 * - `this.rackFrontDoors`: Array to push door groups for the door toggle animation.
 * - `this.explodeInstancedMeshes`: Array to push instanced meshes that are part of the exploded view.
 * - `this.coldPlateCfdGroups`: Array to push CFD visualization groups.
 * - `this.interactables`: Array to push meshes for click interaction/detection.
 * - `this.scene`: The main Three.js Scene object.
 */
function createRack(x, y, z, rot, name) {
    const w = 0.6, h = 2.2, d = 1.2;
    const group = new THREE.Group();
    group.position.set(x, h / 2, z);
    group.rotation.y = rot;
    group.userData = { type: 'Rack', name: name };
    if (!this.materials.copperDetail) {
        this.materials.copperDetail = new THREE.MeshStandardMaterial({ color: 0xd27d2d, metalness: 0.9, roughness: 0.15 }); // Genuine copper
        this.materials.pcbGreen = new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.9 }); // Clear PCB green
        this.materials.chromeDetail = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
        this.materials.darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.6 });
        this.materials.goldPin = new THREE.MeshStandardMaterial({ color: 0xfbb034, metalness: 1.0, roughness: 0.1 });
        this.materials.ledGreen = new THREE.MeshBasicMaterial({ color: 0x76b900 });
        this.materials.rubberBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.0 });
        this.materials.blankingPanel = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.8 });
        this.materials.copperTube = new THREE.MeshStandardMaterial({ color: 0xc47e4a, metalness: 0.85, roughness: 0.25 });
        this.materials.leakSensor = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.4, roughness: 0.5 });
        this.materials.blueHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 }); // Black braided hose (dark charcoal gray)
        this.materials.redHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 }); // Black braided hose (dark charcoal gray)
        this.materials.blueCollar = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.8, roughness: 0.2 }); // Blue collar (supply)
        this.materials.redCollar = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 }); // Red collar (return)
        this.materials.brassDetail = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 }); // Brass fittings
    }

    const {
        copperDetail, pcbGreen, chromeDetail, darkMetal, goldPin, ledGreen,
        rackFrame, meshDoor, pipeBlueM, pipeRedM,
        rubberBlack, blankingPanel, copperTube, leakSensor
    } = this.materials;

    const createFlange = (radius, thickness, boltCount = 4) => {
        const fg = new THREE.Group();
        fg.add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 20), chromeDetail));
        for (let i = 0; i < boltCount; i++) {
            const angle = (i / boltCount) * Math.PI * 2;
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, thickness + 0.008, 6), darkMetal);
            bolt.position.set(Math.cos(angle) * radius * 0.7, 0, Math.sin(angle) * radius * 0.7);
            fg.add(bolt);
        }
        return fg;
    };

    // 機櫃骨架
    const t = 0.04;
    const frameGeoV = new THREE.BoxGeometry(t, h, t);
    const corners = [
        [-w / 2 + t / 2, d / 2 - t / 2], [w / 2 - t / 2, d / 2 - t / 2],
        [-w / 2 + t / 2, -d / 2 + t / 2], [w / 2 - t / 2, -d / 2 + t / 2]
    ];
    corners.forEach(pos => {
        const post = new THREE.Mesh(frameGeoV, rackFrame);
        post.position.set(pos[0], 0, pos[1]);
        group.add(post);
    });

    const hBraceGeo = new THREE.BoxGeometry(w - t * 2, 0.02, 0.02);
    const dBraceGeo = new THREE.BoxGeometry(0.02, 0.02, d - t * 2);
    const braceHeights = [-h / 2 + 0.06, -0.3, 0.3, h / 2 - 0.06];
    braceHeights.forEach(by => {
        [d / 2 - t / 2, -d / 2 + t / 2].forEach(bz => {
            const brace = new THREE.Mesh(hBraceGeo, rackFrame);
            brace.position.set(0, by, bz);
            group.add(brace);
        });
        if (Math.abs(by) > 0.5) {
            [-w / 2 + t / 2, w / 2 - t / 2].forEach(bx => {
                const brace = new THREE.Mesh(dBraceGeo, rackFrame);
                brace.position.set(bx, by, 0);
                group.add(brace);
            });
        }
    });

    const eiaGeo = new THREE.BoxGeometry(0.018, h - 0.12, 0.025);
    const eiaPositions = [
        [-w / 2 + 0.05, d / 2 - 0.06], [w / 2 - 0.05, d / 2 - 0.06],
        [-w / 2 + 0.05, -d / 2 + 0.06], [w / 2 - 0.05, -d / 2 + 0.06],
    ];
    eiaPositions.forEach(pos => {
        const eiaPost = new THREE.Mesh(eiaGeo, chromeDetail);
        eiaPost.position.set(pos[0], 0, pos[1]);
        group.add(eiaPost);
        for (let hole = 0; hole < 42 * 3; hole++) {
            if (hole % 6 !== 0) continue;
            const holeY = -h / 2 + 0.12 + hole * ((h - 0.15) / (42 * 3));
            const holeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.003), darkMetal);
            holeMesh.position.set(pos[0], holeY, pos[1] + 0.013);
            group.add(holeMesh);
        }
    });

    // 機櫃頂板 (加入爆炸拆解清單)
    const topCoverGroup = new THREE.Group();
    topCoverGroup.position.y = h / 2;
    topCoverGroup.userData = { isShell: true, origPos: topCoverGroup.position.clone(), explodeDir: new THREE.Vector3(0, 2.8, 0) };
    this.explodeShells.push(topCoverGroup);

    const topCover = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), rackFrame);
    topCoverGroup.add(topCover);

    group.add(topCoverGroup);

    const botCover = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d + 0.04), rackFrame);
    botCover.position.y = -h / 2;
    group.add(botCover);

    const casterPositions = [
        [-w / 2 + 0.08, -d / 2 + 0.1], [w / 2 - 0.08, -d / 2 + 0.1],
        [-w / 2 + 0.08, d / 2 - 0.1], [w / 2 - 0.08, d / 2 - 0.1]
    ];
    casterPositions.forEach((cp, idx) => {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), darkMetal);
        bracket.position.set(cp[0], -h / 2 - 0.02, cp[1]);
        group.add(bracket);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12), rubberBlack);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(cp[0], -h / 2 - 0.045, cp[1]);
        group.add(wheel);
        if (idx < 2) {
            const brake = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.01), chromeDetail);
            brake.position.set(cp[0] + 0.02, -h / 2 - 0.035, cp[1]);
            group.add(brake);
        }
    });

    casterPositions.forEach(cp => {
        const footBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), chromeDetail);
        footBolt.position.set(cp[0], -h / 2 - 0.03, cp[1]);
        group.add(footBolt);
        const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.008, 12), rubberBlack);
        footPad.position.set(cp[0], -h / 2 - 0.06, cp[1]);
        group.add(footPad);
    });

    // 前門
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-w / 2 + 0.02, 0, -d / 2 - 0.01);

    const doorContent = new THREE.Group();
    doorContent.position.set(w / 2 - 0.02, 0, 0.01);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.12, 0.02), rackFrame);
    doorContent.add(doorFrame);
    const meshPanel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.2), meshDoor);
    meshPanel.position.z = -0.011; 
    meshPanel.rotation.y = Math.PI; 
    doorContent.add(meshPanel);
    const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 0.03), chromeDetail);
    handleBar.position.set(w / 2 - 0.04, 0, -0.02);
    doorContent.add(handleBar);
    const lockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 12), darkMetal);
    lockBody.rotation.x = Math.PI / 2;
    lockBody.position.set(w / 2 - 0.04, -0.15, -0.02);
    doorContent.add(lockBody);
    const lockSlot = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.01, 0.005), chromeDetail);
    lockSlot.position.set(w / 2 - 0.04, -0.15, -0.028);
    doorContent.add(lockSlot);
    doorGroup.add(doorContent);

    [-0.35, 0, 0.35].forEach(hy => {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), darkMetal);
        hinge.position.set(0, hy, 0);
        doorGroup.add(hinge);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6), chromeDetail);
        pin.position.set(0, hy, 0);
        doorGroup.add(pin);
    });

    group.add(doorGroup);
    if (!this.rackFrontDoors) this.rackFrontDoors = [];
    this.rackFrontDoors.push(doorGroup);

    // 機櫃側板 (加入爆炸拆解清單 - 僅最外側機櫃側板會作動)
    [-1, 1].forEach(side => {
        const sideGroup = new THREE.Group();
        sideGroup.position.set(side * (w / 2), 0, 0);
        
        let explodeDist = 0;
        if (rot === 0) { 
            if (side === -1 && x < -1.2) explodeDist = -0.6; 
            if (side === 1 && x > 1.2) explodeDist = 0.6;   
        } else { 
            if (side === 1 && x < -1.2) explodeDist = 0.6;   
            if (side === -1 && x > 1.2) explodeDist = -0.6;  
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
        trayBody: [], trayBottom: [], pcb: [], handle: [],
        gpuPlate: [], cpuPlate: [], switchPlate: [],
        plateCover: [], fittings: [],
        qdcMale: [], qdcFemale: [],
        osfpPort: [], psuModule: [], statusLed: [], ledStrip: [],
        blankPanel: [], coldTube: [], coldTubeBlue: [], coldTubeRed: [],
        hoseCollarBlue: [], hoseCollarRed: [],
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

    const totalU = 48;
    const uHeight = 0.0444; // 1.75 inches
    const startY = -h / 2 + 0.08;
    const trayW = w - 0.08;
    const trayD = d - 0.12;

    // 用最小距離尋找對應的 12 個位置 index
    const xs = [-3.41, -2.79, -2.17, -1.55, -0.93, -0.31, 0.31, 0.93, 1.55, 2.17, 2.79, 3.41];
    let colIdx = 0;
    let minDist = 999;
    xs.forEach((px, idx) => {
        const dDist = Math.abs(x - px);
        if (dDist < minDist) {
            minDist = dDist;
            colIdx = idx;
        }
    });

    const isSwitchRack = colIdx === 0 || colIdx === 1 || colIdx === 10 || colIdx === 11;
    const isPowerRack = colIdx === 2 || colIdx === 9;
    const isComputeRack = !isSwitchRack && !isPowerRack;

    for (let u = 0; u < totalU; u++) {
        const ty = startY + u * uHeight;

        if (isComputeRack) {
            // U1 to U3 (u=0,1,2): Power Shelves in Compute Rack
            if (u === 0 || u === 1 || u === 2) {
                for (let p = 0; p < 4; p++) {
                    const px = -trayW/2 + 0.05 + p * (trayW - 0.1)/3;
                    pushInst(instData.psuModule, px, ty, 0, 0.06, uHeight * 0.9, trayD * 0.95);
                    pushInst(instData.psuFanGrill, px, ty, -trayD/2 - 0.002, 0.05, uHeight * 0.8, 0.005);
                    pushInst(instData.psuHandle, px - 0.02, ty, -trayD/2 - 0.005, 0.008, uHeight * 0.6, 0.01);
                    pushInst(instData.statusLed, px + 0.02, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                }
            }
            // U4 to U12 (u=3 to 11): 9x NVLink Switch trays
            else if (u >= 3 && u <= 11) {
                // Open tray: Thin faceplate at front + bottom support sheet
                pushInst(instData.trayBody, 0, ty, -trayD / 2 + 0.005, trayW, uHeight * 0.9, 0.01);
                pushInst(instData.trayBottom, 0, ty - 0.002, 0, trayW * 0.96, 0.004, trayD * 0.98);

                for (let port = 0; port < 24; port++) {
                    const px = -trayW / 2 + 0.03 + port * (trayW - 0.06)/23;
                    pushInst(instData.osfpPort, px, ty, -trayD / 2 - 0.005, 0.012, uHeight * 0.35, 0.025);
                }
                pushInst(instData.ledStrip, 0, ty + uHeight * 0.35, -trayD / 2 - 0.008, trayW * 0.92, 0.003, 0.002);
                [-0.16, 0.16].forEach(sx => {
                    pushInst(instData.cpuPlate, sx, ty, -0.15, 0.06, 0.012, 0.06);
                    pushInst(instData.cpuPlate, sx, ty, 0.15, 0.06, 0.012, 0.06);
                });
                pushInst(instData.coldTube, -0.16, ty + 0.006, 0.0, 0.005, 0.005, 0.3);
                pushInst(instData.coldTube, 0.16, ty + 0.006, 0.0, 0.005, 0.005, 0.3);
            }
            // U13 to U48 (u=12 to 47): 18x Blackwell Compute trays (2U each)
            else if (u >= 12 && u <= 47 && u % 2 === 0) {                            // Open tray: Thin faceplate at front + bottom support sheet
                pushInst(instData.trayBody, 0, ty + uHeight * 0.5, -trayD / 2 + 0.005, trayW, uHeight * 1.8, 0.01);
                pushInst(instData.trayBottom, 0, ty + 0.002, 0, trayW * 0.96, 0.004, trayD * 0.98);

                // Pull-out handles on the faceplate
                pushInst(instData.handle, -trayW / 2 + 0.03, ty + uHeight * 0.5, -trayD / 2 - 0.015, 0.015, uHeight * 0.8, 0.03);
                pushInst(instData.handle, trayW / 2 - 0.03, ty + uHeight * 0.5, -trayD / 2 - 0.015, 0.015, uHeight * 0.8, 0.03);

                // Faceplate detailed networking ports (representing high-density networking cables)
                for (let p = 0; p < 8; p++) {
                    const px = -0.1 + p * 0.025;
                    pushInst(instData.osfpPort, px, ty + uHeight * 0.5, -trayD / 2 - 0.002, 0.015, uHeight * 0.4, 0.01);
                }
                // Faceplate status LED (glowing green/amber)
                pushInst(instData.statusLed, -trayW / 2 + 0.05, ty + uHeight * 0.5, -trayD / 2 - 0.006, 0.006, 0.006, 0.006);

                pushInst(instData.pcb, 0, ty + uHeight * 0.25, 0, trayW * 0.92, 0.004, trayD * 0.88);
                // Central copper power crossover busbar on the PCB (from reference photo)
                pushInst(instData.gpuPlate, 0, ty + uHeight * 0.25 + 0.005, 0.05, 0.03, 0.008, 0.08);

                [-0.1, 0.1].forEach(gx => {
                    [-0.15, -0.02].forEach(gz => {
                        // Base copper plate (thin)
                        pushInst(instData.gpuPlate, gx, ty + uHeight * 0.5 - 0.004, gz, 0.09, 0.006, 0.09);
                        // Shiny silver/nickel cover (revealing copper base edge)
                        pushInst(instData.plateCover, gx, ty + uHeight * 0.5 + 0.003, gz, 0.086, 0.006, 0.086);
                        // Two silver connector fittings on top
                        pushInst(instData.fittings, gx - 0.022, ty + uHeight * 0.5 + 0.012, gz, 0.006, 0.012, 0.006);
                        pushInst(instData.fittings, gx + 0.022, ty + uHeight * 0.5 + 0.012, gz, 0.006, 0.012, 0.006);
                        // Transverse copper heat pipe detail (from reference photo)
                        pushInst(instData.coldTube, gx, ty + uHeight * 0.5 + 0.008, gz, 0.004, 0.004, 0.07, Math.PI / 2);
                    });
                });
                [-0.1, 0.1].forEach(cx => {
                    // Base copper plate (thin)
                    pushInst(instData.cpuPlate, cx, ty + uHeight * 0.5 - 0.004, 0.18, 0.075, 0.006, 0.075);
                    // Shiny silver/nickel cover (revealing copper base edge)
                    pushInst(instData.plateCover, cx, ty + uHeight * 0.5 + 0.003, 0.18, 0.071, 0.006, 0.071);
                    // Two silver connector fittings on top
                    pushInst(instData.fittings, cx - 0.018, ty + uHeight * 0.5 + 0.012, 0.18, 0.006, 0.012, 0.006);
                    pushInst(instData.fittings, cx + 0.018, ty + uHeight * 0.5 + 0.012, 0.18, 0.006, 0.012, 0.006);
                    // Transverse copper heat pipe detail
                    pushInst(instData.coldTube, cx, ty + uHeight * 0.5 + 0.008, 0.18, 0.004, 0.004, 0.06, Math.PI / 2);
                });
                for (let mem = 0; mem < 16; mem++) {
                    const mx = -0.16 + (mem % 8) * 0.012 + (mem >= 8 ? 0.22 : 0);
                    const mz = mem >= 8 ? 0.22 : 0.05;
                    pushInst(instData.memModule, mx, ty + uHeight * 0.5 + 0.005, mz, 0.005, 0.015, 0.045);
                }
                [-0.12, 0.12].forEach(vx => {
                    pushInst(instData.vrm, vx, ty + uHeight * 0.5 + 0.005, -0.05, 0.08, 0.01, 0.04);
                });
                pushInst(instData.qdcMale, -trayW / 2 + 0.035, ty + uHeight * 0.5, trayD / 2 + 0.015, 0.022, 0.022, 0.06);
                pushInst(instData.qdcMale, trayW / 2 - 0.035, ty + uHeight * 0.5, trayD / 2 + 0.015, 0.022, 0.022, 0.06);
                const qdcZ_Male = trayD / 2 + 0.008;
                const qdcZ_Female = trayD / 2 + 0.035;
                [-0.13, 0.13].forEach(qx => {
                    pushInst(instData.qdcMale, qx, ty + uHeight * 0.5, qdcZ_Male, 0.018, 0.018, 0.035);
                    pushInst(instData.qdcFemale, qx, ty + uHeight * 0.5, qdcZ_Female, 0.022, 0.022, 0.035);
                });
                // Color-coded supply (blue collars) and return (red collars) liquid cooling hoses (from reference photo)
                [-0.14, -0.06].forEach(tx => {
                    // Black braided hose
                    pushInst(instData.coldTubeBlue, tx, ty + uHeight * 0.5 + 0.010, 0.05, 0.006, 0.006, 0.38);
                    // Blue anodized aluminum collars at ends
                    pushInst(instData.hoseCollarBlue, tx, ty + uHeight * 0.5 + 0.010, -0.13, 0.007, 0.007, 0.015);
                    pushInst(instData.hoseCollarBlue, tx, ty + uHeight * 0.5 + 0.010, 0.23, 0.007, 0.007, 0.015);
                });
                [0.06, 0.14].forEach(tx => {
                    // Black braided hose
                    pushInst(instData.coldTubeRed, tx, ty + uHeight * 0.5 + 0.010, 0.05, 0.006, 0.006, 0.38);
                    // Red anodized aluminum collars at ends
                    pushInst(instData.hoseCollarRed, tx, ty + uHeight * 0.5 + 0.010, -0.13, 0.007, 0.007, 0.015);
                    pushInst(instData.hoseCollarRed, tx, ty + uHeight * 0.5 + 0.010, 0.23, 0.007, 0.007, 0.015);
                });
            }
        }
        else if (isPowerRack) {
            // 供電櫃填滿：交替放置供電單元與電池備援模組
            if (u % 2 === 0) {
                for (let p = 0; p < 6; p++) {
                    const px = -trayW/2 + 0.04 + p * (trayW - 0.08)/5;
                    pushInst(instData.psuModule, px, ty, 0, 0.06, uHeight * 0.9, trayD * 0.95);
                    pushInst(instData.psuFanGrill, px, ty, -trayD/2 - 0.002, 0.05, uHeight * 0.8, 0.005);
                    pushInst(instData.psuHandle, px - 0.02, ty, -trayD/2 - 0.005, 0.008, uHeight * 0.6, 0.01);
                    pushInst(instData.statusLed, px + 0.02, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                }
            } else {
                for (let b = 0; b < 4; b++) {
                    const bx = -trayW/2 + 0.05 + b * (trayW - 0.1)/3;
                    pushInst(instData.trayBody, bx, ty, 0, 0.1, uHeight * 0.9, trayD * 0.9);
                    pushInst(instData.statusLed, bx, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                }
            }
        }
        else if (isSwitchRack) {
            // Switch Racks: air-cooled, no QDC or liquid cold tubes
            if (u % 2 === 0) {
                pushInst(instData.trayBody, 0, ty + uHeight * 0.5, 0, trayW, uHeight * 1.8, trayD);
                for (let port = 0; port < 24; port++) {
                    const px = -trayW / 2 + 0.03 + port * (trayW - 0.06)/23;
                    pushInst(instData.osfpPort, px, ty + uHeight * 0.5, -trayD / 2 - 0.005, 0.012, uHeight * 0.7, 0.025);
                }
                pushInst(instData.ledStrip, 0, ty + uHeight * 1.25, -trayD / 2 - 0.008, trayW * 0.92, 0.003, 0.002);
                [-0.16, 0.16].forEach(sx => {
                    pushInst(instData.cpuPlate, sx, ty + uHeight * 0.5, -0.15, 0.06, 0.015, 0.06);
                    pushInst(instData.cpuPlate, sx, ty + uHeight * 0.5, 0.15, 0.06, 0.015, 0.06);
                });
            }
        }
    }

    const addInstMesh = (geo, mat, arr, isTrayComponent = true) => {
        if (arr.length === 0) return;
        const mesh = new THREE.InstancedMesh(geo, mat, arr.length);
        arr.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData = { originalMatrices: arr.map(m => m.clone()), isTrayComponent: isTrayComponent };
        group.add(mesh);
        this.explodeInstancedMeshes.push(mesh);
    };

    const box1 = new THREE.BoxGeometry(1, 1, 1);
    const cyl1 = new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2);
    const sphere1 = new THREE.SphereGeometry(1, 8, 8);

    addInstMesh(box1, darkMetal, instData.trayBody);
    addInstMesh(box1, darkMetal, instData.trayBottom);
    addInstMesh(box1, chromeDetail, instData.handle);
    addInstMesh(box1, pcbGreen, instData.pcb);
    addInstMesh(box1, copperDetail, instData.gpuPlate);
    addInstMesh(box1, copperDetail, instData.cpuPlate);
    addInstMesh(box1, copperDetail, instData.switchPlate);
    addInstMesh(box1, chromeDetail, instData.plateCover); // Silver nickel-plated cover
    addInstMesh(new THREE.CylinderGeometry(1, 1, 1, 8), chromeDetail, instData.fittings); // Silver/chrome fittings
    addInstMesh(cyl1, this.materials.blueCollar, instData.hoseCollarBlue); // Blue collars
    addInstMesh(cyl1, this.materials.redCollar, instData.hoseCollarRed);   // Red collars
    addInstMesh(box1, chromeDetail, instData.psuModule);
    addInstMesh(box1, goldPin, instData.osfpPort);
    addInstMesh(cyl1, chromeDetail, instData.qdcMale);
    addInstMesh(cyl1, darkMetal, instData.qdcFemale, false); // 母頭固定在分水管上不抽出
    addInstMesh(sphere1, ledGreen, instData.statusLed);
    addInstMesh(box1, ledGreen, instData.ledStrip);
    addInstMesh(box1, blankingPanel, instData.blankPanel);
    addInstMesh(cyl1, copperTube, instData.coldTube);
    addInstMesh(cyl1, this.materials.blueHose, instData.coldTubeBlue); // Black braided supply hose
    addInstMesh(cyl1, this.materials.redHose, instData.coldTubeRed);   // Black braided return hose

    const grillMat = new THREE.MeshStandardMaterial({ color: 0x475569, wireframe: true });
    addInstMesh(box1, grillMat, instData.psuFanGrill);
    addInstMesh(box1, chromeDetail, instData.psuHandle);

    addInstMesh(box1, new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.2 }), instData.memModule); // Premium blue RAM modules
    addInstMesh(box1, chromeDetail, instData.vrm); // Silver aluminum heatsinks for VRM

    // ==========================================
    // 5. 盲插歧管 (Blind-Mate Manifold) + 避讓群組
    // ==========================================
    const spineH = totalU * uHeight;

    if (isComputeRack) {
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
        spineSupply.rotation.z = Math.PI; // Flip flow direction to be top-to-bottom (inlet)
        rackPipingGroup.add(spineSupply);

        const spineReturn = new THREE.Mesh(spineGeo, pipeRedM);
        spineReturn.position.set(0.13, 0, trayD / 2 + 0.07);
        rackPipingGroup.add(spineReturn);

        const insulGeo = new THREE.CylinderGeometry(0.035, 0.035, spineH, 16);
        const insulMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.4, roughness: 1.0 }); // 黑色保溫泡棉
        const insulS = new THREE.Mesh(insulGeo, insulMat);
        insulS.position.copy(spineSupply.position);
        rackPipingGroup.add(insulS);
        const insulR = new THREE.Mesh(insulGeo, insulMat);
        insulR.position.copy(spineReturn.position);
        rackPipingGroup.add(insulR);

        for (let u = 0; u < totalU; u++) {
            const isCompute = isComputeRack && (u >= 12 && u <= 46 && u % 2 === 0);
            const isSwitch = isSwitchRack && (u % 2 === 0);
            if (!isCompute && !isSwitch) continue;

            const branchY = startY + u * uHeight + uHeight * 0.5;
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

    // Switch Racks: 背部雙路垂直 PDU 供電插槽與連接線
    if (isSwitchRack) {
        const rackPduGroup = new THREE.Group();
        rackPduGroup.userData = { 
            isShell: true, 
            origPos: new THREE.Vector3(0, 0, 0), 
            explodeDir: new THREE.Vector3(0, 0, 0.8) // 往機櫃背後退開 0.8 米
        };
        this.explodeShells.push(rackPduGroup);
        group.add(rackPduGroup);

        const pduH = totalU * uHeight;
        const pduW = 0.05;
        const pduD = 0.03;
        const pduMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 }); // 黑色 PDU 外殼

        [-0.2, 0.2].forEach((px) => {
            const chassis = new THREE.Mesh(new THREE.BoxGeometry(pduW, pduH, pduD), pduMat);
            chassis.position.set(px, 0, trayD / 2 + 0.06);
            rackPduGroup.add(chassis);

            const pduScreen = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.005), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 })); // HMI 電腦螢幕
            pduScreen.position.set(px, pduH / 2 - 0.06, trayD / 2 + 0.076);
            rackPduGroup.add(pduScreen);

            const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e })); // 狀態綠燈
            led.position.set(px - 0.01, pduH / 2 - 0.12, trayD / 2 + 0.076);
            rackPduGroup.add(led);

            for (let u = 2; u <= 44; u += 3) {
                const oy = startY + u * uHeight;
                const outlet = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.005), darkMetal); // 插座
                outlet.position.set(px, oy, trayD / 2 + 0.076);
                rackPduGroup.add(outlet);

                const startPt = new THREE.Vector3(px, oy, trayD / 2 + 0.076);
                const endPt = new THREE.Vector3(px * 0.8, oy, trayD / 2);
                const curve = new THREE.CatmullRomCurve3([
                    startPt,
                    new THREE.Vector3(px, oy - 0.02, trayD / 2 + 0.04),
                    endPt
                ]);
                const tubeGeo = new THREE.TubeGeometry(curve, 4, 0.005, 6, false);
                const cable = new THREE.Mesh(tubeGeo, rubberBlack);
                rackPduGroup.add(cable);
            }
        });
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
        
        for (let u = 0; u <= 46; u += 2) {
            const ty = startY + u * uHeight;
            [-0.18, -0.06, 0.06, 0.18].forEach((fx, idx) => {
                const start = new THREE.Vector3(fx, ty + uHeight * 0.5, -trayD/2 - 0.01);
                const side = fx < 0 ? -1 : 1;
                const end = new THREE.Vector3(side * (w/2 - 0.02), ty + uHeight * 0.5 - 0.04, -d/2 + 0.15 + idx * 0.05);
                const control = new THREE.Vector3(fx + side * 0.05, ty + uHeight * 0.5, -trayD/2 - 0.08);
                
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
    });

    const fiberTray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.15), darkMetal);
    fiberTray.position.set(0, h / 2 - 0.05, d / 2 - 0.2);
    group.add(fiberTray);

    [
        { pos: [0, h / 2 - 0.1, d / 2 - 0.05], label: 'INLET_TEMP' },
        { pos: [0, h / 2 - 0.1, -d / 2 + 0.05], label: 'OUTLET_TEMP' },
    ].forEach(sp => {
        const tSensor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6 }));
        tSensor.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
        group.add(tSensor);
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.15, 4), new THREE.MeshBasicMaterial({ color: 0x64748b }));
        wire.position.set(sp.pos[0] + 0.02, sp.pos[1] - 0.05, sp.pos[2]);
        group.add(wire);
    });

    for (let u = 0; u < totalU; u += 6) {
        const labelY = startY + u * uHeight;
        const uLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.008), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        uLabel.position.set(-w / 2 + 0.065, labelY, d / 2 - 0.04);
        group.add(uLabel);
    }

    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.04), new THREE.MeshBasicMaterial({ color: 0x76b900 }));
    logo.position.set(0, h / 2 - 0.03, d / 2 + 0.015);
    group.add(logo);

    const assetTag = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    assetTag.position.set(w / 2 + 0.008, 0.6, 0);
    assetTag.rotation.y = Math.PI / 2;
    group.add(assetTag);

    const warnLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    warnLabel.position.set(w / 2 + 0.008, 0.3, 0.2);
    warnLabel.rotation.y = Math.PI / 2;
    group.add(warnLabel);

    // ==========================================
    // CFD Cold Plate Visualization (Compute Racks only, hidden by default)
    // ==========================================
    if (isComputeRack) {
        const cpCfdGroup = new THREE.Group();
        cpCfdGroup.visible = false;
        cpCfdGroup.userData.isColdPlateCfdGroup = true;
        const boxGeo1 = new THREE.BoxGeometry(1, 1, 1);
        const cylGeo1 = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2);
        const dummy2 = new THREE.Object3D();
        const gpuCpMats2 = [], gpuHeatMats2 = [], cpuCpMats2 = [], cpuHeatMats2 = [];
        const flowMatS2 = [], flowMatR2 = [];
        for (let u2 = 12; u2 <= 46; u2 += 2) {
            const ty2 = startY + u2 * uHeight + uHeight * 0.5;
            [-0.1, 0.1].forEach(gx => {
                [-0.15, -0.02].forEach(gz => {
                    // GPU Cold Plate
                    dummy2.position.set(gx, ty2 + 0.010, gz);
                    dummy2.scale.set(0.091, 0.013, 0.091);
                    dummy2.rotation.set(0,0,0); dummy2.updateMatrix();
                    gpuCpMats2.push(dummy2.matrix.clone());
                    // GPU Chip (Larger than Cold Plate horizontally to be prominent)
                    dummy2.position.set(gx, ty2 - 0.005, gz);
                    dummy2.scale.set(0.096, 0.012, 0.096);
                    dummy2.updateMatrix(); gpuHeatMats2.push(dummy2.matrix.clone());
                });
            });
            [-0.1, 0.1].forEach(cx => {
                // CPU Cold Plate
                dummy2.position.set(cx, ty2 + 0.010, 0.18);
                dummy2.scale.set(0.076, 0.013, 0.076);
                dummy2.rotation.set(0,0,0); dummy2.updateMatrix();
                cpuCpMats2.push(dummy2.matrix.clone());
                // CPU Chip (Larger than Cold Plate horizontally to be prominent)
                dummy2.position.set(cx, ty2 - 0.005, 0.18);
                dummy2.scale.set(0.081, 0.012, 0.081);
                dummy2.updateMatrix(); cpuHeatMats2.push(dummy2.matrix.clone());
            });
            // supply / return internal flow tube segments
            dummy2.position.set(-0.1, ty2, 0.015); dummy2.scale.set(0.005, 0.005, 0.38);
            dummy2.rotation.set(0,0,0); dummy2.updateMatrix(); flowMatS2.push(dummy2.matrix.clone());
            dummy2.position.set(0.1, ty2, 0.015); dummy2.scale.set(0.005, 0.005, 0.38);
            dummy2.updateMatrix(); flowMatR2.push(dummy2.matrix.clone());
        }
        const gpuCpM  = new THREE.MeshStandardMaterial({ color: 0x00bfff, emissive: 0x0055bb, emissiveIntensity: 2.0, transparent: true, opacity: 0.88, metalness: 0.9, roughness: 0.05 });
        const cpuCpM  = new THREE.MeshStandardMaterial({ color: 0x00ffee, emissive: 0x009988, emissiveIntensity: 1.8, transparent: true, opacity: 0.85, metalness: 0.9, roughness: 0.05 });
        // High-intensity emissive red-hot material for chips
        const chipHM  = new THREE.MeshStandardMaterial({ color: 0xff3b00, emissive: 0xff1100, emissiveIntensity: 5.0, transparent: true, opacity: 0.95 });
        const flowSM  = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x003366, emissiveIntensity: 1.2, transparent: true, opacity: 0.60, metalness: 0.7 });
        const flowRM  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xcc2200, emissiveIntensity: 1.0, transparent: true, opacity: 0.60, metalness: 0.7 });
        const mkIM = (geo, mat, mats) => { if (!mats.length) return; const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m,i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; cpCfdGroup.add(im); };
        mkIM(boxGeo1, gpuCpM,  gpuCpMats2);
        mkIM(boxGeo1, chipHM,  gpuHeatMats2);
        mkIM(boxGeo1, cpuCpM,  cpuCpMats2);
        mkIM(boxGeo1, chipHM.clone(), cpuHeatMats2);
        mkIM(cylGeo1, flowSM, flowMatS2);
        mkIM(cylGeo1, flowRM, flowMatR2);
        group.add(cpCfdGroup);
        this.coldPlateCfdGroups.push(cpCfdGroup);
    }

    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.userData = group.userData;
    group.add(hitBox);
    this.interactables.push(hitBox);

    this.scene.add(group);
}
