const fs = require('fs');

const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BIM HVAC Digital Twin (Recovered & Upgraded)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <style>
        body { margin: 0; overflow: hidden; background-color: #0f172a; }
        #canvas-container { width: 100vw; height: 100vh; }
        #ui-layer { position: absolute; top: 0; left: 0; padding: 20px; pointer-events: none; color: white; }
    </style>
</head>
<body>
    <div id="ui-layer">
        <h1 class="text-3xl font-bold mb-2 text-cyan-400 drop-shadow-md">HVAC Plant Digital Twin</h1>
        <p class="text-slate-300">System Source Code Recovered & Piping Refined.</p>
    </div>
    <div id="canvas-container"></div>

<script>
class DigitalTwinApp {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.02);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 15, 25);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 2, -5);

        this.initLights();
        this.initMaterials();
        this.buildPlant();

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        const pointLight = new THREE.PointLight(0x38bdf8, 0.5, 50);
        pointLight.position.set(0, 10, -5);
        this.scene.add(pointLight);
    }

    initMaterials() {
        this.mats = {
            floor: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
            chillerBody: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.5 }),
            chillerDark: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.7 }),
            chillerMotor: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4, metalness: 0.2 }),
            pipeCHWS: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.2 }),
            pipeCHWR: new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.3, metalness: 0.2 }),
            pipeCWS: new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.3, metalness: 0.2 }),
            pipeCWR: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3, metalness: 0.2 }),
            darkMetal: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7, metalness: 0.8 }),
            phxPlate: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.6 }),
            labelBg: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 })
        };
    }

    createLabel(text, yOffset = 2.5) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.roundRect(0, 0, 512, 128, 30);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 502, 118);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);
        
        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.y = yOffset;
        return sprite;
    }

    drawOrthogonalPipe(pathPoints, mat, radius = 0.12) {
        const group = new THREE.Group();
        for(let i = 0; i < pathPoints.length - 1; i++) {
            const start = new THREE.Vector3(...pathPoints[i]);
            const end = new THREE.Vector3(...pathPoints[i+1]);
            const len = start.distanceTo(end);
            if(len < 0.01) continue;

            const geom = new THREE.CylinderGeometry(radius, radius, len, 16);
            const pipe = new THREE.Mesh(geom, mat);
            pipe.position.copy(start).add(end).multiplyScalar(0.5);
            pipe.lookAt(end);
            pipe.rotateX(Math.PI/2);
            pipe.castShadow = true;
            group.add(pipe);

            // Flanges at ends
            const flangeGeom = new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, 0.04, 16);
            const flange1 = new THREE.Mesh(flangeGeom, this.mats.chillerDark);
            flange1.position.copy(start); flange1.lookAt(end); flange1.rotateX(Math.PI/2);
            group.add(flange1);

            const flange2 = new THREE.Mesh(flangeGeom, this.mats.chillerDark);
            flange2.position.copy(end); flange2.lookAt(start); flange2.rotateX(Math.PI/2);
            group.add(flange2);

            if (i > 0) {
                const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.2, 16, 16), mat);
                elbow.position.copy(start);
                group.add(elbow);
            }
        }
        this.scene.add(group);
    }

    createChiller(x, z, label, isMirrored = false) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Evaporator (Bottom)
        const evapGeo = new THREE.CylinderGeometry(0.44, 0.44, 2.52, 32);
        const evap = new THREE.Mesh(evapGeo, this.mats.chillerBody);
        evap.rotation.z = Math.PI / 2;
        evap.position.set(0, 0.62, 0.3);
        evap.castShadow = true;
        group.add(evap);

        // Condenser (Top)
        const condGeo = new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32);
        const cond = new THREE.Mesh(condGeo, this.mats.chillerDark);
        cond.rotation.z = Math.PI / 2;
        cond.position.set(0, 1.16, -0.3);
        cond.castShadow = true;
        group.add(cond);

        // Motor Box
        const motorBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), this.mats.chillerMotor);
        motorBox.position.set(0, 1.5, -0.3);
        group.add(motorBox);

        // Support Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.4, 1.2);
        const leg1 = new THREE.Mesh(legGeo, this.mats.darkMetal);
        leg1.position.set(-1.0, 0.2, 0); group.add(leg1);
        const leg2 = new THREE.Mesh(legGeo, this.mats.darkMetal);
        leg2.position.set(1.0, 0.2, 0); group.add(leg2);

        // Water Boxes & Top Nozzles!
        const sign = isMirrored ? 1 : -1; 
        // If mirrored (CH-02), nozzles on right (+x). If not (CH-01), on left (-x).
        
        const evapBoxGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.2, 32);
        const evapBox = new THREE.Mesh(evapBoxGeo, this.mats.darkMetal);
        evapBox.rotation.z = Math.PI / 2;
        evapBox.position.set(sign * 1.36, 0.62, 0.3);
        group.add(evapBox);

        // Evap Nozzles (Turn OUTWARDS)
        const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 16);
        const turnGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16);
        [0.45, 0.15].forEach(nz => {
            const nV = new THREE.Mesh(nozzleGeo, this.mats.chillerBody);
            nV.position.set(sign * 1.16, 1.21, nz); // Pointing up from bottom barrel
            group.add(nV);
            
            const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), this.mats.chillerBody);
            elbow.position.set(sign * 1.16, 1.35, nz);
            group.add(elbow);

            const nH = new THREE.Mesh(turnGeo, this.mats.chillerBody);
            nH.rotation.z = Math.PI / 2;
            nH.position.set(sign * 1.26, 1.35, nz); // Pointing outwards
            group.add(nH);

            const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), this.mats.chillerDark);
            fl.rotation.z = Math.PI / 2;
            fl.position.set(sign * 1.36, 1.35, nz);
            group.add(fl);
        });

        // Condenser Nozzles (Point Straight UP)
        const condBoxGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.2, 32);
        const condBox = new THREE.Mesh(condBoxGeo, this.mats.darkMetal);
        condBox.rotation.z = Math.PI / 2;
        condBox.position.set(sign * 1.36, 1.16, -0.3);
        group.add(condBox);

        [-0.15, -0.45].forEach(nz => {
            const nV = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16), this.mats.chillerDark);
            nV.position.set(sign * 0.9, 1.55, nz);
            group.add(nV);

            const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), this.mats.chillerBody);
            fl.position.set(sign * 0.9, 1.75, nz);
            group.add(fl);
        });

        group.add(this.createLabel(label, 2.5));
        this.scene.add(group);
    }

    createCoolingTower(x, y, z, label) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // Basin
        const basin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 3.6), this.mats.darkMetal);
        basin.position.y = 0.2; basin.castShadow = true;
        group.add(basin);

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3.4), this.mats.phxPlate);
        body.position.y = 1.5; body.castShadow = true;
        group.add(body);

        // Louvers
        for(let i=0; i<5; i++) {
            const louver = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.08, 0.1), this.mats.darkMetal);
            louver.position.set(0, 0.8 + i*0.3, 1.71);
            group.add(louver);
        }

        // Fan Stack & Blades
        const fanStack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.6, 24), this.mats.chillerDark);
        fanStack.position.set(0, 2.9, 0);
        group.add(fanStack);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), this.mats.chillerMotor);
        hub.position.set(0, 3.1, 0);
        group.add(hub);

        for(let i=0; i<4; i++) {
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 1.1), this.mats.darkMetal);
            blade.position.set(0, 3.1, 0);
            blade.rotation.y = i * Math.PI / 2;
            group.add(blade);
        }

        // Side Valves!
        // We know from images they face +x (right side of tower)
        const valveGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 16);
        const flGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
        
        // Hot Water In (Top)
        const vTop = new THREE.Mesh(valveGeo, this.mats.pipeCWR);
        vTop.rotation.z = Math.PI / 2; vTop.position.set(1.85, 2.6, 0); group.add(vTop);
        const flTop = new THREE.Mesh(flGeo, this.mats.darkMetal);
        flTop.rotation.z = Math.PI / 2; flTop.position.set(2.0, 2.6, 0); group.add(flTop);

        // Cold Water Out (Bottom)
        const vBot = new THREE.Mesh(valveGeo, this.mats.pipeCWS);
        vBot.rotation.z = Math.PI / 2; vBot.position.set(1.85, 0.4, 0); group.add(vBot);
        const flBot = new THREE.Mesh(flGeo, this.mats.darkMetal);
        flBot.rotation.z = Math.PI / 2; flBot.position.set(2.0, 0.4, 0); group.add(flBot);

        group.add(this.createLabel(label, 4.0));
        this.scene.add(group);
    }

    createPump(x, z, label, type) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        
        // Base
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 1.5), this.mats.darkMetal);
        base.position.y = 0.075; group.add(base);
        
        // Motor
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16), this.mats.chillerMotor);
        motor.rotation.x = Math.PI / 2; motor.position.set(0, 0.35, -0.2); group.add(motor);
        
        // Volute
        const volute = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), type === 'CHWP' ? this.mats.pipeCHWS : this.mats.pipeCWR);
        volute.position.set(0, 0.35, 0.3); group.add(volute);

        // Flanges
        const flGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
        const flSuct = new THREE.Mesh(flGeo, this.mats.darkMetal);
        flSuct.rotation.x = Math.PI / 2; flSuct.position.set(0, 0.35, 0.65); group.add(flSuct); // End suction
        
        const flDisch = new THREE.Mesh(flGeo, this.mats.darkMetal);
        flDisch.position.set(0, 0.65, 0.3); group.add(flDisch); // Top discharge

        group.add(this.createLabel(label, 1.5));
        this.scene.add(group);
    }

    createPHX(x, z, label) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const frameGeo = new THREE.BoxGeometry(0.8, 1.5, 2.0);
        const frame = new THREE.Mesh(frameGeo, this.mats.darkMetal);
        frame.position.y = 0.75; group.add(frame);

        const plateGeo = new THREE.BoxGeometry(0.6, 1.4, 1.8);
        const plate = new THREE.Mesh(plateGeo, this.mats.phxPlate);
        plate.position.y = 0.75; group.add(plate);

        // Flanges facing up for easy connection
        const flGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
        [-0.45, -0.15, 0.15, 0.45].forEach((offset, idx) => {
            const fl = new THREE.Mesh(flGeo, this.mats.darkMetal);
            fl.position.set(0, 1.52, offset);
            group.add(fl);
        });

        group.add(this.createLabel(label, 2.2));
        this.scene.add(group);
    }

    buildPlant() {
        // Floor
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), this.mats.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        const grid = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
        grid.position.y = 0.01;
        this.scene.add(grid);

        // Chillers (CH-01 facing left, CH-02 facing right)
        this.createChiller(-1.5, 1.0, 'CH-01 (800 RT)', false);
        this.createChiller(4.0, 1.0, 'CH-02 (800 RT)', true);

        // PHX
        this.createPHX(-9.0, -15.0, 'PHX-01');

        // Cooling Towers (Roof)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 8), this.mats.darkMetal);
        roof.position.set(0, 7.75, -17.5);
        this.scene.add(roof);
        this.createCoolingTower(-3.0, 8.0, -17.5, 'CT-01');
        this.createCoolingTower(3.0, 8.0, -17.5, 'CT-02');

        // Pumps
        this.createPump(-6.5, -7.0, 'CHWP-1', 'CHWP');
        this.createPump(-5.0, -7.0, 'CHWP-2', 'CHWP');
        this.createPump(-3.5, -7.0, 'CHWP-3', 'CHWP');
        this.createPump(1.5, -7.0, 'CWP-1', 'CWP');
        this.createPump(3.0, -7.0, 'CWP-2', 'CWP');
        this.createPump(4.5, -7.0, 'CWP-3', 'CWP');

        this.drawAllPipes();
    }

    drawAllPipes() {
        const matCHWS = this.mats.pipeCHWS;
        const matCHWR = this.mats.pipeCHWR;
        const matCWS = this.mats.pipeCWS;
        const matCWR = this.mats.pipeCWR;

        // === CH-01 (x = -1.5) ===
        // Evap (Left side nozzles: x = -2.86)
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.45], [-3.5, 1.35, 1.45], [-2.86, 1.35, 1.45]], matCHWS); // In
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.15], [-3.5, 1.35, 1.15], [-2.86, 1.35, 1.15]], matCHWR); // Out
        // Cond (Top nozzles: x = -2.4)
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.85], [-2.4, 1.75, 0.85]], matCWS); // In
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.55], [-2.4, 1.75, 0.55]], matCWR); // Out

        // === CH-02 (x = 4.0) ===
        // Evap (Right side nozzles: x = 5.36)
        this.drawOrthogonalPipe([[6.0, 3.8, 1.45], [6.0, 1.35, 1.45], [5.36, 1.35, 1.45]], matCHWS); // In
        this.drawOrthogonalPipe([[6.0, 3.8, 1.15], [6.0, 1.35, 1.15], [5.36, 1.35, 1.15]], matCHWR); // Out
        // Cond (Top nozzles: x = 4.9)
        this.drawOrthogonalPipe([[4.9, 4.4, 0.85], [4.9, 1.75, 0.85]], matCWS); // In
        this.drawOrthogonalPipe([[4.9, 4.4, 0.55], [4.9, 1.75, 0.55]], matCWR); // Out

        // === Main Headers ===
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.45], [-3.5, 3.8, -11.0], [6.0, 3.8, -11.0], [6.0, 3.8, 1.45]], matCHWS);
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.15], [-3.5, 3.8, -11.5], [6.0, 3.8, -11.5], [6.0, 3.8, 1.15]], matCHWR);
        
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.55], [-2.4, 4.4, -13.0], [4.9, 4.4, -13.0], [4.9, 4.4, 0.55]], matCWR);
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.85], [-2.4, 4.4, -12.5], [4.9, 4.4, -12.5], [4.9, 4.4, 0.85]], matCWS);

        // === Cooling Towers ===
        // CT-01 (x = -3.0). Valves at x = -3.0 + 2.0 = -1.0
        this.drawOrthogonalPipe([[-0.5, 5.8, -13.0], [-0.5, 5.8, -17.5], [-0.5, 10.6, -17.5], [-1.0, 10.6, -17.5]], matCWR);
        this.drawOrthogonalPipe([[-1.0, 8.4, -17.5], [-0.5, 8.4, -17.5], [-0.5, 5.0, -17.5], [-0.5, 5.0, -13.0]], matCWS);
        
        // CT-02 (x = 3.0). Valves at x = 3.0 + 2.0 = 5.0
        this.drawOrthogonalPipe([[5.5, 5.8, -13.0], [5.5, 5.8, -17.5], [5.5, 10.6, -17.5], [5.0, 10.6, -17.5]], matCWR);
        this.drawOrthogonalPipe([[5.0, 8.4, -17.5], [5.5, 8.4, -17.5], [5.5, 5.0, -17.5], [5.5, 5.0, -13.0]], matCWS);

        this.drawOrthogonalPipe([[-0.5, 5.8, -13.0], [5.5, 5.8, -13.0]], matCWR); // CT CWR Header
        this.drawOrthogonalPipe([[-0.5, 5.0, -13.0], [5.5, 5.0, -13.0]], matCWS); // CT CWS Header

        // === Pumps ===
        [-6.5, -5.0, -3.5].forEach(px => {
            this.drawOrthogonalPipe([[px, 0.35, -11.5], [px, 0.35, -6.35]], matCHWR); // Suction
            this.drawOrthogonalPipe([[px, 0.65, -7.0], [px, 4.4, -7.0], [px, 4.4, -11.0]], matCHWS); // Discharge
        });
        
        [1.5, 3.0, 4.5].forEach(px => {
            this.drawOrthogonalPipe([[px, 5.0, -13.0], [px, 0.35, -13.0], [px, 0.35, -6.35]], matCWS); // Suction
            this.drawOrthogonalPipe([[px, 0.65, -7.0], [px, 3.2, -7.0], [px, 3.2, -13.0]], matCWR); // Discharge
        });
        
        this.drawOrthogonalPipe([[-6.5, 4.4, -11.0], [-3.5, 4.4, -11.0]], matCHWS);
        this.drawOrthogonalPipe([[1.5, 3.2, -13.0], [4.9, 3.2, -13.0], [4.9, 4.4, -13.0]], matCWR);

        // === PHX ===
        this.drawOrthogonalPipe([[-9.0, 3.8, -11.0], [-9.0, 3.8, -14.55], [-9.0, 1.52, -14.55]], matCHWS);
        this.drawOrthogonalPipe([[-9.0, 1.52, -14.85], [-9.0, 1.5, -14.85], [-8.0, 1.5, -14.85], [-8.0, 3.8, -14.85], [-8.0, 3.8, -11.5]], matCHWR);
        this.drawOrthogonalPipe([[-9.0, 1.52, -15.15], [-9.0, 5.0, -15.15], [-9.0, 5.0, -13.0]], matCWS);
        this.drawOrthogonalPipe([[-9.0, 5.8, -13.0], [-9.0, 5.8, -15.45], [-9.0, 1.52, -15.45]], matCWR);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

window.onload = () => {
    new DigitalTwinApp();
};
</script>
</body>
</html>`;

fs.writeFileSync('public/code_artifact.html', htmlContent, 'utf8');
console.log('Successfully reconstructed code_artifact.html!');
