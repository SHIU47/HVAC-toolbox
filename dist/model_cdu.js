/**
 * HVAC & Semiconductor 3D Digital Twin - CDU (Coolant Distribution Unit) Model Generator
 * Extracted from: C:\Users\user\OneDrive\桌面\HVAC-Pro\public\whitespace\app.js
 * 
 * Generates an ultra-detailed Liquid Cooling CDU (Coolant Distribution Unit):
 * - Forklift-accessible structural base & corner structural pillars
 * - Semi-transparent architectural enclosure panels & double glass window doors
 * - Top roof plate with NVIDIA brand badge
 * - Dual internal vertical cyan LED neon light strips
 * - 2x High-capacity Plate Heat Exchangers (PHX) with clamping plates & guide bars
 * - 3x Secondary variable-frequency canned motor pumps with 24 cooling fins & volutes
 * - Electronic control board with dynamic HMI screen canvas & 3-color status LED bezels
 * - 3x Pump VFD inverter driver boxes with cooling grilles & EMC filters
 * - 3x Nitrogen-pressurized Expansion Vessels with brass pressure relief valves
 * - Stainless steel primary/secondary distribution manifolds, flow meters & isolation valves
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('three'));
    } else {
        root.createDetailedCDU = factory(root.THREE);
    }
}(typeof self !== 'undefined' ? self : this, function (THREE) {
    'use strict';

    if (!THREE) {
        throw new Error('Three.js is required for createDetailedCDU');
    }

    let cachedCDUTextures = null;
    function getCDUTextures(supplyTemp = 45.0, returnTemp = 55.0, flow = 320.0, pressure = 2.45) {
        if (!cachedCDUTextures) {
            // 1. NVIDIA logo badge
            const c6 = document.createElement('canvas');
            c6.width = 640; c6.height = 200;
            const ctx6 = c6.getContext('2d');
            ctx6.fillStyle = '#1b2431'; ctx6.fillRect(0, 0, 640, 200);
            ctx6.fillStyle = '#76b900';
            ctx6.beginPath();
            ctx6.moveTo(60, 42); ctx6.quadraticCurveTo(158, 20, 158, 100);
            ctx6.quadraticCurveTo(158, 180, 60, 158); ctx6.quadraticCurveTo(104, 100, 60, 42);
            ctx6.closePath(); ctx6.fill();
            ctx6.fillStyle = '#eef1f5';
            ctx6.font = 'bold 72px Arial, sans-serif';
            ctx6.textAlign = 'left'; ctx6.textBaseline = 'middle';
            ctx6.fillText('NVIDIA', 200, 104);
            const nvidiaLogo = new THREE.CanvasTexture(c6);

            // 2. CDU Screen HMI texture
            const c2 = document.createElement('canvas');
            c2.width = 512; c2.height = 256;
            const ctx2 = c2.getContext('2d');
            ctx2.fillStyle = '#020617'; ctx2.fillRect(0, 0, 512, 256);
            ctx2.fillStyle = '#76b900'; ctx2.fillRect(0, 0, 512, 36);
            ctx2.fillStyle = '#000'; ctx2.font = 'bold 20px monospace'; ctx2.fillText('CDU CONTROL PANEL v3.2', 14, 25);
            ctx2.fillStyle = '#0ea5e9'; ctx2.font = 'bold 30px monospace'; ctx2.fillText(`SUPPLY: ${supplyTemp.toFixed(1)}°C`, 20, 85);
            ctx2.fillStyle = '#ef4444'; ctx2.font = 'bold 30px monospace'; ctx2.fillText(`RETURN: ${returnTemp.toFixed(1)}°C`, 20, 130);
            ctx2.fillStyle = '#fff'; ctx2.font = '22px monospace'; ctx2.fillText(`FLOW:   ${flow.toFixed(1)} L/min`, 20, 175);
            ctx2.fillText(`PRESS:  ${pressure.toFixed(2)} Bar`, 20, 212);
            ctx2.fillStyle = '#22c55e'; ctx2.font = 'bold 18px monospace'; ctx2.fillText('● ALL SYSTEMS NOMINAL', 20, 246);
            const cduScreen = new THREE.CanvasTexture(c2);

            cachedCDUTextures = { nvidiaLogo, cduScreen };
        }
        return cachedCDUTextures;
    }

    /**
     * Creates an ultra-detailed 3D Coolant Distribution Unit (CDU).
     * @param {Object} options Configuration parameters
     * @returns {THREE.Group} CDU group
     */
    function createDetailedCDU(options = {}) {
        const {
            x = 0,
            y = 0,
            z = 0,
            rotY = 0,
            name = 'CDU-A (Primary)',
            supplyTemp = 45.0,
            returnTemp = 55.0,
            flow = 320.0,
            pressure = 2.45,
            showGlass = true,
            glassOpacity = 0.55
        } = options;

        const w = 1.2, h = 2.2, d = 1.0;
        const group = new THREE.Group();
        group.position.set(x, y + h / 2, z);
        group.rotation.y = rotY;
        group.userData = { type: 'CDU', name: name };

        const tex = getCDUTextures(supplyTemp, returnTemp, flow, pressure);

        // Materials
        const stainlessMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.25, clearcoat: 0.3 });
        const stainlessBrushed = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.75, roughness: 0.45 });
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.7 });
        const pumpMotorMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.7, clearcoat: 0.1 });
        const vesselWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.2, metalness: 0.1 });
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });
        const phxCoreMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.6 });
        const sideMat = new THREE.MeshPhysicalMaterial({
            color: 0x0f172a,
            transmission: 0.4,
            transparent: true,
            opacity: glassOpacity,
            side: THREE.DoubleSide,
            roughness: 0.1,
            clearcoat: 0.6
        });

        // Helper: Pipe Flange
        const createFlange = (radius, thickness, boltCount = 8) => {
            const fg = new THREE.Group();
            const disk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 24), stainlessMat);
            disk.rotation.x = Math.PI / 2;
            fg.add(disk);
            for (let i = 0; i < boltCount; i++) {
                const angle = (i / boltCount) * Math.PI * 2;
                const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, thickness + 0.012, 6), ironMat);
                bolt.rotation.x = Math.PI / 2;
                bolt.position.set(Math.cos(angle) * (radius * 0.75), Math.sin(angle) * (radius * 0.75), 0);
                fg.add(bolt);
            }
            return fg;
        };

        const createPipe = (radius, length, material = stainlessMat) => {
            return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), material);
        };

        // 1. Skid Base & Forklift Troughs
        const baseGroup = new THREE.Group();
        const skidBase = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), ironMat);
        skidBase.position.y = -h / 2 + 0.05;
        baseGroup.add(skidBase);

        [-0.3, 0.3].forEach(px => {
            const hole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, d + 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            hole.position.set(px, -h / 2 + 0.05, 0);
            baseGroup.add(hole);
        });
        group.add(baseGroup);

        // Vertical Frame Pillars (4 corners)
        const pillarGeo = new THREE.BoxGeometry(0.04, h - 0.1, 0.04);
        [
            [-w / 2 + 0.02, d / 2 - 0.02], [w / 2 - 0.02, d / 2 - 0.02],
            [-w / 2 + 0.02, -d / 2 + 0.02], [w / 2 - 0.02, -d / 2 + 0.02]
        ].forEach(p => {
            const pMesh = new THREE.Mesh(pillarGeo, ironMat);
            pMesh.position.set(p[0], 0.05, p[1]);
            group.add(pMesh);
        });

        // 2. Top Roof Plate & NVIDIA Badge
        const topPlate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), ironMat);
        topPlate.position.set(0, h / 2, 0);
        group.add(topPlate);

        const nvidiaBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.11), new THREE.MeshBasicMaterial({ map: tex.nvidiaLogo }));
        nvidiaBadge.position.set(0, h / 2 - 0.09, -d / 2 - 0.005);
        nvidiaBadge.rotation.y = Math.PI;
        group.add(nvidiaBadge);

        const botPlate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), ironMat);
        botPlate.position.set(0, -h / 2 + 0.02, 0);
        group.add(botPlate);

        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.02), sideMat);
        backPanel.position.z = -d / 2 + 0.02;
        group.add(backPanel);

        // Side Panels & Ventilation Louvers
        if (showGlass) {
            [-1, 1].forEach(side => {
                const sideGroup = new THREE.Group();
                sideGroup.position.set(side * (w / 2 - 0.02), 0, 0);

                const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.02, h - 0.08, d - 0.08), sideMat);
                sideGroup.add(sidePanel);

                for (let i = 0; i < 12; i++) {
                    const louver = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012, d * 0.5), stainlessBrushed);
                    louver.position.set(side * 0.015, 0.2 + i * 0.03, 0);
                    louver.rotation.z = side * 0.4;
                    sideGroup.add(louver);
                }
                group.add(sideGroup);
            });

            // Double Glass Front Doors with Hollow Frames
            const createGlassDoor = (dw, dh, dt, bw, xOffset) => {
                const door = new THREE.Group();
                const top = new THREE.Mesh(new THREE.BoxGeometry(dw, bw, dt), ironMat);
                top.position.set(xOffset, dh / 2 - bw / 2, 0);
                door.add(top);

                const bottom = new THREE.Mesh(new THREE.BoxGeometry(dw, bw, dt), ironMat);
                bottom.position.set(xOffset, -dh / 2 + bw / 2, 0);
                door.add(bottom);

                const left = new THREE.Mesh(new THREE.BoxGeometry(bw, dh - bw * 2, dt), ironMat);
                left.position.set(xOffset - dw / 2 + bw / 2, 0, 0);
                door.add(left);

                const right = new THREE.Mesh(new THREE.BoxGeometry(bw, dh - bw * 2, dt), ironMat);
                right.position.set(xOffset + dw / 2 - bw / 2, 0, 0);
                door.add(right);

                const glass = new THREE.Mesh(new THREE.PlaneGeometry(dw - bw * 2, dh - bw * 2), sideMat);
                glass.position.set(xOffset, 0, dt / 2);
                door.add(glass);

                return door;
            };

            const leftDoor = createGlassDoor(w / 2, h - 0.08, 0.02, 0.04, -w / 4);
            leftDoor.position.z = d / 2 - 0.01;
            group.add(leftDoor);

            const rightDoor = createGlassDoor(w / 2, h - 0.08, 0.02, 0.04, w / 4);
            rightDoor.position.z = d / 2 - 0.01;
            group.add(rightDoor);
        }

        // Dual Internal Cyan LED Light Strips
        const neonLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h - 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
        neonLeft.position.set(-w / 2 + 0.08, 0, d / 2 - 0.06);
        group.add(neonLeft);

        const neonRight = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h - 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
        neonRight.position.set(-0.08, 0, d / 2 - 0.06);
        group.add(neonRight);

        // 3. Bottom: 2x Large Plate Heat Exchangers (PHX)
        const buildPHX = () => {
            const phx = new THREE.Group();
            const pw = 0.25, ph = 0.5, pd = 0.4;
            const core = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), phxCoreMat);
            phx.add(core);

            const clampThk = 0.04;
            [-1, 1].forEach(dir => {
                const clamp = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.04, ph + 0.04, clampThk), ironMat);
                clamp.position.z = dir * (pd / 2 + clampThk / 2);
                phx.add(clamp);
            });

            const barGeo = new THREE.BoxGeometry(0.02, 0.04, pd + 0.1);
            const topBar = new THREE.Mesh(barGeo, stainlessMat); topBar.position.y = ph / 2 + 0.04; phx.add(topBar);
            const botBar = new THREE.Mesh(barGeo, stainlessMat); botBar.position.y = -ph / 2 - 0.04; phx.add(botBar);
            return phx;
        };

        const phx1 = buildPHX(); phx1.position.set(-0.25, -0.55, 0.1); group.add(phx1);
        const phx2 = buildPHX(); phx2.position.set(0.25, -0.55, 0.1); group.add(phx2);

        // 4. Middle: 3x Secondary Canned Motor Pumps
        const buildXduPump = () => {
            const pump = new THREE.Group();
            const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.25, 24), pumpMotorMat);
            motorBody.rotation.x = Math.PI / 2;
            motorBody.position.set(0, 0, 0.15);
            pump.add(motorBody);

            for (let i = 0; i < 24; i++) {
                const angle = (i / 24) * Math.PI * 2;
                const fin = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.02, 0.22), pumpMotorMat);
                fin.position.set(Math.cos(angle) * 0.095, Math.sin(angle) * 0.095, 0.15);
                fin.rotation.z = angle;
                pump.add(fin);
            }

            const volute = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 24), ironMat);
            volute.scale.set(1, 1, 0.6);
            volute.position.set(0, -0.02, -0.05);
            pump.add(volute);

            const discharge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16), ironMat);
            discharge.position.set(0, 0.1, -0.05);
            pump.add(discharge);

            const dFlange = createFlange(0.05, 0.015);
            dFlange.position.set(0, 0.15, -0.05);
            dFlange.rotation.x = Math.PI / 2;
            pump.add(dFlange);

            const suction = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16), ironMat);
            suction.rotation.x = Math.PI / 2;
            suction.position.set(0, -0.02, -0.15);
            pump.add(suction);

            return pump;
        };

        [-0.32, 0, 0.32].forEach((px, i) => {
            const p = buildXduPump();
            p.position.set(px, 0.1, 0.1);
            p.userData = { type: 'Pump', name: `CDU Secondary Pump ${i + 1}` };
            group.add(p);
        });

        // 5. Upper Section: Controller & VFD Inverters
        const elecPanel = new THREE.Group();
        elecPanel.position.set(0, 0.6, 0.35);

        const ctrlBoard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.04), ironMat);
        ctrlBoard.position.set(0, 0.25, 0.03);
        elecPanel.add(ctrlBoard);

        // HMI Live Screen
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.09), new THREE.MeshBasicMaterial({ map: tex.cduScreen }));
        screen.position.set(-0.2, 0.25, 0.051);
        elecPanel.add(screen);

        // 3-color status indicator lenses
        [0x22c55e, 0xfbbf24, 0xef4444].forEach((c, i) => {
            const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.01, 16), stainlessMat);
            bezel.rotation.x = Math.PI / 2;
            bezel.position.set(0.1 + i * 0.04, 0.25, 0.05);
            elecPanel.add(bezel);

            const lens = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 16), new THREE.MeshBasicMaterial({ color: c }));
            lens.position.set(0.1 + i * 0.04, 0.25, 0.054);
            elecPanel.add(lens);
        });

        // 3x Inverters
        [-0.25, 0, 0.25].forEach(px => {
            const inv = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.08), pumpMotorMat);
            inv.position.set(px, -0.05, 0.05);
            elecPanel.add(inv);

            const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true }));
            vent.position.set(px, -0.1, 0.091);
            elecPanel.add(vent);

            const emc = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.03), stainlessMat);
            emc.position.set(px + 0.11, -0.05, 0.03);
            elecPanel.add(emc);
        });
        group.add(elecPanel);

        // 6. Top: 3x White Expansion Vessels
        const vesselGroup = new THREE.Group();
        [-0.25, 0, 0.25].forEach(px => {
            const v = new THREE.Group();
            const vr = 0.09, vh = 0.2;
            const cyl = new THREE.Mesh(new THREE.CylinderGeometry(vr, vr, vh, 24), vesselWhiteMat);
            const topSphere = new THREE.Mesh(new THREE.SphereGeometry(vr, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), vesselWhiteMat);
            topSphere.position.y = vh / 2;
            const botSphere = new THREE.Mesh(new THREE.SphereGeometry(vr, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), vesselWhiteMat);
            botSphere.position.y = -vh / 2;
            v.add(cyl, topSphere, botSphere);

            const prValve = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04), brassMat);
            prValve.position.y = vh / 2 + vr + 0.02;
            v.add(prValve);

            const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1), stainlessMat);
            conn.position.y = -vh / 2 - 0.05;
            v.add(conn);

            v.position.set(px, 0.85, -0.1);
            vesselGroup.add(v);
        });
        group.add(vesselGroup);

        // 7. Manifolds & Flow Meters
        const pipeGroup = new THREE.Group();
        const mainHeader1 = createPipe(0.06, 1.8, stainlessMat);
        mainHeader1.position.set(0.4, 0, -0.2);
        pipeGroup.add(mainHeader1);

        const mainHeader2 = createPipe(0.06, 1.8, stainlessMat);
        mainHeader2.position.set(0.4, 0, -0.38);
        pipeGroup.add(mainHeader2);

        const flowMeter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 24), ironMat);
        flowMeter.position.set(0.4, 0.5, -0.2);
        pipeGroup.add(flowMeter);

        const upperManifold = createPipe(0.05, 0.8, stainlessMat);
        upperManifold.rotation.z = Math.PI / 2;
        upperManifold.position.set(0, 0.45, 0.05);
        pipeGroup.add(upperManifold);

        [-0.32, 0, 0.32].forEach(px => {
            const branch = createPipe(0.03, 0.2, stainlessMat);
            branch.position.set(px, 0.35, 0.05);
            pipeGroup.add(branch);

            const isoValve = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), ironMat);
            isoValve.position.set(px, 0.35, 0.05);
            pipeGroup.add(isoValve);
        });

        const vesselManifold = createPipe(0.02, 0.6, stainlessMat);
        vesselManifold.rotation.z = Math.PI / 2;
        vesselManifold.position.set(0, 0.65, -0.1);
        pipeGroup.add(vesselManifold);

        const lowerManifold = createPipe(0.05, 0.8, stainlessMat);
        lowerManifold.rotation.z = Math.PI / 2;
        lowerManifold.position.set(0, -0.2, 0.1);
        pipeGroup.add(lowerManifold);

        group.add(pipeGroup);

        return group;
    }

    return createDetailedCDU;
}));
