/**
 * HVAC & Semiconductor 3D Digital Twin - Unified Models Library
 * Bundles:
 * 1. Server Rack (NVL72 / Oberon Compute / Switch / Power)
 * 2. Water-Cooled Chiller (800 RT Centrifugal)
 * 3. Centrifugal Pump (CHWP / CWP)
 * 4. Induced Draft Cooling Tower (900 RT with rotatable fan)
 * 
 * Location: C:\Users\user\OneDrive\桌面\INDEX 動畫\models_library.js
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('three'));
    } else {
        root.HVACModels = factory(root.THREE);
    }
}(typeof self !== 'undefined' ? self : this, function (THREE) {
    'use strict';

    if (!THREE) {
        throw new Error('Three.js is required for HVACModels library');
    }

    const animatedFans = [];

    // =========================================================================
    // 1. SERVER RACK GENERATOR
    // =========================================================================
    let cachedRackTextures = null;
    function getRackTextures() {
        if (cachedRackTextures) return cachedRackTextures;

        const c1 = document.createElement('canvas');
        c1.width = 64; c1.height = 64;
        const ctx1 = c1.getContext('2d');
        ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, 64, 64);
        ctx1.strokeStyle = '#fff'; ctx1.lineWidth = 4;
        for (let y = 0; y < 64; y += 16) {
            for (let x = 0; x < 64; x += 16) {
                ctx1.beginPath();
                ctx1.arc(x + (y % 32 === 0 ? 0 : 8), y, 5, 0, Math.PI * 2);
                ctx1.stroke();
            }
        }
        const honeycomb = new THREE.CanvasTexture(c1);
        honeycomb.wrapS = honeycomb.wrapT = THREE.RepeatWrapping;
        honeycomb.repeat.set(10, 30);

        const c6 = document.createElement('canvas');
        c6.width = 640; c6.height = 200;
        const ctx6 = c6.getContext('2d');
        ctx6.fillStyle = '#1b2431'; ctx6.fillRect(0, 0, 640, 200);
        ctx6.fillStyle = '#76b900';
        ctx6.beginPath();
        ctx6.moveTo(60, 42); ctx6.quadraticCurveTo(158, 20, 158, 100);
        ctx6.quadraticCurveTo(158, 180, 60, 158); ctx6.quadraticCurveTo(104, 100, 60, 42);
        ctx6.closePath(); ctx6.fill();
        ctx6.fillStyle = '#eef1f5'; ctx6.font = 'bold 72px Arial, sans-serif';
        ctx6.textAlign = 'left'; ctx6.textBaseline = 'middle';
        ctx6.fillText('NVIDIA', 200, 104);
        const nvidiaLogo = new THREE.CanvasTexture(c6);

        cachedRackTextures = { honeycomb, nvidiaLogo };
        return cachedRackTextures;
    }

    function createRack(options = {}) {
        const {
            x = 0, y = 0, z = 0, rotY = 0,
            name = 'Rack-01',
            type = 'compute',
            showDoor = true,
            showManifolds = true,
            showColdPlates = false
        } = options;

        const isCompute = type === 'compute';
        const isSwitch = type === 'switch';
        const isPower = type === 'power';
        const tex = getRackTextures();
        const w = 0.6, h = 2.2, d = 1.2;

        const group = new THREE.Group();
        group.position.set(x, y + h / 2, z);
        group.rotation.y = rotY;
        group.userData = { type: 'Rack', name, rackRole: type };

        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.7, roughness: 0.5 });
        const chromeDetail = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
        const goldPin = new THREE.MeshStandardMaterial({ color: 0xfbb034, metalness: 1.0, roughness: 0.1 });
        const ledGreen = new THREE.MeshBasicMaterial({ color: 0x76b900 });
        const rubberBlack = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, metalness: 0.1 });
        const blankingPanel = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.8 });
        const copperTube = new THREE.MeshStandardMaterial({ color: 0xc47e4a, metalness: 0.85, roughness: 0.25 });
        const champagneGold = new THREE.MeshStandardMaterial({ color: 0x8E7F68, metalness: 0.4, roughness: 0.45 });
        const pipeBlue = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.6, roughness: 0.3 });
        const pipeRed = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3 });
        const fitMat = new THREE.MeshStandardMaterial({ color: 0xcbd3da, metalness: 0.7, roughness: 0.35 });

        // Frame
        const t = 0.04;
        const frameGeoV = new THREE.BoxGeometry(t, h, t);
        [
            [-w / 2 + t / 2, d / 2 - t / 2], [w / 2 - t / 2, d / 2 - t / 2],
            [-w / 2 + t / 2, -d / 2 + t / 2], [w / 2 - t / 2, -d / 2 + t / 2]
        ].forEach(pos => {
            const post = new THREE.Mesh(frameGeoV, darkMetal);
            post.position.set(pos[0], 0, pos[1]);
            group.add(post);
        });

        // Braces
        const hBraceGeo = new THREE.BoxGeometry(w - t * 2, 0.02, 0.02);
        const dBraceGeo = new THREE.BoxGeometry(0.02, 0.02, d - t * 2);
        [-h / 2 + 0.06, -0.3, 0.3, h / 2 - 0.06].forEach(by => {
            [d / 2 - t / 2, -d / 2 + t / 2].forEach(bz => {
                const b = new THREE.Mesh(hBraceGeo, darkMetal);
                b.position.set(0, by, bz);
                group.add(b);
            });
            if (Math.abs(by) > 0.5) {
                [-w / 2 + t / 2, w / 2 - t / 2].forEach(bx => {
                    const b = new THREE.Mesh(dBraceGeo, darkMetal);
                    b.position.set(bx, by, 0);
                    group.add(b);
                });
            }
        });

        // Side panels & Roof
        const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.005, h - 0.1, d - 0.1), darkMetal);
        [-w / 2 + 0.005, w / 2 - 0.005].forEach(sx => {
            const sp = sidePanel.clone();
            sp.position.set(sx, 0, 0);
            group.add(sp);
        });

        const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), darkMetal);
        roof.position.set(0, h / 2 - 0.01, 0);
        group.add(roof);

        // Nodes
        const totalU = 48;
        const uHeight = (h - 0.12) / totalU;
        const startY = -h / 2 + 0.06;
        const trayW = w - 0.08;
        const trayD = d - 0.15;

        if (showDoor) {
            const door = new THREE.Mesh(
                new THREE.PlaneGeometry(w - 0.02, h - 0.08),
                new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5, alphaMap: tex.honeycomb, transparent: true, side: THREE.DoubleSide, depthWrite: false })
            );
            door.position.set(0, 0, -d / 2 - 0.005);
            door.rotation.y = Math.PI;
            group.add(door);

            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), chromeDetail);
            handle.position.set(w / 2 - 0.06, 0, -d / 2 - 0.015);
            group.add(handle);
        }

        if (isCompute) {
            for (let u = 12; u <= 46; u += 2) {
                const ty = startY + u * uHeight + uHeight * 0.5;
                const ch = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 1.85, trayD), darkMetal);
                ch.position.set(0, ty, 0);
                group.add(ch);

                const fp = new THREE.Mesh(new THREE.BoxGeometry(trayW - 0.02, uHeight * 1.75, 0.012), champagneGold);
                fp.position.set(0, ty, -trayD / 2 - 0.006);
                group.add(fp);

                [-0.18, 0.18].forEach((qx, idx) => {
                    const qd = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.024, 12), chromeDetail);
                    qd.rotation.x = Math.PI / 2;
                    qd.position.set(qx, ty, -trayD / 2 - 0.02);
                    group.add(qd);
                });

                for (let l = 0; l < 3; l++) {
                    const led = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.003), ledGreen);
                    led.position.set(-0.24 + l * 0.012, ty + 0.015, -trayD / 2 - 0.013);
                    group.add(led);
                }
            }

            for (let u = 0; u < 12; u += 3) {
                const ty = startY + u * uHeight + uHeight * 1.2;
                const psu = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 2.8, trayD), blankingPanel);
                psu.position.set(0, ty, 0);
                group.add(psu);
            }
        } else if (isSwitch) {
            for (let u = 0; u < totalU; u += 2) {
                const ty = startY + u * uHeight + uHeight * 0.5;
                const ch = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 1.8, trayD), darkMetal);
                ch.position.set(0, ty, 0);
                group.add(ch);
                for (let p = 0; p < 16; p++) {
                    const port = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.005), chromeDetail);
                    port.position.set(-0.22 + p * 0.028, ty, -trayD / 2 - 0.005);
                    group.add(port);
                }
            }
        } else if (isPower) {
            [-0.15, 0, 0.15].forEach(bx => {
                const busbar = new THREE.Mesh(new THREE.BoxGeometry(0.015, h - 0.2, 0.03), copperTube);
                busbar.position.set(bx, 0, trayD / 2 - 0.03);
                group.add(busbar);
            });
            for (let u = 0; u < totalU; u += 6) {
                const ty = startY + u * uHeight + uHeight * 2.8;
                const rect = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 5.6, trayD), darkMetal);
                rect.position.set(0, ty, 0);
                group.add(rect);
            }
        }

        // Manifolds
        if (showManifolds && isCompute) {
            const tubeH = h - 0.35, tubeR = 0.016, mZ = d / 2 - 0.05;
            const tS = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, tubeH, 16), pipeBlue);
            tS.position.set(-0.12, 0, mZ); group.add(tS);
            const tR = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, tubeH, 16), pipeRed);
            tR.position.set(0.12, 0, mZ); group.add(tR);

            [-0.12, 0.12].forEach(tx => {
                const cap = new THREE.Mesh(new THREE.SphereGeometry(tubeR * 1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), fitMat);
                cap.position.set(tx, tubeH / 2, mZ); group.add(cap);
                for (let s = 0; s < 8; s++) {
                    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), fitMat);
                    branch.rotation.x = Math.PI / 2;
                    branch.position.set(tx, -tubeH / 2 + 0.1 + s * (tubeH / 8), mZ - 0.025);
                    group.add(branch);
                }
            });
        }

        // Drip tray & Nvidia logo
        const dripTray = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.015, d - 0.06), darkMetal);
        dripTray.position.set(0, -h / 2 + 0.03, 0);
        group.add(dripTray);

        const nvidiaPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.05), new THREE.MeshBasicMaterial({ map: tex.nvidiaLogo }));
        nvidiaPlate.position.set(0, h / 2 - 0.035, -d / 2 - 0.006);
        group.add(nvidiaPlate);

        return group;
    }

    // =========================================================================
    // 2. WATER-COOLED CHILLER GENERATOR
    // =========================================================================
    function createChiller(options = {}) {
        if (typeof root.createWaterCooledChiller === 'function') {
            return root.createWaterCooledChiller(options);
        }
        // Fallback: direct generator
        const {
            x = 0, y = 0, z = 0, rotY = 0,
            name = 'CH-01 (800 RT)',
            cop = 6.20, load = 75.5,
            chws = 12.0, chwr = 18.0, cws = 28.5, cwr = 34.0
        } = options;

        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotY;
        group.userData = { type: 'Chiller', name };

        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.35 });
        const chillerBody = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
        const compMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
        const alumMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 });
        const insulBlue = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, metalness: 0.1, roughness: 0.7 });
        const insulGreen = new THREE.MeshStandardMaterial({ color: 0x064e3b, metalness: 0.1, roughness: 0.7 });
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x2d3566, metalness: 0.72, roughness: 0.35 });

        // Skid
        const skidL = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.12), darkMetal);
        skidL.position.set(0, 0.08, 0.54); group.add(skidL);
        const skidR = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.12), darkMetal);
        skidR.position.set(0, 0.08, -0.54); group.add(skidR);

        // Evaporator & Condenser
        const evap = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32), insulBlue);
        evap.rotation.z = Math.PI / 2; evap.position.set(0, 0.57, -0.45); group.add(evap);

        const cond = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.52, 32), insulGreen);
        cond.rotation.z = Math.PI / 2; cond.position.set(0, 0.62, 0.45); group.add(cond);

        // Compressor
        const comp = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.44, 20), compMat);
        comp.rotation.z = Math.PI / 2; comp.position.set(-0.5, 1.65, 0); group.add(comp);

        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 1.05, 20), motorMat);
        motor.rotation.z = Math.PI / 2; motor.position.set(0.9, 1.65, 0); group.add(motor);

        // End Plates & Water boxes
        [-1.3, 1.3].forEach(px => {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 1.6), darkMetal);
            plate.position.set(px, 0.58, 0); group.add(plate);

            const domeE = new THREE.Mesh(new THREE.SphereGeometry(0.395, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), chillerBody);
            domeE.rotation.z = px > 0 ? Math.PI / 2 : -Math.PI / 2;
            domeE.position.set(px + Math.sign(px) * 0.14, 0.57, -0.45); group.add(domeE);

            const domeC = new THREE.Mesh(new THREE.SphereGeometry(0.455, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), chillerBody);
            domeC.rotation.z = px > 0 ? Math.PI / 2 : -Math.PI / 2;
            domeC.position.set(px + Math.sign(px) * 0.14, 0.62, 0.45); group.add(domeC);
        });

        // Starter Cabinet
        const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.14), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4 }));
        cab.position.set(-0.3, 1.0, -0.97); group.add(cab);

        return group;
    }

    // =========================================================================
    // 3. CENTRIFUGAL PUMP GENERATOR
    // =========================================================================
    function createPump(options = {}) {
        if (typeof root.createCentrifugalPump === 'function') {
            return root.createCentrifugalPump(options);
        }
        const { x = 0, y = 0, z = 0, rotY = 0, name = 'CHWP-01', type = 'chwp' } = options;
        const isCHW = type.toLowerCase().includes('chw');
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotY;
        group.userData = { type: 'Pump', name };

        const alumMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 });
        const ironPump = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.78, roughness: 0.38 });
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.12, roughness: 0.92 });
        const motorMat = new THREE.MeshStandardMaterial({ color: isCHW ? 0x1d4ed8 : 0x065f46, metalness: 0.6, roughness: 0.35 });

        // Skid
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.13, 1.55), baseMat);
        skid.position.set(0, 0.065, -0.08); group.add(skid);

        // Volute
        const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.235, 0.27, 28), ironPump);
        volute.rotation.x = Math.PI / 2; volute.position.set(0, 0.35, 0.24); group.add(volute);

        // Motor
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.52, 20), motorMat);
        motor.rotation.x = Math.PI / 2; motor.position.set(0, 0.35, -0.555); group.add(motor);

        for (let r = 0; r < 10; r++) {
            const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20), motorMat);
            rib.rotation.x = Math.PI / 2; rib.position.set(0, 0.35, -0.308 - r * 0.048); group.add(rib);
        }

        // Suction & Discharge stubs
        const suction = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.078, 0.095, 14), ironPump);
        suction.rotation.x = Math.PI / 2; suction.position.set(0, 0.32, 0.615); group.add(suction);

        const disch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3), ironPump);
        disch.position.set(0, 0.695, 0.3); group.add(disch);

        return group;
    }

    // =========================================================================
    // 4. COOLING TOWER GENERATOR
    // =========================================================================
    function createCoolingTower(options = {}) {
        if (typeof root.createCoolingTower === 'function') {
            const ct = root.createCoolingTower(options);
            if (ct.userData && ct.userData.fanRotator) {
                animatedFans.push(ct.userData.fanRotator);
            }
            return ct;
        }

        const { x = 0, y = 0, z = 0, rotY = 0, name = 'CT-01', capacity = '900 RT' } = options;
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotY;
        group.userData = { type: 'CoolingTower', name };

        const casingMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.6 });
        const fanMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.6, roughness: 0.3 });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.58, roughness: 0.52 });

        // Basin
        const basin = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.45, 3.72), casingMat);
        basin.position.set(0, 0.225, 0); group.add(basin);

        // Cowl
        const cowl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.44, 0.65, 32, 1, true), deckMat);
        cowl.position.set(0, 2.74, 0); group.add(cowl);

        // Fan Rotator
        const fanRotator = new THREE.Group();
        fanRotator.position.set(0, 2.82, 0);
        for (let b = 0; b < 6; b++) {
            const bg = new THREE.Group();
            bg.rotation.y = (b / 6) * Math.PI * 2;
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.016, 1.08), fanMat);
            blade.position.set(0, 0, 0.54); blade.rotation.z = 0.22;
            bg.add(blade);
            fanRotator.add(bg);
        }
        group.add(fanRotator);
        group.userData.fanRotator = fanRotator;
        animatedFans.push(fanRotator);

        return group;
    }

    // =========================================================================
    // ANIMATION TICKER
    // =========================================================================
    function animate(delta = 0.016, fanSpeed = 3.0) {
        animatedFans.forEach(fan => {
            if (fan && fan.parent) {
                fan.rotation.y += delta * fanSpeed;
            }
        });
    }

    return {
        createRack,
        createCDU: (opts) => (root.createDetailedCDU ? root.createDetailedCDU(opts) : (opts) => {}),
        createChiller: (opts) => (root.createWaterCooledChiller ? root.createWaterCooledChiller(opts) : createChiller(opts)),
        createPump: (opts) => (root.createCentrifugalPump ? root.createCentrifugalPump(opts) : createPump(opts)),
        createCoolingTower,
        animate,
        animatedFans
    };
}));
