/**
 * HVAC & Semiconductor 3D Digital Twin - Centrifugal Pump Model Generator
 * Extracted from: C:\Users\user\OneDrive\桌面\HVAC-Pro\public\chiller-plant\app.js
 * 
 * Generates an ultra-detailed Centrifugal Pump (CHWP / CWP):
 * - Heavy structural skid base with I-beam rails & anchor pads
 * - Precision volute casing with front & back plates, drain plug
 * - Impeller hub with 6 fastening bolts
 * - Suction inlet nozzle with elastomeric flexible joint & companion flange
 * - Bearing frame housing & coupling guard with elastomeric spider
 * - Ribbed TEFC motor barrel, terminal box with conduit, and VFD color ring
 * - Vertical discharge spool with elbow, test tee & flange
 * - Dual analog dial pressure gauges with procedural canvas needles & brass cases
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('three'));
    } else {
        root.createCentrifugalPump = factory(root.THREE);
    }
}(typeof self !== 'undefined' ? self : this, function (THREE) {
    'use strict';

    if (!THREE) {
        throw new Error('Three.js is required for createCentrifugalPump');
    }

    /**
     * Helper to create dynamic canvas analog dial pressure gauges
     */
    function createPressureGauge(x, y, z, rotY, valRatio, metalMat) {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = rotY;

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), metalMat);
        stem.position.y = 0.045;
        g.add(stem);

        const gc = document.createElement('canvas');
        gc.width = 64; gc.height = 64;
        const gCtx = gc.getContext('2d');
        gCtx.fillStyle = '#fff'; gCtx.fillRect(0, 0, 64, 64);
        gCtx.strokeStyle = '#000'; gCtx.lineWidth = 3;
        gCtx.beginPath(); gCtx.arc(32, 32, 28, 0, Math.PI * 2); gCtx.stroke();

        // Pressure dial markings
        for (let a = 0; a < 8; a++) {
            const angle = Math.PI * 0.75 + (a / 7) * Math.PI * 1.5;
            gCtx.beginPath();
            gCtx.moveTo(32 + Math.cos(angle) * 22, 32 + Math.sin(angle) * 22);
            gCtx.lineTo(32 + Math.cos(angle) * 26, 32 + Math.sin(angle) * 26);
            gCtx.stroke();
        }

        // Needle (Red)
        const needleAngle = Math.PI * 0.75 + valRatio * Math.PI * 1.5;
        gCtx.strokeStyle = '#ef4444'; gCtx.lineWidth = 3;
        gCtx.beginPath(); gCtx.moveTo(32, 32);
        gCtx.lineTo(32 + Math.cos(needleAngle) * 20, 32 + Math.sin(needleAngle) * 20);
        gCtx.stroke();

        const gFace = new THREE.Mesh(
            new THREE.CircleGeometry(0.033, 16),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc) })
        );
        gFace.position.set(0.034, 0.1, 0);
        gFace.rotation.y = Math.PI / 2;
        g.add(gFace);

        const gCase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.033, 0.033, 0.023, 12),
            new THREE.MeshStandardMaterial({ color: 0xcab08a, metalness: 0.6, roughness: 0.3 })
        );
        gCase.rotation.z = Math.PI / 2;
        gCase.position.set(0.012, 0.1, 0);
        g.add(gCase);

        return g;
    }

    /**
     * Creates an ultra-detailed 3D Centrifugal Pump.
     * @param {Object} options Configuration parameters
     * @returns {THREE.Group} Pump group
     */
    function createCentrifugalPump(options = {}) {
        const {
            x = 0,
            y = 0,
            z = 0,
            rotY = 0,
            name = 'CHWP-01',
            type = 'chwp', // 'chwp' (blue) or 'cwp' (green)
            suctionPressureRatio = 0.35,
            dischargePressureRatio = 0.72
        } = options;

        const isCHWP = type.toLowerCase().includes('chw');
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotY;
        group.userData = { type: 'Pump', name: name, pumpType: type };

        // Materials
        const alumMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 });
        const ironPump = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.78, roughness: 0.38 });
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.12, roughness: 0.92 });
        const couplingMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.4, roughness: 0.3 });
        const motorBodyMat = new THREE.MeshStandardMaterial({
            color: isCHWP ? 0x1d4ed8 : 0x065f46,
            metalness: 0.6,
            roughness: 0.35
        });

        // 1. Skid Base & Mounting Rails
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.13, 1.55), baseMat);
        skid.position.set(0, 0.065, -0.08);
        skid.castShadow = skid.receiveShadow = true;
        group.add(skid);

        [-0.23, 0.23].forEach(bx => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.022, 1.52), alumMat);
            rail.position.set(bx, 0.152, -0.08);
            group.add(rail);

            const webL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.062, 1.52), alumMat);
            webL.position.set(bx, 0.122, -0.08);
            group.add(webL);
        });

        [[-0.25, -0.58], [-0.25, 0.43], [0.25, -0.58], [0.25, 0.43]].forEach(([fx, fz]) => {
            const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.068, 12), alumMat);
            pad.position.set(fx, 0.034, fz);
            group.add(pad);

            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.09, 8), alumMat);
            bolt.position.set(fx, 0.045, fz);
            group.add(bolt);
        });

        // 2. Pump Volute Casing
        const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.235, 0.27, 28), ironPump);
        volute.rotation.x = Math.PI / 2;
        volute.position.set(0, 0.35, 0.24);
        volute.castShadow = true;
        group.add(volute);

        const volutePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.022, 28), ironPump);
        volutePlate.rotation.x = Math.PI / 2;
        volutePlate.position.set(0, 0.35, 0.375);
        group.add(volutePlate);

        const backPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.205, 0.028, 24), ironPump);
        backPlate.rotation.x = Math.PI / 2;
        backPlate.position.set(0, 0.35, 0.098);
        group.add(backPlate);

        [-0.1, 0.12].forEach(bz => {
            const brace = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.085, 0.062), alumMat);
            brace.position.set(0, 0.215, 0.24 + bz);
            group.add(brace);
        });

        // Drain port
        const drainPort = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.042, 8), alumMat);
        drainPort.rotation.z = Math.PI / 2;
        drainPort.position.set(0.255, 0.195, 0.24);
        group.add(drainPort);

        // Impeller hub bolts
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const boltHole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.038, 6), alumMat);
            boltHole.rotation.x = Math.PI / 2;
            boltHole.position.set(Math.cos(angle) * 0.238, 0.35 + Math.sin(angle) * 0.238, 0.395);
            group.add(boltHole);
        }

        // Suction inlet (Horizontal)
        const suctionInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.078, 0.095, 14), ironPump);
        suctionInlet.rotation.x = Math.PI / 2;
        suctionInlet.position.set(0, 0.32, 0.615);
        group.add(suctionInlet);

        const suctionRubber = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.078, 14), baseMat);
        suctionRubber.rotation.x = Math.PI / 2;
        suctionRubber.position.set(0, 0.32, 0.713);
        group.add(suctionRubber);

        const suctionConnFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.065, 16), alumMat);
        suctionConnFlange.rotation.x = Math.PI / 2;
        suctionConnFlange.position.set(0, 0.32, 0.812);
        group.add(suctionConnFlange);

        // 3. Centerline Bearing Housing & Coupling
        const bearingHsg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.19, 18), alumMat);
        bearingHsg.rotation.x = Math.PI / 2;
        bearingHsg.position.set(0, 0.35, -0.225);
        group.add(bearingHsg);

        const couplingGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.026, 12), alumMat);
        couplingGuard.rotation.x = Math.PI / 2;
        couplingGuard.position.set(0, 0.35, -0.225);
        group.add(couplingGuard);

        // Yellow coupling spider
        const spider = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), couplingMat);
        spider.rotation.x = Math.PI / 2;
        spider.position.set(0, 0.35, -0.118);
        group.add(spider);

        // 4. Electric Motor Barrel
        const motorBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.52, 20), motorBodyMat);
        motorBarrel.rotation.x = Math.PI / 2;
        motorBarrel.position.set(0, 0.35, -0.555);
        motorBarrel.castShadow = true;
        group.add(motorBarrel);

        // Motor cooling fins (10 fins)
        for (let r = 0; r < 10; r++) {
            const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20), motorBodyMat);
            rib.rotation.x = Math.PI / 2;
            rib.position.set(0, 0.35, -0.308 - r * 0.048);
            group.add(rib);
        }

        // Fan shroud
        const fanShroudEnd = new THREE.Mesh(
            new THREE.CylinderGeometry(0.168, 0.168, 0.14, 20),
            new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.5, roughness: 0.55 })
        );
        fanShroudEnd.rotation.x = Math.PI / 2;
        fanShroudEnd.position.set(0, 0.35, -0.9);
        group.add(fanShroudEnd);

        // Terminal Junction Box
        const jBox = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.095, 0.17), alumMat);
        jBox.position.set(0, 0.513, -0.555);
        group.add(jBox);

        const jBoxLid = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.016, 0.175), alumMat);
        jBoxLid.position.set(0, 0.563, -0.555);
        group.add(jBoxLid);

        // VFD colored indicator band
        const indicator = new THREE.Mesh(
            new THREE.CylinderGeometry(0.154, 0.154, 0.032, 20),
            new THREE.MeshStandardMaterial({ color: isCHWP ? 0x3b82f6 : 0x22c55e, metalness: 0.3, roughness: 0.6 })
        );
        indicator.rotation.x = Math.PI / 2;
        indicator.position.set(0, 0.35, -0.445);
        group.add(indicator);

        // Safety label
        const labelPlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 0.058, 0.095),
            new THREE.MeshStandardMaterial({ color: 0xe59419, metalness: 0.3, roughness: 0.7 })
        );
        labelPlate.position.set(-0.153, 0.35, -0.61);
        group.add(labelPlate);

        // 5. Vertical Discharge Spool & Flange
        const suctionStub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3), ironPump);
        suctionStub.position.set(0, 0.695, 0.3);
        group.add(suctionStub);

        const suctionFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.124, 0.124, 0.02, 14), alumMat);
        suctionFlange.position.set(0, 0.85, 0.3);
        group.add(suctionFlange);

        const dischargeElbow = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.115, 14), alumMat);
        dischargeElbow.position.set(0, 0.93, 0.3);
        group.add(dischargeElbow);

        const dischargeFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.065, 14), alumMat);
        dischargeFlange.position.set(0, 1.168, 0.3);
        group.add(dischargeFlange);

        // 6. Analog Dial Pressure Gauges
        group.add(createPressureGauge(-0.115, 0.415, 0.73, Math.PI / 3, suctionPressureRatio, alumMat));
        group.add(createPressureGauge(0.115, 0.795, 0.3, -Math.PI / 2, dischargePressureRatio, alumMat));

        return group;
    }

    return createCentrifugalPump;
}));
