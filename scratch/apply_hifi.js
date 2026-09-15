const fs = require('fs');

let html = fs.readFileSync('public/code_artifact.html', 'utf8');

const getBlock = (startStr, endStr) => {
    const start = html.indexOf(startStr);
    const end = html.indexOf(endStr, start);
    if(start === -1 || end === -1) throw new Error('Cannot find ' + startStr);
    return html.substring(start, end);
};

const newChiller = `    createChiller(x, z, label, isMirrored = false) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        const sign = isMirrored ? 1 : -1;

        // a) EVAPORATOR
        const evap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.52, 32), this.mats.chillerBody);
        evap.rotation.z = Math.PI / 2;
        evap.position.set(0, 0.62, 0.30);
        group.add(evap);
        
        const evapCapL = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.18, 32), this.mats.chillerDark);
        evapCapL.rotation.z = Math.PI/2; evapCapL.position.set(-1.35, 0.62, 0.30); group.add(evapCapL);
        const evapCapR = evapCapL.clone(); evapCapR.position.set(1.35, 0.62, 0.30); group.add(evapCapR);
        
        [-1.0, -0.3, 0.3, 1.0].forEach(sx => {
            const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16, 1, false, 0, Math.PI), this.mats.darkMetal);
            saddle.rotation.x = Math.PI; saddle.rotation.z = Math.PI/2;
            saddle.position.set(sx, 0.62, 0.30);
            group.add(saddle);
        });

        // b) CONDENSER
        const cond = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32), this.mats.chillerDark);
        cond.rotation.z = Math.PI / 2;
        cond.position.set(0, 1.16, -0.30);
        group.add(cond);
        
        const condCapL = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.18, 32), this.mats.chillerDark);
        condCapL.rotation.z = Math.PI/2; condCapL.position.set(-1.35, 1.16, -0.30); group.add(condCapL);
        const condCapR = condCapL.clone(); condCapR.position.set(1.35, 1.16, -0.30); group.add(condCapR);

        // c) COMPRESSOR
        const comp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.20, 24), this.mats.chillerMotor);
        comp1.rotation.z = Math.PI/2; comp1.position.set(0, 0.88, 0); group.add(comp1);
        const comp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.20, 24), this.mats.chillerMotor);
        comp2.rotation.z = Math.PI/2; comp2.position.set(0, 1.05, 0); group.add(comp2);
        
        const suction = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.15, 24), this.mats.chillerMotor);
        suction.rotation.x = -Math.PI/2; suction.position.set(0, 0.88, 0.175); group.add(suction);

        // d) MOTOR
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.58, 24), this.mats.chillerMotor);
        motor.rotation.z = Math.PI/2; motor.position.set(0, 1.16, 0); group.add(motor);
        for(let i=0; i<10; i++) {
            const fin = new THREE.Mesh(new THREE.TorusGeometry(0.156, 0.008, 8, 24), this.mats.chillerDark);
            fin.rotation.y = Math.PI/2; fin.position.set(-0.25 + i*0.05, 1.16, 0); group.add(fin);
        }
        const termBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.08), this.mats.chillerMotor);
        termBox.position.set(0, 1.35, 0); group.add(termBox);

        // f) OIL SEPARATOR
        const oilSep = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), this.mats.darkMetal);
        oilSep.position.set(0, 1.35, 0.05); group.add(oilSep);

        // g) CONTROL PANEL
        const cp = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.50, 0.08), this.mats.darkMetal);
        cp.position.set(sign*0.5, 0.70, 0.75); 
        group.add(cp);
        
        // h) NAMEPLATE
        const np = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.015), new THREE.MeshStandardMaterial({color:0xfbbf24}));
        np.position.set(0, 0.80, 0.74); group.add(np);

        // i) EVAP NOZZLES (CHWS + CHWR)
        [0.45, 0.15].forEach(nz => {
            const vNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.30, 16), this.mats.chillerBody);
            vNoz.position.set(sign*1.16, 1.21, nz); group.add(vNoz);
            const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), this.mats.chillerBody);
            elbow.position.set(sign*1.16, 1.35, nz); group.add(elbow);
            const hNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.20, 16), this.mats.chillerBody);
            hNoz.rotation.z = Math.PI/2; hNoz.position.set(sign*1.26, 1.35, nz); group.add(hNoz);
            const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), this.mats.darkMetal);
            flange.rotation.z = Math.PI/2; flange.position.set(sign*1.36, 1.35, nz); group.add(flange);
        });

        // j) COND NOZZLES (CWS + CWR)
        [-0.15, -0.45].forEach(nz => {
            const vNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.40, 16), this.mats.chillerDark);
            vNoz.position.set(sign*0.9, 1.55, nz); group.add(vNoz);
            const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), this.mats.darkMetal);
            flange.position.set(sign*0.9, 1.75, nz); group.add(flange);
        });

        group.add(this.createLabel(label, 2.5));
        
        group.userData = { type: 'Chiller', tag: label, desc: 'Centrifugal Chiller 800 RT', rating: '800 RT' };
        if(!this.interactables) this.interactables = [];
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 1, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
`;

