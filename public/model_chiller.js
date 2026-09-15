/**
 * HVAC & Semiconductor 3D Digital Twin - Water-Cooled Chiller Model Generator
 * Extracted from: C:\Users\user\OneDrive\桌面\HVAC-Pro\public\chiller-plant\app.js
 * 
 * Generates an ultra-detailed 800 RT Water-Cooled Centrifugal Chiller:
 * - Dual vessels: Evaporator (blue insulated) + Condenser (green insulated)
 * - Heavy structural I-beam skid base with cross beams & anchor bolts
 * - Water boxes with hemispherical domed covers & 12 bolts per vessel
 * - Centrifugal compressor assembly (IGV, volute, diffuser, seal box)
 * - Suction riser & elbow, discharge expander piping loops
 * - Ribbed TEFC motor barrel, junction box & shaft coupling shield
 * - Vertical oil separator with spherical heads & copper tubing
 * - Starter control cabinet with live HMI monitor canvas & status LEDs
 * - Industrial metallic nameplate canvas
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('three'));
    } else {
        root.createWaterCooledChiller = factory(root.THREE);
    }
}(typeof self !== 'undefined' ? self : this, function (THREE) {
    'use strict';

    if (!THREE) {
        throw new Error('Three.js is required for createWaterCooledChiller');
    }

    /**
     * Creates an ultra-detailed 3D Water-Cooled Centrifugal Chiller.
     * @param {Object} options Configuration parameters
     * @returns {THREE.Group} Chiller group
     */
    function createWaterCooledChiller(options = {}) {
        const {
            x = 0,
            y = 0,
            z = 0,
            rotY = 0,
            name = 'CH-01 (800 RT)',
            cop = 6.20,
            load = 75.5,
            chws = 12.0,
            chwr = 18.0,
            cws = 28.5,
            cwr = 34.0
        } = options;

        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotY;
        group.userData = { type: 'Chiller', name: name };

        // Materials
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.35 });
        const chillerBody = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
        const compressorMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
        const alumMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 });
        const copperMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.2 });
        const hxPlate = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
        const controlPanelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.5 });
        const solenoidMat = new THREE.MeshStandardMaterial({ color: 0x645b4a, metalness: 0.7, roughness: 0.4 });

        const insulBlue = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, metalness: 0.1, roughness: 0.7 });
        const insulGreen = new THREE.MeshStandardMaterial({ color: 0x064e3b, metalness: 0.1, roughness: 0.7 });
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x2d3566, metalness: 0.72, roughness: 0.35 });
        const steelRibMat = new THREE.MeshStandardMaterial({ color: 0x1e2952, metalness: 0.72, roughness: 0.35 });
        const flangeMat = new THREE.MeshStandardMaterial({ color: 0x1c6e38, metalness: 0.8, roughness: 0.3 });

        // 1. Skid Base & Foundation Feet
        const skidL = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.12), darkMetal);
        skidL.position.set(0, 0.08, 0.54);
        skidL.castShadow = true;
        group.add(skidL);

        const skidR = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.12), darkMetal);
        skidR.position.set(0, 0.08, -0.54);
        skidR.castShadow = true;
        group.add(skidR);

        [-1.2, -0.4, 0.4, 1.2].forEach(bx => {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 1.08), darkMetal);
            beam.position.set(bx, 0.08, 0);
            group.add(beam);
        });

        [[-1.38, -0.48], [1.38, -0.48], [-1.38, 0.48], [1.38, 0.48]].forEach(([fx, fz]) => {
            const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 8), darkMetal);
            foot.position.set(fx, -0.02, fz);
            group.add(foot);

            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.09, 8), alumMat);
            bolt.position.set(fx, 0.045, fz);
            group.add(bolt);
        });

        // 2. Evaporator Shell (CHW side, insulated blue, radius 0.39)
        const evapShell = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32), insulBlue);
        evapShell.rotation.z = Math.PI / 2;
        evapShell.position.set(0, 0.57, -0.45);
        evapShell.castShadow = true;
        group.add(evapShell);

        for (let s = 0; s < 5; s++) {
            const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.395, 0.395, 0.028, 32), alumMat);
            strap.rotation.z = Math.PI / 2;
            strap.position.set(-0.95 + s * 0.5, 0.57, -0.45);
            group.add(strap);
        }

        // CHW Nozzles & Flanges (Left side)
        const ewGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.28, 12);
        const nozzFlangeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
        [[-1.48, 0.54, -0.6], [-1.48, 0.54, -0.3]].forEach(pos => {
            const nozzle = new THREE.Mesh(ewGeo, chillerBody);
            nozzle.rotation.z = Math.PI / 2;
            nozzle.position.set(...pos);
            group.add(nozzle);
        });
        [[-1.62, 0.54, -0.6], [-1.62, 0.54, -0.3]].forEach(pos => {
            const fl = new THREE.Mesh(nozzFlangeGeo, chillerBody);
            fl.rotation.z = Math.PI / 2;
            fl.position.set(...pos);
            group.add(fl);
        });

        const evapGlassOverlay = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.42, 2.54, 32),
            new THREE.MeshStandardMaterial({ color: 0xbfd7ea, transparent: true, opacity: 0.16, roughness: 0.95 })
        );
        evapGlassOverlay.rotation.z = Math.PI / 2;
        evapGlassOverlay.position.set(0, 0.57, -0.45);
        group.add(evapGlassOverlay);

        // 3. Condenser Shell (CW side, insulated green, radius 0.44)
        const condShell = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.52, 32), insulGreen);
        condShell.rotation.z = Math.PI / 2;
        condShell.position.set(0, 0.62, 0.45);
        condShell.castShadow = true;
        group.add(condShell);

        for (let s = 0; s < 5; s++) {
            const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.028, 32), alumMat);
            strap.rotation.z = Math.PI / 2;
            strap.position.set(-0.95 + s * 0.5, 0.62, 0.45);
            group.add(strap);
        }

        // CW Nozzles & Flanges (Left side)
        const cwGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.28, 12);
        [[-1.48, 0.58, 0.6], [-1.48, 0.58, 0.3]].forEach(pos => {
            const nozzle = new THREE.Mesh(cwGeo, chillerBody);
            nozzle.rotation.z = Math.PI / 2;
            nozzle.position.set(...pos);
            group.add(nozzle);
        });
        [[-1.62, 0.58, 0.6], [-1.62, 0.58, 0.3]].forEach(pos => {
            const fl = new THREE.Mesh(nozzFlangeGeo, chillerBody);
            fl.rotation.z = Math.PI / 2;
            fl.position.set(...pos);
            group.add(fl);
        });

        // Saddle supports
        [-0.76, 0.76].forEach(sx => {
            const saddleE = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.72), darkMetal);
            saddleE.position.set(sx, 0.26, -0.45);
            group.add(saddleE);

            const saddleC = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.82), darkMetal);
            saddleC.position.set(sx, 0.28, 0.45);
            group.add(saddleC);
        });

        // 4. Structural End Support Plates & Domed Water Boxes
        [-1.3, 1.3].forEach(px => {
            const supportPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 1.6), darkMetal);
            supportPlate.position.set(px, 0.58, 0);
            supportPlate.castShadow = true;
            group.add(supportPlate);

            // Circular water box heads
            const waterBoxEvap = new THREE.Mesh(new THREE.CylinderGeometry(0.395, 0.395, 0.12, 24), chillerBody);
            waterBoxEvap.rotation.z = Math.PI / 2;
            waterBoxEvap.position.set(px + Math.sign(px) * 0.08, 0.57, -0.45);
            group.add(waterBoxEvap);

            const waterBoxCond = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.12, 24), chillerBody);
            waterBoxCond.rotation.z = Math.PI / 2;
            waterBoxCond.position.set(px + Math.sign(px) * 0.08, 0.62, 0.45);
            group.add(waterBoxCond);

            // Spherical domed covers
            const domeEvap = new THREE.Mesh(
                new THREE.SphereGeometry(0.395, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                chillerBody
            );
            domeEvap.rotation.z = px > 0 ? Math.PI / 2 : -Math.PI / 2;
            domeEvap.position.set(px + Math.sign(px) * 0.14, 0.57, -0.45);
            group.add(domeEvap);

            const domeCond = new THREE.Mesh(
                new THREE.SphereGeometry(0.455, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                chillerBody
            );
            domeCond.rotation.z = px > 0 ? Math.PI / 2 : -Math.PI / 2;
            domeCond.position.set(px + Math.sign(px) * 0.14, 0.62, 0.45);
            group.add(domeCond);

            // Flange bolt rings (12 bolts each)
            for (let b = 0; b < 12; b++) {
                const angle = (b / 12) * Math.PI * 2;
                const boltE = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), alumMat);
                boltE.rotation.z = Math.PI / 2;
                boltE.position.set(px + Math.sign(px) * 0.14, 0.57 + Math.cos(angle) * 0.36, -0.45 + Math.sin(angle) * 0.36);
                group.add(boltE);

                const boltC = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), alumMat);
                boltC.rotation.z = Math.PI / 2;
                boltC.position.set(px + Math.sign(px) * 0.14, 0.62 + Math.cos(angle) * 0.42, 0.45 + Math.sin(angle) * 0.42);
                group.add(boltC);
            }
        });

        // 5. Centrifugal Compressor Assembly (elevated to y = 1.65)
        const compressor = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.44, 20), compressorMat);
        compressor.rotation.z = Math.PI / 2;
        compressor.position.set(-0.5, 1.65, 0);
        group.add(compressor);

        const igvCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.13, 20), alumMat);
        igvCap.rotation.z = Math.PI / 2;
        igvCap.position.set(-0.77, 1.65, 0);
        group.add(igvCap);

        const igvBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.08), alumMat);
        igvBox.position.set(-0.76, 1.91, 0.08);
        group.add(igvBox);

        const compVolute = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.36, 20), compressorMat);
        compVolute.rotation.z = Math.PI / 2;
        compVolute.position.set(-0.1, 1.65, 0);
        group.add(compVolute);

        const sealBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.28), hxPlate);
        sealBox.position.set(-0.3, 1.43, -0.22);
        group.add(sealBox);

        const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.32, 20), compressorMat);
        diffuser.rotation.z = Math.PI / 2;
        diffuser.position.set(0.22, 1.65, 0);
        group.add(diffuser);

        // Suction Connection
        const suctionRiser = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 16), compressorMat);
        suctionRiser.position.set(-0.77, 1.235, -0.45);
        group.add(suctionRiser);

        const suctionElbow = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.13, 16, 24, Math.PI / 2), compressorMat);
        suctionElbow.rotation.y = -Math.PI / 2;
        suctionElbow.position.set(-0.77, 1.51, -0.3);
        group.add(suctionElbow);

        const suctionStub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 16), compressorMat);
        suctionStub.rotation.x = Math.PI / 2;
        suctionStub.position.set(-0.77, 1.66, -0.15);
        group.add(suctionStub);

        // Discharge Connection & Expander
        const dischargeRiser = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.075, 16), compressorMat);
        dischargeRiser.position.set(-0.1, 1.8075, 0);
        group.add(dischargeRiser);

        const dischargeElbow1 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.09, 16, 24, Math.PI / 2), compressorMat);
        dischargeElbow1.rotation.y = -Math.PI / 2;
        dischargeElbow1.position.set(-0.1, 1.845, 0.12);
        group.add(dischargeElbow1);

        const dischargeHoriz = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.21, 16), compressorMat);
        dischargeHoriz.rotation.x = Math.PI / 2;
        dischargeHoriz.position.set(-0.1, 1.965, 0.225);
        group.add(dischargeHoriz);

        const dischargeElbow2 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.09, 16, 24, Math.PI / 2), compressorMat);
        dischargeElbow2.rotation.x = Math.PI;
        dischargeElbow2.rotation.y = -Math.PI / 2;
        dischargeElbow2.position.set(-0.1, 1.965, 0.45);
        group.add(dischargeElbow2);

        const dischargeVert = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.125, 16), compressorMat);
        dischargeVert.position.set(-0.1, 1.7825, 0.45);
        group.add(dischargeVert);

        const dischargeExpander = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.2, 0.66, 16), compressorMat);
        dischargeExpander.position.set(-0.1, 1.39, 0.45);
        group.add(dischargeExpander);

        // 6. High-Voltage Motor Barrel
        const motorBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 1.05, 20), motorMat);
        motorBarrel.rotation.z = Math.PI / 2;
        motorBarrel.position.set(0.9, 1.65, 0);
        motorBarrel.castShadow = true;
        group.add(motorBarrel);

        for (let r = 0; r < 10; r++) {
            const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.248, 0.022, 20), steelRibMat);
            rib.rotation.z = Math.PI / 2;
            rib.position.set(0.4 + r * 0.115, 1.65, 0);
            group.add(rib);
        }

        [0.36, 1.44].forEach(fx => {
            const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 20), flangeMat);
            fl.rotation.z = Math.PI / 2;
            fl.position.set(fx, 1.65, 0);
            group.add(fl);
        });

        const motorJunctionBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.14), darkMetal);
        motorJunctionBox.position.set(0.9, 1.93, 0.2);
        group.add(motorJunctionBox);

        const couplingShield = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 16), alumMat);
        couplingShield.rotation.z = Math.PI / 2;
        couplingShield.position.set(0.37, 1.65, 0);
        group.add(couplingShield);

        // 7. Vertical Oil Separator Vessel
        const oilSeparator = new THREE.Group();
        oilSeparator.position.set(-0.6, 0.72, 1.05);

        const separatorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.68, 12), darkMetal);
        separatorBody.castShadow = true;
        oilSeparator.add(separatorBody);

        const separatorDomeT = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkMetal);
        separatorDomeT.position.y = 0.34;
        oilSeparator.add(separatorDomeT);

        const separatorDomeB = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), darkMetal);
        separatorDomeB.rotation.x = Math.PI;
        separatorDomeB.position.y = -0.34;
        oilSeparator.add(separatorDomeB);

        const sepBracketT = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.60), alumMat);
        sepBracketT.position.set(0.08, 0.2, -0.30);
        oilSeparator.add(sepBracketT);

        const sepBracketB = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.60), alumMat);
        sepBracketB.position.set(0.08, -0.2, -0.30);
        oilSeparator.add(sepBracketB);

        group.add(oilSeparator);

        // Valve boxes
        [-1.0, 1.0].forEach(vx => {
            const vb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.35), darkMetal);
            vb.position.set(vx, 1.18, 0);
            vb.castShadow = true;
            group.add(vb);
        });

        // 8. Copper Lines, Solenoid & Expansion Valve
        const oilLineV = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), copperMat);
        oilLineV.position.set(-0.5, 1.32, -0.26);
        group.add(oilLineV);

        const oilLineH = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3), copperMat);
        oilLineH.rotation.x = Math.PI / 2;
        oilLineH.position.set(-0.5, 1.57, -0.43);
        group.add(oilLineH);

        const liqLineV = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48), copperMat);
        liqLineV.position.set(0.36, 1.29, 0.24);
        group.add(liqLineV);

        const liqLineH = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), copperMat);
        liqLineH.rotation.x = Math.PI / 2;
        liqLineH.position.set(0.36, 1.53, 0.4);
        group.add(liqLineH);

        // Solenoid
        const solenoid = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.16), solenoidMat);
        solenoid.rotation.z = Math.PI / 2;
        solenoid.position.set(-0.4, 0.18, -0.05);
        group.add(solenoid);

        const solenoidBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), copperMat);
        solenoidBox.position.set(-0.4, 0.18, -0.12);
        group.add(solenoidBox);

        // Expansion device
        const expDevice = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 12), alumMat);
        expDevice.position.set(-0.8, 1.15, 0.1);
        group.add(expDevice);

        const expBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), hxPlate);
        expBox.position.set(-0.8, 0.75, 0.1);
        group.add(expBox);

        const expStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46), copperMat);
        expStem.position.set(-0.74, 0.95, 0.04);
        group.add(expStem);

        // Sight glass
        const sightGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.16, 8), copperMat);
        sightGlass.position.set(0.45, 0.97, 0.3);
        group.add(sightGlass);

        // 9. Starter Control Cabinet with Dynamic HMI Canvas
        const cabShell = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.14), controlPanelMat);
        cabShell.position.set(-0.3, 1.0, -0.97);
        cabShell.castShadow = true;
        group.add(cabShell);

        // HMI Screen Canvas Texture
        const screenCanvas = document.createElement('canvas');
        screenCanvas.width = 512;
        screenCanvas.height = 256;
        const sCtx = screenCanvas.getContext('2d');
        sCtx.fillStyle = '#010c1a'; sCtx.fillRect(0, 0, 512, 256);
        sCtx.fillStyle = '#0c2d48'; sCtx.fillRect(0, 0, 512, 42);
        sCtx.fillStyle = '#38bdf8'; sCtx.font = 'bold 20px monospace';
        sCtx.fillText('● CHILLER CONTROL UNIT v4.1', 14, 28);
        sCtx.fillStyle = '#38bdf8'; sCtx.font = 'bold 30px monospace';
        sCtx.fillText(`CHWS: ${chws.toFixed(1)}°C   CHWR: ${chwr.toFixed(1)}°C`, 20, 90);
        sCtx.fillStyle = '#22c55e';
        sCtx.fillText(`CWS:  ${cws.toFixed(1)}°C   CWR: ${cwr.toFixed(1)}°C`, 20, 135);
        sCtx.fillStyle = '#e2e8f0'; sCtx.font = '20px monospace';
        sCtx.fillText(`COP: ${cop.toFixed(2)}   LOAD: ${load.toFixed(1)}%`, 20, 180);
        sCtx.fillStyle = '#22c55e'; sCtx.font = 'bold 18px monospace';
        sCtx.fillText('● COMPRESSOR RUNNING — AUTO MODE', 20, 225);

        const screenTexture = new THREE.CanvasTexture(screenCanvas);
        const screenMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.44, 0.23),
            new THREE.MeshBasicMaterial({ map: screenTexture })
        );
        screenMesh.position.set(-0.3, 1.1, -1.042);
        screenMesh.rotation.y = Math.PI;
        group.add(screenMesh);

        // Indicator LEDs
        [[-0.45, 0x22c5b0], [-0.37, 0x22c5b0], [-0.29, 0xfbbf24], [-0.21, 0x22c5b0]].forEach(([x_pos, col]) => {
            const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
            led.position.set(x_pos, 1.3, -1.042);
            group.add(led);
        });

        // E-Stop Button
        const estopBtn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12),
            new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
        );
        estopBtn.rotation.x = Math.PI / 2;
        estopBtn.position.set(-0.12, 1.3, -1.042);
        group.add(estopBtn);

        // Cabinet pedestal support
        const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.52, 0.1), darkMetal);
        lowerPanel.position.set(-0.3, 0.35, -0.97);
        group.add(lowerPanel);

        for (let sl = 0; sl < 6; sl++) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.01), alumMat);
            slat.position.set(-0.3, 0.18 + sl * 0.06, -1.022);
            group.add(slat);
        }

        // 10. Chiller Nameplate Canvas
        const npCanvas = document.createElement('canvas');
        npCanvas.width = 512; npCanvas.height = 128;
        const npCtx = npCanvas.getContext('2d');
        npCtx.fillStyle = '#0f172a'; npCtx.fillRect(0, 0, 512, 128);
        npCtx.strokeStyle = '#38bdf8'; npCtx.lineWidth = 4;
        npCtx.strokeRect(3, 3, 506, 122);
        npCtx.fillStyle = '#38bdf8'; npCtx.font = 'bold 30px monospace';
        npCtx.textAlign = 'center'; npCtx.textBaseline = 'middle';
        npCtx.fillText(name, 256, 46);
        npCtx.fillStyle = '#94a3b8'; npCtx.font = '18px monospace';
        npCtx.fillText('Water-Cooled Centrifugal  800 RT', 256, 95);

        const npMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1.1, 0.27),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(npCanvas) })
        );
        npMesh.position.set(0.5, 0.24, -0.92);
        npMesh.rotation.y = Math.PI;
        group.add(npMesh);

        return group;
    }

    return createWaterCooledChiller;
}));
