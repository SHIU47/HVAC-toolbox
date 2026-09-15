/**
 * HVAC & Data Center 3D Digital Twin - Server Rack Model Generator
 * Extracted from: C:\Users\user\OneDrive\桌面\HVAC-Pro\public\whitespace\app.js
 * 
 * Generates an ultra-detailed NVL72 / Oberon server rack:
 * - 48U Server Rack frame with vertical posts & structural braces
 * - Multi-server node trays (Compute / Switch / Power)
 * - Champagne Gold (#8E7F68) anodized front panels & Foxconn / NVIDIA branding
 * - Rear vertical supply/return manifolds with quick-disconnect stubs
 * - Perforated honeycomb mesh door with canvas alpha map
 * - Drip tray, leak sensor, cable management rings, temperature sensors
 * - Optional CFD cold plates & high-heat chip visualization
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('three'));
    } else {
        root.createDetailedRack = factory(root.THREE);
    }
}(typeof self !== 'undefined' ? self : this, function (THREE) {
    'use strict';

    if (!THREE) {
        throw new Error('Three.js is required for createDetailedRack');
    }

    // Shared procedural texture cache
    let cachedTextures = null;
    function getTextures() {
        if (cachedTextures) return cachedTextures;

        // 1. Honeycomb mesh texture (alphaMap)
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

        // 2. NVIDIA logo badge
        const c6 = document.createElement('canvas');
        c6.width = 640; c6.height = 200;
        const ctx6 = c6.getContext('2d');
        ctx6.fillStyle = '#1b2431';
        ctx6.fillRect(0, 0, 640, 200);
        ctx6.fillStyle = '#76b900';
        ctx6.beginPath();
        ctx6.moveTo(60, 42);
        ctx6.quadraticCurveTo(158, 20, 158, 100);
        ctx6.quadraticCurveTo(158, 180, 60, 158);
        ctx6.quadraticCurveTo(104, 100, 60, 42);
        ctx6.closePath();
        ctx6.fill();
        ctx6.fillStyle = '#eef1f5';
        ctx6.font = 'bold 72px Arial, sans-serif';
        ctx6.textAlign = 'left';
        ctx6.textBaseline = 'middle';
        ctx6.fillText('NVIDIA', 200, 104);
        const nvidiaLogo = new THREE.CanvasTexture(c6);

        // 3. Flow arrows for pipe
        const c3 = document.createElement('canvas');
        c3.width = 64; c3.height = 128;
        const ctx3 = c3.getContext('2d');
        ctx3.fillStyle = '#1e293b'; ctx3.fillRect(0, 0, 64, 128);
        ctx3.strokeStyle = '#ffffff'; ctx3.lineWidth = 8;
        ctx3.lineCap = 'round'; ctx3.lineJoin = 'round';
        ctx3.beginPath(); ctx3.moveTo(12, 35); ctx3.lineTo(32, 15); ctx3.lineTo(52, 35); ctx3.stroke();
        ctx3.beginPath(); ctx3.moveTo(12, 95); ctx3.lineTo(32, 75); ctx3.lineTo(52, 95); ctx3.stroke();
        const flowBlue = new THREE.CanvasTexture(c3);
        flowBlue.wrapS = flowBlue.wrapT = THREE.RepeatWrapping;
        flowBlue.repeat.set(1, 4);

        const c4 = document.createElement('canvas');
        c4.width = 64; c4.height = 128;
        const ctx4 = c4.getContext('2d');
        ctx4.drawImage(c3, 0, 0);
        const flowRed = new THREE.CanvasTexture(c4);
        flowRed.wrapS = flowRed.wrapT = THREE.RepeatWrapping;
        flowRed.repeat.set(1, 4);

        cachedTextures = { honeycomb, nvidiaLogo, flowBlue, flowRed };
        return cachedTextures;
    }

    /**
     * Creates a detailed 3D Server Rack group.
     * @param {Object} options Configuration parameters
     * @returns {THREE.Group} Rack group
     */
    function createDetailedRack(options = {}) {
        const {
            x = 0,
            y = 0,
            z = 0,
            rotY = 0,
            name = 'Rack-01',
            type = 'compute', // 'compute', 'switch', 'power'
            showDoor = true,
            showManifolds = true,
            showColdPlates = false
        } = options;

        const isComputeRack = type === 'compute';
        const isSwitchRack = type === 'switch';
        const isPowerRack = type === 'power';

        const tex = getTextures();
        const w = 0.6, h = 2.2, d = 1.2;

        const group = new THREE.Group();
        group.position.set(x, y + h / 2, z);
        group.rotation.y = rotY;
        group.userData = { type: 'Rack', name: name, rackRole: type };

        // Materials
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.7, roughness: 0.5 });
        const chromeDetail = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
        const goldPin = new THREE.MeshStandardMaterial({ color: 0xfbb034, metalness: 1.0, roughness: 0.1 });
        const ledGreen = new THREE.MeshBasicMaterial({ color: 0x76b900 });
        const rubberBlack = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, metalness: 0.1 });
        const blankingPanel = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.8 });
        const copperTube = new THREE.MeshStandardMaterial({ color: 0xc47e4a, metalness: 0.85, roughness: 0.25 });
        const champagneGold = new THREE.MeshStandardMaterial({ color: 0x8E7F68, metalness: 0.4, roughness: 0.45 });
        const meshDoorMat = new THREE.MeshStandardMaterial({
            color: 0x334155, metalness: 0.5, roughness: 0.5,
            alphaMap: tex.honeycomb, transparent: true, side: THREE.DoubleSide, depthWrite: false
        });
        const pipeBlueM = new THREE.MeshStandardMaterial({
            color: 0x0ea5e9, metalness: 0.6, roughness: 0.3,
            map: tex.flowBlue, emissive: 0x0c4a6e, emissiveIntensity: 0.5
        });
        const pipeRedM = new THREE.MeshStandardMaterial({
            color: 0xef4444, metalness: 0.6, roughness: 0.3,
            map: tex.flowRed, emissive: 0x7f1d1d, emissiveIntensity: 0.5
        });
        const fitMat = new THREE.MeshStandardMaterial({ color: 0xcbd3da, metalness: 0.7, roughness: 0.35 });

        // 1. Frame vertical posts (4 corners)
        const t = 0.04;
        const frameGeoV = new THREE.BoxGeometry(t, h, t);
        const corners = [
            [-w / 2 + t / 2, d / 2 - t / 2], [w / 2 - t / 2, d / 2 - t / 2],
            [-w / 2 + t / 2, -d / 2 + t / 2], [w / 2 - t / 2, -d / 2 + t / 2]
        ];
        corners.forEach(pos => {
            const post = new THREE.Mesh(frameGeoV, darkMetal);
            post.position.set(pos[0], 0, pos[1]);
            group.add(post);
        });

        // 2. Horizontal & Depth braces
        const hBraceGeo = new THREE.BoxGeometry(w - t * 2, 0.02, 0.02);
        const dBraceGeo = new THREE.BoxGeometry(0.02, 0.02, d - t * 2);
        const braceHeights = [-h / 2 + 0.06, -0.3, 0.3, h / 2 - 0.06];
        braceHeights.forEach(by => {
            [d / 2 - t / 2, -d / 2 + t / 2].forEach(bz => {
                const brace = new THREE.Mesh(hBraceGeo, darkMetal);
                brace.position.set(0, by, bz);
                group.add(brace);
            });
            if (Math.abs(by) > 0.5) {
                [-w / 2 + t / 2, w / 2 - t / 2].forEach(bx => {
                    const brace = new THREE.Mesh(dBraceGeo, darkMetal);
                    brace.position.set(bx, by, 0);
                    group.add(brace);
                });
            }
        });

        // 3. Side Panels & Roof
        const sidePanelGeo = new THREE.BoxGeometry(0.005, h - 0.1, d - 0.1);
        [-w / 2 + 0.005, w / 2 - 0.005].forEach(sx => {
            const side = new THREE.Mesh(sidePanelGeo, darkMetal);
            side.position.set(sx, 0, 0);
            group.add(side);
        });

        const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), darkMetal);
        roof.position.set(0, h / 2 - 0.01, 0);
        group.add(roof);

        for (let g = 0; g < 4; g++) {
            const grommet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), rubberBlack);
            grommet.position.set(-0.15 + (g % 2) * 0.3, h / 2, -0.3 + Math.floor(g / 2) * 0.6);
            group.add(grommet);
        }

        // 4. Server Nodes & Trays (48U layout)
        const totalU = 48;
        const uHeight = (h - 0.12) / totalU;
        const startY = -h / 2 + 0.06;
        const trayW = w - 0.08;
        const trayD = d - 0.15;

        // Front mesh door
        if (showDoor) {
            const door = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.08), meshDoorMat);
            door.position.set(0, 0, -d / 2 - 0.005);
            door.rotation.y = Math.PI;
            group.add(door);

            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), chromeDetail);
            handle.position.set(w / 2 - 0.06, 0, -d / 2 - 0.015);
            group.add(handle);
        }

        // Server modules by role
        if (isComputeRack) {
            // Oberon / GB200 NVL72 Compute Nodes (18 nodes across U12 to U46)
            for (let u = 12; u <= 46; u += 2) {
                const ty = startY + u * uHeight + uHeight * 0.5;
                const chassis = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 1.85, trayD), darkMetal);
                chassis.position.set(0, ty, 0);
                group.add(chassis);

                // Champagne Gold front faceplate
                const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(trayW - 0.02, uHeight * 1.75, 0.012), champagneGold);
                frontPlate.position.set(0, ty, -trayD / 2 - 0.006);
                group.add(frontPlate);

                // Quick-disconnect couplings (Chrome + Gold rings)
                [-0.18, 0.18].forEach((qx, idx) => {
                    const qd = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.024, 12), chromeDetail);
                    qd.rotation.x = Math.PI / 2;
                    qd.position.set(qx, ty, -trayD / 2 - 0.02);
                    group.add(qd);

                    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.002, 6, 12), idx === 0 ? chromeDetail : goldPin);
                    ring.position.set(qx, ty, -trayD / 2 - 0.03);
                    group.add(ring);
                });

                // Status LEDs
                for (let l = 0; l < 3; l++) {
                    const led = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.003), ledGreen);
                    led.position.set(-0.24 + l * 0.012, ty + 0.015, -trayD / 2 - 0.013);
                    group.add(led);
                }

                // Extruded aluminum heat sink fins visible on front
                for (let fin = 0; fin < 8; fin++) {
                    const finMesh = new THREE.Mesh(new THREE.BoxGeometry(0.003, uHeight * 1.2, 0.015), chromeDetail);
                    finMesh.position.set(-0.07 + fin * 0.02, ty, -trayD / 2 - 0.014);
                    group.add(finMesh);
                }
            }

            // Power shelf / Switch drawers in lower/upper U
            for (let u = 0; u < 12; u += 3) {
                const ty = startY + u * uHeight + uHeight * 1.2;
                const psu = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 2.8, trayD), blankingPanel);
                psu.position.set(0, ty, 0);
                group.add(psu);

                const face = new THREE.Mesh(new THREE.BoxGeometry(trayW - 0.02, uHeight * 2.7, 0.008), darkMetal);
                face.position.set(0, ty, -trayD / 2 - 0.004);
                group.add(face);
            }
        } else if (isSwitchRack) {
            // Switch rack with high density patch cabling
            for (let u = 0; u < totalU; u += 2) {
                const ty = startY + u * uHeight + uHeight * 0.5;
                const chassis = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 1.8, trayD), darkMetal);
                chassis.position.set(0, ty, 0);
                group.add(chassis);

                // Optical port array
                for (let p = 0; p < 16; p++) {
                    const port = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.005), chromeDetail);
                    port.position.set(-0.22 + p * 0.028, ty, -trayD / 2 - 0.005);
                    group.add(port);
                }
            }

            // Fiber optic patch harness loops (Blue & Green)
            const fiberMatBlue = new THREE.LineBasicMaterial({ color: 0x0ea5e9 });
            const fiberMatGreen = new THREE.LineBasicMaterial({ color: 0x22c55e });
            for (let u = 2; u <= 44; u += 4) {
                const ty = startY + u * uHeight;
                [-0.18, 0.18].forEach((fx, idx) => {
                    const start = new THREE.Vector3(fx, ty, -trayD / 2 - 0.01);
                    const control = new THREE.Vector3(fx * 1.4, ty - 0.03, -trayD / 2 - 0.08);
                    const end = new THREE.Vector3(fx > 0 ? w / 2 - 0.03 : -w / 2 + 0.03, ty - 0.05, -trayD / 2);
                    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
                    const fiberGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(8));
                    const fiberLine = new THREE.Line(fiberGeo, idx === 0 ? fiberMatBlue : fiberMatGreen);
                    group.add(fiberLine);
                });
            }
        } else if (isPowerRack) {
            // Power / Battery Rack with massive Copper Busbars
            const busbarW = 0.015, busbarH = h - 0.2, busbarD = 0.03;
            [-0.15, 0, 0.15].forEach(bx => {
                const busbar = new THREE.Mesh(new THREE.BoxGeometry(busbarW, busbarH, busbarD), copperTube);
                busbar.position.set(bx, 0, trayD / 2 - 0.03);
                group.add(busbar);
            });

            // Rectifier shelves
            for (let u = 0; u < totalU; u += 6) {
                const ty = startY + u * uHeight + uHeight * 2.8;
                const rect = new THREE.Mesh(new THREE.BoxGeometry(trayW, uHeight * 5.6, trayD), darkMetal);
                rect.position.set(0, ty, 0);
                group.add(rect);

                const gr = new THREE.Mesh(new THREE.BoxGeometry(trayW - 0.04, uHeight * 5.2, 0.01), blankingPanel);
                gr.position.set(0, ty, -trayD / 2 - 0.005);
                group.add(gr);
            }
        }

        // 5. Rear Liquid Manifolds (Stainless Dual Supply / Return Tubes)
        if (showManifolds && isComputeRack) {
            const manifoldGroup = new THREE.Group();
            const tubeH = h - 0.35;
            const tubeR = 0.016;
            const manifoldZ = d / 2 - 0.05;

            // Supply tube (Blue)
            const tubeSupply = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, tubeH, 16), pipeBlueM);
            tubeSupply.position.set(-0.12, 0, manifoldZ);
            manifoldGroup.add(tubeSupply);

            // Return tube (Red)
            const tubeReturn = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, tubeH, 16), pipeRedM);
            tubeReturn.position.set(0.12, 0, manifoldZ);
            manifoldGroup.add(tubeReturn);

            // Tube end caps & branches
            [-0.12, 0.12].forEach(tx => {
                const cap = new THREE.Mesh(new THREE.SphereGeometry(tubeR * 1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), fitMat);
                cap.position.set(tx, tubeH / 2, manifoldZ);
                manifoldGroup.add(cap);

                // Quick-connect distribution branches extending to nodes
                for (let s = 0; s < 8; s++) {
                    const sy = -tubeH / 2 + 0.1 + s * (tubeH / 8);
                    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), fitMat);
                    branch.rotation.x = Math.PI / 2;
                    branch.position.set(tx, sy, manifoldZ - 0.025);
                    manifoldGroup.add(branch);
                }

                // Floor bracket
                const foot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.05), fitMat);
                foot.position.set(tx, -tubeH / 2 - 0.025, manifoldZ);
                manifoldGroup.add(foot);
            });

            group.add(manifoldGroup);
        }

        // 6. Bottom Drip Tray & Leak Sensor
        const dripTray = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.015, d - 0.06), darkMetal);
        dripTray.position.set(0, -h / 2 + 0.03, 0);
        group.add(dripTray);

        const leakSensor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.04), new THREE.MeshStandardMaterial({ color: 0x22d3ee }));
        leakSensor.position.set(0.1, -h / 2 + 0.04, 0.2);
        group.add(leakSensor);

        // 7. Cable management troughs & rings at rear
        [-w / 2 + 0.03, w / 2 - 0.03].forEach(cx => {
            const trough = new THREE.Mesh(new THREE.BoxGeometry(0.035, h * 0.7, 0.035), darkMetal);
            trough.position.set(cx, 0.1, d / 2 - 0.06);
            group.add(trough);

            for (let r = 0; r < 5; r++) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 6, 12), darkMetal);
                ring.rotation.y = Math.PI / 2;
                ring.position.set(cx, -0.3 + r * 0.2, d / 2 - 0.06);
                group.add(ring);
            }
        });

        // 8. Brand Logos & Nameplates
        const nvidiaPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.05), new THREE.MeshBasicMaterial({ map: tex.nvidiaLogo }));
        nvidiaPlate.position.set(0, h / 2 - 0.035, -d / 2 - 0.006);
        group.add(nvidiaPlate);

        // Temperature sensors
        [
            { pos: [0, h / 2 - 0.08, d / 2 - 0.03], label: 'OUTLET' },
            { pos: [0, h / 2 - 0.08, -d / 2 + 0.03], label: 'INLET' }
        ].forEach(sp => {
            const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
            sensor.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
            group.add(sensor);
        });

        // Optional Cold Plate CFD Visualization
        if (showColdPlates && isComputeRack) {
            const cpGroup = new THREE.Group();
            const gpuMat = new THREE.MeshStandardMaterial({ color: 0x00bfff, emissive: 0x0055bb, emissiveIntensity: 2.0, transparent: true, opacity: 0.85 });
            const chipMat = new THREE.MeshStandardMaterial({ color: 0xff3b00, emissive: 0xff1100, emissiveIntensity: 4.0 });

            for (let u = 12; u <= 46; u += 4) {
                const ty = startY + u * uHeight + uHeight * 0.5;
                [-0.1, 0.1].forEach(gx => {
                    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.09), gpuMat);
                    cp.position.set(gx, ty + 0.01, -0.05);
                    cpGroup.add(cp);

                    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.008, 0.095), chipMat);
                    chip.position.set(gx, ty - 0.004, -0.05);
                    cpGroup.add(chip);
                });
            }
            group.add(cpGroup);
        }

        return group;
    }

    return createDetailedRack;
}));