const newPump = `    createPump(x, z, label, type) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const baseMat = new THREE.MeshStandardMaterial({color:0x8b949e, metalness:0.08, roughness:0.92});
        const voluteMat = new THREE.MeshStandardMaterial({color:0x374151, metalness:0.78, roughness:0.38});
        const motorMat = type === 'CHWP' ? this.mats.chillerMotor : new THREE.MeshStandardMaterial({color:0x14532d,metalness:0.6,roughness:0.35});

        // a) INERTIA BASE
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.55), baseMat);
        base.position.set(0, 0.06, 0); group.add(base);

        // b) VOLUTE CASING
        const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.205, 0.27, 28), voluteMat);
        volute.rotation.x = Math.PI/2; volute.position.set(0, 0.38, 0.24); group.add(volute);

        // c) BEARING BRACKET
        const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.095, 0.225, 24), this.mats.darkMetal);
        bracket.rotation.x = Math.PI/2; bracket.position.set(0, 0.38, 0.012); group.add(bracket);

        // d) SHAFT COUPLING
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 16, 1, true, 0, Math.PI*1.5), this.mats.darkMetal);
        guard.rotation.x = Math.PI/2; guard.position.set(0, 0.38, -0.175); group.add(guard);

        // e) MOTOR
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.150, 0.150, 0.52, 24), motorMat);
        motor.rotation.x = Math.PI/2; motor.position.set(0, 0.38, -0.555); group.add(motor);
        for(let i=0; i<10; i++) {
            const fin = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.007, 6, 24), this.mats.darkMetal);
            fin.position.set(0, 0.38, -0.38 - i*0.045); group.add(fin);
        }

        // g) SUCTION FLANGE
        const sFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), this.mats.darkMetal);
        sFlange.rotation.x = Math.PI/2; sFlange.position.set(0, 0.35, 0.65); group.add(sFlange); // Ensure y=0.35

        // h) DISCHARGE FLANGE
        const dFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), this.mats.darkMetal);
        dFlange.position.set(0, 0.65, 0.30); group.add(dFlange); // Ensure y=0.65

        group.add(this.createLabel(label, 1.5));
        
        group.userData = { type: 'Pump', tag: label, desc: 'Centrifugal Pump', rating: type==='CHWP'?'55 kW':'75 kW' };
        if(!this.interactables) this.interactables = [];
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 2), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 0.6, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
`;

const newTower = `    createCoolingTower(x, y, z, label) {
        const group = new THREE.Group();
        group.position.set(x, y, z); 

        const basinMat = new THREE.MeshStandardMaterial({color:0x1c2730, metalness:0.45, roughness:0.70});
        const frameMat = new THREE.MeshStandardMaterial({color:0x374151, metalness:0.70, roughness:0.42});
        const louverMat = new THREE.MeshStandardMaterial({color:0x8ea5b4, metalness:0.28, roughness:0.62});

        // a) BASIN
        const basin = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.45, 3.72), basinMat);
        basin.position.set(0, 0.225, 0); group.add(basin);

        // b) FRAME
        [[-1.82, -1.82], [1.82, -1.82], [-1.82, 1.82], [1.82, 1.82]].forEach(pos => {
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.70, 0.08), frameMat);
            col.position.set(pos[0], 1.575, pos[1]); group.add(col);
        });

        // c) LOUVERS 
        const louverGeo = new THREE.BoxGeometry(3.6, 1.5, 0.05);
        [ [0,1.2,1.82,0], [0,1.2,-1.82,0], [1.82,1.2,0,Math.PI/2], [-1.82,1.2,0,Math.PI/2] ].forEach(pos => {
            const lv = new THREE.Mesh(louverGeo, louverMat);
            lv.rotation.y = pos[3]; lv.position.set(pos[0], pos[1], pos[2]); group.add(lv);
        });

        // j) FAN DECK
        const deck = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.054, 3.82), frameMat);
        deck.position.set(0, 2.73, 0); group.add(deck);

        // k) FAN STACK
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.44, 1.30, 0.65, 30), this.mats.darkMetal);
        stack.position.set(0, 3.08, 0); group.add(stack);

        // g) CWR INLET NOZZLE (SIDE) 
        // Need valves at x = -1.2 for CT-01 and 4.8 for CT-02? 
        // We will just place the nozzle at local (1.86, 2.60, 0)
        // Wait, for CT-01, the pipe comes from the right side (+x). For CT-02, from left side (-x).
        // Let's just put nozzles on BOTH sides so it looks good from any connection
        [-1.86, 1.86].forEach(nx => {
            const cwrNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), this.mats.darkMetal);
            cwrNoz.rotation.z = Math.PI/2; cwrNoz.position.set(nx, 2.60, 0); group.add(cwrNoz);
            
            const cwsNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), this.mats.darkMetal);
            cwsNoz.rotation.z = Math.PI/2; cwsNoz.position.set(nx, 0.40, 0); group.add(cwsNoz);
        });

        group.add(this.createLabel(label, 4.0));
        
        group.userData = { type: 'Tower', tag: label, desc: 'Cooling Tower', rating: '1200 RT' };
        if(!this.interactables) this.interactables = [];
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 2, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
`;

