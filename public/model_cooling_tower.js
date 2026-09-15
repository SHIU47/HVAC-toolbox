/**
 * HVAC & Semiconductor 3D Digital Twin - Cooling Tower Model Generator
 * Extracted from: C:\Users\user\OneDrive\桌面\HVAC-Pro\public\chiller-plant\app.js
 * 
 * Generates an ultra-detailed 900 RT Induced Draft Cooling Tower:
 * - Cold water collection basin with translucent water layer & corner isolators
 * - 4 heavy structural support pillars & perimeter frame rails
 * - 4-sided air intake louvers (32 tilted blades) exposing internal PVC fills
 * - Upper FRP casing enclosure panels & top maintenance deck
 * - Exterior aluminum caged access ladder with safety cage hoops
 * - Aerodynamic hollow fan cowl / shroud with reinforced top rim
 * - Animated 6-blade industrial orange aerofoil fan rotor on central hub
 * - Circular safety wire mesh grille (12 radial spokes + 4 concentric rings)
 * - Hot water inlet & cold water outlet flanged nozzles with vent valves
 * - Internal PVC fill pack block & water distribution spray tree (20 nozzles)
 * - Structural steel cross beams, direct-drive fan motor & drive shaft
 * - Industrial metallic nameplate canvas
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('three'));
    } else {
        root.createCoolingTower = factory(root.THREE);
    }
}(typeof self !== 'undefined' ? self : this, function (THREE) {
    'use strict';

    if (!THREE) {
        throw new Error('Three.js is required for createCoolingTower');
    }

    /**
     * Creates an ultra-detailed 3D Induced Draft Cooling Tower.
     * @param {Object} options Configuration parameters
     * @returns {THREE.Group} Cooling Tower group (exposes userData.fanRotator for animation)
     */
    function createCoolingTower(options = {}) {
        const {
            x = 0,
            y = 0,
            z = 0,
            rotY = 0,
            name = 'CT-01',
            capacity = '900 RT',
            ladderSide = 'left' // 'left' (-X) or 'right' (+X)
        } = options;

        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = rotY;
        group.userData = { type: 'CoolingTower', name: `Cooling Tower ${name} (${capacity})` };

        // Materials
        const casingMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.6 });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.35 });
        const alumMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 });
        const fanMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.6, roughness: 0.3 }); // High-contrast industrial orange
        const gridMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.4 });
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.7, roughness: 0.35 }); // Electric blue
        const fillMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.05, roughness: 0.95 }); // Dark PVC honeycomb
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.58, roughness: 0.52 });
        const upperPanelMat = new THREE.MeshStandardMaterial({ color: 0x8e9ab0, metalness: 0.28, roughness: 0.62 });

        // 1. Water Basin & Rubber Isolation Pads
        const basinBase = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.45, 3.72), casingMat);
        basinBase.position.set(0, 0.225, 0);
        basinBase.castShadow = basinBase.receiveShadow = true;
        group.add(basinBase);

        const basinWater = new THREE.Mesh(
            new THREE.BoxGeometry(3.6, 0.02, 3.6),
            new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.1, transparent: true, opacity: 0.8 })
        );
        basinWater.position.set(0, 0.44, 0);
        group.add(basinWater);

        [[-1.65, -1.65], [1.65, -1.65], [-1.65, 1.65], [1.65, 1.65]].forEach(([px, pz]) => {
            const pad = new THREE.Mesh(
                new THREE.BoxGeometry(0.18, 0.075, 0.18),
                new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.15, roughness: 0.88 })
            );
            pad.position.set(px, -0.038, pz);
            group.add(pad);
        });

        // Support Pillars
        [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([px, pz]) => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.75, 0.09), casingMat);
            pillar.position.set(px, 1.825, pz);
            pillar.castShadow = true;
            group.add(pillar);
        });

        // Horizontal perimeter rails
        [[3.44, 0.05, 0.05, 0, 1.25, 1.72], [3.44, 0.05, 0.05, 0, 1.25, -1.72],
         [0.05, 0.05, 3.44, 1.72, 1.25, 0], [0.05, 0.05, 3.44, -1.72, 1.25, 0]].forEach(([w, h, d, px, py, pz]) => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), casingMat);
            rail.position.set(px, py, pz);
            group.add(rail);
        });

        // 2. Air Intake Louvers (32 tilted blades)
        for (let i = 0; i < 8; i++) {
            const ly = 0.54 + i * 0.205;
            const louverS = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.056, 0.12), frameMat);
            louverS.position.set(0, ly, 1.72); louverS.rotation.x = 0.22;
            group.add(louverS);

            const louverN = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.056, 0.12), frameMat);
            louverN.position.set(0, ly, -1.72); louverN.rotation.x = -0.22;
            group.add(louverN);

            const louverE = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.056, 3.38), frameMat);
            louverE.position.set(1.72, ly, 0); louverE.rotation.z = -0.22;
            group.add(louverE);

            const louverW = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.056, 3.38), frameMat);
            louverW.position.set(-1.72, ly, 0); louverW.rotation.z = 0.22;
            group.add(louverW);
        }

        // 3. Upper FRP Casing Panels
        const panelN = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.78, 0.054), upperPanelMat);
        panelN.position.set(0, 1.99, 1.725); group.add(panelN);

        const panelS = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.78, 0.054), upperPanelMat);
        panelS.position.set(0, 1.99, -1.725); group.add(panelS);

        const panelE = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.78, 3.42), upperPanelMat);
        panelE.position.set(1.725, 1.99, 0); group.add(panelE);

        const panelW = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.78, 3.42), upperPanelMat);
        panelW.position.set(-1.725, 1.99, 0); group.add(panelW);

        // Deck Perimeter Plates with central fan aperture
        const deckPlateN = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.054, 0.61), deckMat);
        deckPlateN.position.set(0, 2.39, 1.605); group.add(deckPlateN);

        const deckPlateS = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.054, 0.61), deckMat);
        deckPlateS.position.set(0, 2.39, -1.605); group.add(deckPlateS);

        const deckPlateE = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.054, 2.6), deckMat);
        deckPlateE.position.set(1.605, 2.39, 0); group.add(deckPlateE);

        const deckPlateW = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.054, 2.6), deckMat);
        deckPlateW.position.set(-1.605, 2.39, 0); group.add(deckPlateW);

        // 4. Exterior Access Ladder with Safety Cage
        const ladderX = ladderSide === 'left' ? -1.84 : 1.84;
        const ladderZ = 0;

        [-0.2, 0.2].forEach(lz => {
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.5, 8), alumMat);
            rail.position.set(ladderX, 1.25, ladderZ + lz);
            rail.castShadow = true;
            group.add(rail);

            [0.4, 1.2, 2.0].forEach(by => {
                const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.024), frameMat);
                bracket.position.set(ladderX - Math.sign(ladderX) * 0.06, by, ladderZ + lz);
                group.add(bracket);
            });
        });

        for (let r = 0; r < 10; r++) {
            const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 8), alumMat);
            rung.rotation.x = Math.PI / 2;
            rung.position.set(ladderX, 0.2 + r * 0.24, ladderZ);
            rung.castShadow = true;
            group.add(rung);
        }

        // Safety cage hoops
        for (let h = 0; h < 3; h++) {
            const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 8, 24, Math.PI), alumMat);
            hoop.rotation.z = ladderX > 0 ? -Math.PI / 2 : Math.PI / 2;
            hoop.rotation.x = Math.PI / 2;
            hoop.position.set(ladderX, 1.6 + h * 0.4, ladderZ);
            hoop.castShadow = true;
            group.add(hoop);
        }

        [-0.21, 0, 0.21].forEach(lz => {
            const lxOffset = Math.sqrt(0.09 - lz * lz);
            const barX = ladderX + Math.sign(ladderX) * lxOffset;
            const verticalBar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.82, 6), alumMat);
            verticalBar.position.set(barX, 2.0, ladderZ + lz);
            verticalBar.castShadow = true;
            group.add(verticalBar);
        });

        // 5. Hollow Fan Cowl / Shroud
        const fanShroud = new THREE.Mesh(
            new THREE.CylinderGeometry(1.3, 1.44, 0.65, 32, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide })
        );
        fanShroud.position.set(0, 2.74, 0);
        fanShroud.castShadow = true;
        group.add(fanShroud);

        const shroudRim = new THREE.Mesh(
            new THREE.CylinderGeometry(1.31, 1.31, 0.042, 32, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5, roughness: 0.52, side: THREE.DoubleSide })
        );
        shroudRim.position.set(0, 3.08, 0);
        group.add(shroudRim);

        // 6. Fan Hub & 6 Aerofoil Blades (Animatable Rotator)
        const fanRotator = new THREE.Group();
        fanRotator.position.set(0, 2.82, 0);

        const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.066, 16), frameMat);
        fanRotator.add(fanHub);

        for (let b = 0; b < 6; b++) {
            const bladeGroup = new THREE.Group();
            bladeGroup.rotation.y = (b / 6) * Math.PI * 2;

            const bladeSegment = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.016, 1.08), fanMat);
            bladeSegment.position.set(0, 0, 0.54);
            bladeSegment.rotation.z = 0.22; // Aerodynamic pitch
            bladeSegment.castShadow = true;
            bladeGroup.add(bladeSegment);

            const tipCap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 6), alumMat);
            tipCap.rotation.z = Math.PI / 2;
            tipCap.position.set(0, 0, 1.08);
            bladeGroup.add(tipCap);

            fanRotator.add(bladeGroup);
        }
        group.add(fanRotator);
        group.userData.fanRotator = fanRotator;

        // 7. Top Safety Grille
        const grilleGroup = new THREE.Group();
        grilleGroup.position.set(0, 3.065, 0);

        for (let s = 0; s < 12; s++) {
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.008, 0.008), gridMat);
            spoke.rotation.y = (s / 12) * Math.PI;
            grilleGroup.add(spoke);
        }
        [0.4, 0.8, 1.2, 1.3].forEach(r => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 32), gridMat);
            ring.rotation.x = Math.PI / 2;
            grilleGroup.add(ring);
        });
        group.add(grilleGroup);

        // 8. Pipe Nozzle Connections
        const topPipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.075, 0.36, 10),
            new THREE.MeshStandardMaterial({ color: 0x7f7d77, metalness: 0.58, roughness: 0.42 })
        );
        topPipe.rotation.x = Math.PI / 2;
        topPipe.position.set(0, 2.3, 1.92);
        group.add(topPipe);

        const topFlange = new THREE.Mesh(
            new THREE.CylinderGeometry(0.116, 0.116, 0.02, 12),
            new THREE.MeshStandardMaterial({ color: 0x4a4a42, metalness: 0.65, roughness: 0.4 })
        );
        topFlange.rotation.x = Math.PI / 2;
        topFlange.position.set(0, 2.3, 2.1);
        group.add(topFlange);

        const botPipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085, 0.085, 0.36, 10),
            new THREE.MeshStandardMaterial({ color: 0x1c6e38, metalness: 0.58, roughness: 0.42 })
        );
        botPipe.rotation.x = Math.PI / 2;
        botPipe.position.set(0, 0.3, 1.92);
        group.add(botPipe);

        const botFlange = new THREE.Mesh(
            new THREE.CylinderGeometry(0.128, 0.128, 0.02, 12),
            new THREE.MeshStandardMaterial({ color: 0x1b5e30, metalness: 0.65, roughness: 0.4 })
        );
        botFlange.rotation.x = Math.PI / 2;
        botFlange.position.set(0, 0.3, 2.1);
        group.add(botFlange);

        // Vent valves
        const ventStemH = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 8), alumMat);
        ventStemH.position.set(0, 2.44, 2.19);
        group.add(ventStemH);

        const ventRingH = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.011, 8, 14), alumMat);
        ventRingH.position.set(0, 2.575, 2.19);
        group.add(ventRingH);

        // 9. Internal PVC Fill Pack & Water Spray Header
        const fillPack = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.52, 3.38), fillMat);
        fillPack.position.set(0, 0.96, 0);
        group.add(fillPack);

        const waterHeader = new THREE.Mesh(
            new THREE.CylinderGeometry(0.056, 0.056, 3.2, 12),
            new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.5 })
        );
        waterHeader.rotation.x = Math.PI / 2;
        waterHeader.position.set(0, 1.42, 0);
        group.add(waterHeader);

        [-0.8, -0.3, 0.3, 0.8].forEach(pz => {
            const branch = new THREE.Mesh(
                new THREE.CylinderGeometry(0.028, 0.028, 3.1, 8),
                new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.2, roughness: 0.5 })
            );
            branch.rotation.z = Math.PI / 2;
            branch.position.set(0, 1.42, pz);
            group.add(branch);

            [-1.0, -0.5, 0, 0.5, 1.0].forEach(bx => {
                const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.038, 8), alumMat);
                nozzle.position.set(bx, 1.38, pz);
                group.add(nozzle);
            });
        });

        // Motor Support Beams
        const beamH = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.09, 0.09), frameMat);
        beamH.position.set(0, 2.05, 0);
        group.add(beamH);

        const beamV = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 3.38), frameMat);
        beamV.position.set(0, 2.05, 0);
        group.add(beamV);

        // Fan Motor
        const motorGroup = new THREE.Group();
        motorGroup.position.set(0, 2.22, 0);

        const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.28, 12), motorMat);
        motorBody.castShadow = true;
        motorGroup.add(motorBody);

        const motorJBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), frameMat);
        motorJBox.position.set(0.13, 0.04, 0.06);
        motorGroup.add(motorJBox);

        for (let f = 0; f < 6; f++) {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.28, 0.034), motorMat);
            fin.rotation.y = (f / 6) * Math.PI;
            motorGroup.add(fin);
        }
        group.add(motorGroup);

        const driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.58, 8), alumMat);
        driveShaft.position.set(0, 2.62, 0);
        group.add(driveShaft);

        // 10. Cooling Tower Nameplate Canvas
        const infoCanvas = document.createElement('canvas');
        infoCanvas.width = 512; infoCanvas.height = 64;
        const infoCtx = infoCanvas.getContext('2d');
        infoCtx.fillStyle = '#0f172a'; infoCtx.fillRect(0, 0, 512, 64);
        infoCtx.strokeStyle = '#64748b'; infoCtx.lineWidth = 3;
        infoCtx.strokeRect(2, 2, 508, 60);
        infoCtx.fillStyle = '#e2e8f0'; infoCtx.font = 'bold 20px "Segoe UI", sans-serif';
        infoCtx.textAlign = 'center';
        infoCtx.fillText('INDUCED DRAFT COOLING TOWER', 256, 28);
        infoCtx.fillStyle = '#94a3b8'; infoCtx.font = '14px monospace';
        infoCtx.fillText(`${name}  |  ${capacity}  |  FRP Construction`, 256, 52);

        const infoMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1.85, 0.25),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(infoCanvas) })
        );
        infoMesh.position.set(0, 0.68, 1.745);
        group.add(infoMesh);

        return group;
    }

    return createCoolingTower;
}));