const newPHX = `    createPHX(x, z, label) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const frameMat = new THREE.MeshStandardMaterial({color:0x1e3a8a, metalness:0.72, roughness:0.32});
        
        // b) FIXED FRAME PLATE
        const front = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.46, 0.11), frameMat);
        front.position.set(0, 0.78, 0.49); group.add(front);
        
        // c) MOVABLE PLATE
        const rear = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.46, 0.09), frameMat);
        rear.position.set(0, 0.78, -0.49); group.add(rear);

        // d) PLATE PACK
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.30, 0.82), this.mats.phxPlate);
        pack.position.set(0, 0.78, 0); group.add(pack);

        // g) CONNECTION NOZZLES (TOP Facing Up)
        const flGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
        [-0.45, -0.15, 0.15, 0.45].forEach((offset, idx) => {
            const fl = new THREE.Mesh(flGeo, this.mats.darkMetal);
            fl.position.set(0, 1.52, offset);
            group.add(fl);
        });

        group.add(this.createLabel(label, 2.2));
        
        group.userData = { type: 'PHX', tag: label, desc: 'Plate Heat Exchanger', rating: 'Free Cooling HX' };
        if(!this.interactables) this.interactables = [];
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1.5), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 1, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
`;

const oldChiller = getBlock('createChiller(x, z, label, isMirrored = false) {', '    }');
const oldPump = getBlock('createPump(x, z, label, type) {', '    }');
const oldTower = getBlock('createCoolingTower(x, y, z, label) {', '    }');
const oldPHX = getBlock('createPHX(x, z, label) {', '    }');

html = html.replace(oldChiller + '    }', newChiller + '    }');
html = html.replace(oldPump + '    }', newPump + '    }');
html = html.replace(oldTower + '    }', newTower + '    }');
html = html.replace(oldPHX + '    }', newPHX + '    }');

// Add Expansion Tank to buildPlant
const tkCode = `        // Expansion Tank Injection
        const tankGroup = new THREE.Group();
        tankGroup.position.set(-9.0, 0, -3.0);

        const _tkMat = new THREE.MeshStandardMaterial({color:0xb91c1c,metalness:0.58,roughness:0.42}); // red
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.55, 28), _tkMat);
        body.position.set(0, 1.375, 0); body.castShadow = true; tankGroup.add(body);
        
        const topDome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 12, 0, Math.PI*2, 0, Math.PI/2), _tkMat);
        topDome.position.set(0, 2.15, 0); tankGroup.add(topDome);
        
        const botDome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 12, 0, Math.PI*2, 0, Math.PI/2), _tkMat);
        botDome.rotation.x = Math.PI; botDome.position.set(0, 0.60, 0); tankGroup.add(botDome);
        
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.60, 16, 1, true), this.mats.darkMetal);
        skirt.position.set(0, 0.30, 0); tankGroup.add(skirt);
        
        tankGroup.userData = { type: 'Tank', tag: 'EXP-01', desc: 'Bladder Expansion Tank', rating: '800 Liters' };
        if(!this.interactables) this.interactables = [];
        const hitBoxTk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3), new THREE.MeshBasicMaterial({visible:false}));
        hitBoxTk.position.set(0, 1.5, 0); hitBoxTk.userData = tankGroup.userData;
        tankGroup.add(hitBoxTk);
        this.interactables.push(hitBoxTk);
        
        tankGroup.add(this.createLabel('EXP-01', 2.8));
        this.scene.add(tankGroup);

        this.drawAllPipes();`;

html = html.replace('this.drawAllPipes();', tkCode);

fs.writeFileSync('public/code_artifact.html', html, 'utf8');
console.log('Successfully injected high-fidelity models!');
