const fs = require('fs');

const FULL_HTML = `<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>冰機房 (Chiller Plant) | 高效冷卻核心</title>
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>

    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: { 
                extend: { 
                    colors: { 
                        dc: { 950:'#010205', 900:'#080c14', 800:'#0f172a', 700:'#1e293b' },
                        nv: { 500:'#38bdf8', 400:'#7dd3fc' } 
                    },
                    fontFamily: { sans: ['Inter', 'Segoe UI', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }
                } 
            }
        }
    </script>

    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Inter:wght@400;600;800&display=swap');
        body { background-color: #080c14; color: #e2e8f0; overflow: hidden; margin: 0; }
        
        #canvas-container { width: 100vw; height: 100vh; position: absolute; top: 0; left: 0; z-index: 1; cursor: grab; }
        #canvas-container:active { cursor: grabbing; }
        
        #ui-layer { position: absolute; inset: 0; pointer-events: none; z-index: 10; display: flex; flex-direction: column; }
        
        .glass-panel {
            background: rgba(8, 12, 20, 0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(51, 65, 85, 0.4); box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.8);
            pointer-events: auto;
        }

        .hud-left { 
            position: absolute; top: 80px; left: 20px; width: 320px; border-radius: 16px; padding: 20px; z-index: 40;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hud-right { 
            position: absolute; top: 80px; right: 20px; width: 340px; border-radius: 16px; padding: 20px; z-index: 50;
            opacity: 0; transform: translateX(20px); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none;
        }
        .hud-right.active { opacity: 1; transform: translateX(0); pointer-events: auto; }

        @media (max-width: 768px) {
            .hud-left, .hud-right { left: 5%; right: 5%; width: auto; top: 76px; transform: translateY(-10px) scale(0.98); opacity: 0; pointer-events: none; }
            .hud-left.active, .hud-right.active { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
        }

        .hud-bottom { 
            position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
            border-radius: 100px; padding: 8px; display: flex; gap: 8px; z-index: 40;
            width: max-content; max-width: 95vw; overflow-x: auto; scrollbar-width: none;
        }
        .btn-tool { 
            background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(51, 65, 85, 0.8); 
            color: #94a3b8; transition: all .2s; border-radius: 99px; padding: 10px 20px;
            font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; pointer-events: auto;
            white-space: nowrap; flex-shrink: 0; 
        }
        .btn-tool:hover { background: rgba(51, 65, 85, 0.8); color: #fff; }
        .btn-tool.active { background: rgba(56, 189, 248, 0.2); color: #7dd3fc; border-color: #38bdf8; }

        .metric-box { background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(51, 65, 85, 0.4); border-radius: 12px; padding: 12px; }
        .data-value { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 1.25rem; }
        .detail-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid rgba(51,65,85,0.45); }
        .detail-row:last-child { border-bottom: 0; }
        .detail-k { color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
        .detail-v { color: #e2e8f0; font-size: 12px; font-family: 'JetBrains Mono', monospace; text-align: right; overflow-wrap: anywhere; }
    </style>
</head>
<body class="antialiased">

    <div id="ui-layer">
        <header class="glass-panel w-full p-4 flex justify-between items-center border-b-0 rounded-b-xl max-w-[1800px] mx-auto mt-2">
            <div class="flex items-center gap-3 md:gap-4">
                <div class="bg-nv-500 p-2 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.4)]"><i class="ph-fill ph-snowflake text-black text-xl md:text-2xl"></i></div>
                <div>
                    <h1 class="text-sm md:text-lg font-black text-white flex items-center gap-2">
                        <span class="hidden md:inline">冰機房 (Chiller Plant) <span class="text-nv-400 font-normal">|</span></span> 高效冷卻核心
                    </h1>
                    <div class="text-[9px] md:text-[10px] text-slate-400 tracking-widest font-bold uppercase mt-0.5">High-Fidelity Thermodynamic Model</div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-[10px] md:text-xs font-bold text-nv-400 bg-nv-500/10 px-3 md:px-4 py-2 rounded-full border border-nv-500/30 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-nv-500 animate-pulse"></span> <span class="hidden md:inline">PLANT </span>ONLINE
                </div>
            </div>
        </header>

        <!-- Left HUD -->
        <div id="hud-left" class="hud-left glass-panel active">
            <h2 class="text-sm font-black text-white flex items-center gap-2 mb-4 pb-2 border-b border-slate-700">
                <i class="ph-fill ph-chart-line-up text-nv-400 text-lg"></i> 總體營運指標 (Global Metrics)
            </h2>
            
            <div class="space-y-3 mb-5">
                <div class="metric-box flex justify-between items-end border-l-2 border-nv-500">
                    <span class="text-xs text-slate-400 font-bold">總冷凍負載 (Total Load)</span>
                    <div class="text-right"><span id="hud_val_load" class="data-value text-white live-val" data-base="1650" data-var="25">1650</span><span class="text-[10px] text-nv-400 ml-1">RT</span></div>
                </div>
                <div class="metric-box flex justify-between items-end border-l-2 border-blue-500">
                    <span class="text-xs text-slate-400 font-bold">冰水出水溫 (CHWS)</span>
                    <div class="text-right"><span id="hud_val_chws" class="data-value text-blue-400 live-val" data-base="7.0" data-var="0.2">7.0</span><span class="text-[10px] text-blue-400 ml-1">°C</span></div>
                </div>
                <div class="metric-box flex justify-between items-end border-l-2 border-cyan-500">
                    <span class="text-xs text-slate-400 font-bold">冰水回水溫 (CHWR)</span>
                    <div class="text-right"><span id="hud_val_chwr" class="data-value text-cyan-400 live-val" data-base="12.0" data-var="0.3">12.0</span><span class="text-[10px] text-cyan-400 ml-1">°C</span></div>
                </div>
                <div class="flex gap-3">
                    <div class="metric-box flex-1 text-center">
                        <div class="text-[10px] text-slate-400 mb-1">冷卻水出水</div>
                        <div class="data-value text-green-400"><span class="live-val" data-base="29.5" data-var="0.4">29.5</span> <span class="text-[9px]">°C</span></div>
                    </div>
                    <div class="metric-box flex-1 text-center">
                        <div class="text-[10px] text-slate-400 mb-1">系統 COP</div>
                        <div class="data-value text-nv-400"><span class="live-val" data-base="6.2" data-var="0.05">6.2</span> <span class="text-[9px]">kW/RT</span></div>
                    </div>
                </div>
            </div>
            <div class="text-[10px] text-slate-500 leading-relaxed border-t border-slate-700 pt-3">
                <p>💡 提示：點擊 3D 場景中的設備 (冰機、水泵、冷卻水塔) 以檢視詳細運行數據。</p>
            </div>
        </div>

        <!-- Right HUD -->
        <div id="hud-detail" class="hud-right glass-panel">
            <div class="flex justify-between items-start mb-4 pb-2 border-b border-slate-700">
                <div>
                    <h2 id="detail-title" class="text-sm font-black text-white flex items-center gap-2">設備名稱</h2>
                    <div id="detail-subtitle" class="text-[10px] text-nv-400 font-mono mt-1">TAG</div>
                </div>
                <button onclick="APP.closeDetail()" class="text-slate-500 hover:text-white p-1 bg-slate-800 rounded-lg"><i class="ph ph-x"></i></button>
            </div>

            <div id="detail-profile" class="metric-box bg-slate-950/50 mb-3">
                <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div class="detail-row"><span class="detail-k">Status</span><span id="detail-status" class="detail-v text-nv-400">Running</span></div>
                    <div class="detail-row"><span class="detail-k">Rating</span><span id="detail-rating" class="detail-v">--</span></div>
                    <div class="detail-row col-span-2"><span class="detail-k">Role</span><span id="detail-role" class="detail-v">--</span></div>
                </div>
            </div>
            
            <div id="detail-dynamic" class="space-y-3">
                <!-- Injected by JS -->
            </div>
        </div>

        <!-- Bottom Toolbar -->
        <div class="hud-bottom glass-panel">
            <button onclick="APP.setCamera('overview')" class="btn-tool active" id="cam_overview"><i class="ph ph-cube"></i> 全景俯瞰</button>
            <button onclick="APP.setCamera('chiller')" class="btn-tool" id="cam_chiller"><i class="ph ph-thermometer-cold"></i> 冰水主機</button>
            <button onclick="APP.setCamera('pump')" class="btn-tool" id="cam_pump"><i class="ph ph-engine"></i> 水泵陣列</button>
            <button onclick="APP.setCamera('tower')" class="btn-tool" id="cam_tower"><i class="ph ph-fan"></i> 冷卻水塔</button>
        </div>
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
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 2, -5);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactables = [];
        this.pipeGroup = new THREE.Group();
        this.scene.add(this.pipeGroup);

        this.initLights();
        this.initMaterials();
        this.buildPlant();

        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
        
        setInterval(() => {
            document.querySelectorAll('.live-val').forEach(el => {
                let base = parseFloat(el.getAttribute('data-base'));
                let variance = parseFloat(el.getAttribute('data-var'));
                let val = base + (Math.random() * variance * 2 - variance);
                el.innerText = val.toFixed(1);
            });
        }, 1500);
        
        this.animate();
        window.APP = this;
    }

    initLights() {
        this.scene.add(new THREE.AmbientLight(0x4a5568, 1.5));

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.set(2048, 2048);
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.5);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);
        
        const spot1 = new THREE.SpotLight(0xffffff, 1.5, 20, 0.6, 0.5, 1.2);
        spot1.position.set(-1.5, 8, 4);
        spot1.target.position.set(-1.5, 1, 0);
        this.scene.add(spot1); this.scene.add(spot1.target);

        const spot2 = new THREE.SpotLight(0xffffff, 1.5, 20, 0.6, 0.5, 1.2);
        spot2.position.set(4.0, 8, 4);
        spot2.target.position.set(4.0, 1, 0);
        this.scene.add(spot2); this.scene.add(spot2.target);
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
            flangeMat: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.5 })
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
            this.pipeGroup.add(pipe);

            const flangeGeom = new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, 0.04, 16);
            const flange1 = new THREE.Mesh(flangeGeom, this.mats.flangeMat);
            flange1.position.copy(start); flange1.lookAt(end); flange1.rotateX(Math.PI/2);
            this.pipeGroup.add(flange1);

            const flange2 = new THREE.Mesh(flangeGeom, this.mats.flangeMat);
            flange2.position.copy(end); flange2.lookAt(start); flange2.rotateX(Math.PI/2);
            this.pipeGroup.add(flange2);

            if (i > 0) {
                const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.2, 16, 16), mat);
                elbow.position.copy(start);
                this.pipeGroup.add(elbow);
            }
        }
    }

    createChiller(x, z, label, isMirrored = false) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        const sign = isMirrored ? 1 : -1;

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

        const cond = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32), this.mats.chillerDark);
        cond.rotation.z = Math.PI / 2;
        cond.position.set(0, 1.16, -0.30);
        group.add(cond);
        
        const condCapL = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.18, 32), this.mats.chillerDark);
        condCapL.rotation.z = Math.PI/2; condCapL.position.set(-1.35, 1.16, -0.30); group.add(condCapL);
        const condCapR = condCapL.clone(); condCapR.position.set(1.35, 1.16, -0.30); group.add(condCapR);

        const comp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.20, 24), this.mats.chillerMotor);
        comp1.rotation.z = Math.PI/2; comp1.position.set(0, 0.88, 0); group.add(comp1);
        const comp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.20, 24), this.mats.chillerMotor);
        comp2.rotation.z = Math.PI/2; comp2.position.set(0, 1.05, 0); group.add(comp2);
        
        const suction = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.15, 24), this.mats.chillerMotor);
        suction.rotation.x = -Math.PI/2; suction.position.set(0, 0.88, 0.175); group.add(suction);

        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.58, 24), this.mats.chillerMotor);
        motor.rotation.z = Math.PI/2; motor.position.set(0, 1.16, 0); group.add(motor);
        for(let i=0; i<10; i++) {
            const fin = new THREE.Mesh(new THREE.TorusGeometry(0.156, 0.008, 8, 24), this.mats.chillerDark);
            fin.rotation.y = Math.PI/2; fin.position.set(-0.25 + i*0.05, 1.16, 0); group.add(fin);
        }

        const oilSep = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), this.mats.darkMetal);
        oilSep.position.set(0, 1.35, 0.05); group.add(oilSep);

        const cp = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.50, 0.08), this.mats.darkMetal);
        cp.position.set(sign*0.5, 0.70, 0.75); 
        group.add(cp);
        
        [0.45, 0.15].forEach(nz => {
            const vNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.30, 16), this.mats.chillerBody);
            vNoz.position.set(sign*1.16, 1.21, nz); group.add(vNoz);
            const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), this.mats.chillerBody);
            elbow.position.set(sign*1.16, 1.35, nz); group.add(elbow);
            const hNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.20, 16), this.mats.chillerBody);
            hNoz.rotation.z = Math.PI/2; hNoz.position.set(sign*1.26, 1.35, nz); group.add(hNoz);
        });

        [-0.15, -0.45].forEach(nz => {
            const vNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.40, 16), this.mats.chillerDark);
            vNoz.position.set(sign*0.9, 1.55, nz); group.add(vNoz);
        });

        group.add(this.createLabel(label, 2.5));
        
        group.userData = { type: 'Chiller', tag: label, desc: 'Centrifugal Chiller 800 RT', rating: '800 RT' };
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 1, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
    }

    createPump(x, z, label, type) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const baseMat = new THREE.MeshStandardMaterial({color:0x8b949e, metalness:0.08, roughness:0.92});
        const voluteMat = new THREE.MeshStandardMaterial({color:0x374151, metalness:0.78, roughness:0.38});
        const motorMat = type === 'CHWP' ? this.mats.chillerMotor : new THREE.MeshStandardMaterial({color:0x14532d,metalness:0.6,roughness:0.35});

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.55), baseMat);
        base.position.set(0, 0.06, 0); group.add(base);

        const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.205, 0.27, 28), voluteMat);
        volute.rotation.x = Math.PI/2; volute.position.set(0, 0.38, 0.24); group.add(volute);

        const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.095, 0.225, 24), this.mats.darkMetal);
        bracket.rotation.x = Math.PI/2; bracket.position.set(0, 0.38, 0.012); group.add(bracket);

        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 16, 1, true, 0, Math.PI*1.5), this.mats.darkMetal);
        guard.rotation.x = Math.PI/2; guard.position.set(0, 0.38, -0.175); group.add(guard);

        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.150, 0.150, 0.52, 24), motorMat);
        motor.rotation.x = Math.PI/2; motor.position.set(0, 0.38, -0.555); group.add(motor);
        
        for(let i=0; i<10; i++) {
            const fin = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.007, 6, 24), this.mats.darkMetal);
            fin.position.set(0, 0.38, -0.38 - i*0.045); group.add(fin);
        }

        const sFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), this.mats.darkMetal);
        sFlange.rotation.x = Math.PI/2; sFlange.position.set(0, 0.35, 0.65); group.add(sFlange); 

        const dFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), this.mats.darkMetal);
        dFlange.position.set(0, 0.65, 0.30); group.add(dFlange); 

        group.add(this.createLabel(label, 1.5));
        
        group.userData = { type: 'Pump', tag: label, desc: 'Centrifugal Pump', rating: type==='CHWP'?'55 kW':'75 kW' };
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 2), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 0.6, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
    }

    createCoolingTower(x, y, z, label) {
        const group = new THREE.Group();
        group.position.set(x, y, z); 

        const basinMat = new THREE.MeshStandardMaterial({color:0x1c2730, metalness:0.45, roughness:0.70});
        const frameMat = new THREE.MeshStandardMaterial({color:0x374151, metalness:0.70, roughness:0.42});
        const louverMat = new THREE.MeshStandardMaterial({color:0x8ea5b4, metalness:0.28, roughness:0.62});

        const basin = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.45, 3.72), basinMat);
        basin.position.set(0, 0.225, 0); group.add(basin);

        [[-1.82, -1.82], [1.82, -1.82], [-1.82, 1.82], [1.82, 1.82]].forEach(pos => {
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.70, 0.08), frameMat);
            col.position.set(pos[0], 1.575, pos[1]); group.add(col);
        });

        const louverGeo = new THREE.BoxGeometry(3.6, 1.5, 0.05);
        [ [0,1.2,1.82,0], [0,1.2,-1.82,0], [1.82,1.2,0,Math.PI/2], [-1.82,1.2,0,Math.PI/2] ].forEach(pos => {
            const lv = new THREE.Mesh(louverGeo, louverMat);
            lv.rotation.y = pos[3]; lv.position.set(pos[0], pos[1], pos[2]); group.add(lv);
        });

        const deck = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.054, 3.82), frameMat);
        deck.position.set(0, 2.73, 0); group.add(deck);

        const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.44, 1.30, 0.65, 30), this.mats.darkMetal);
        stack.position.set(0, 3.08, 0); group.add(stack);

        [-1.86, 1.86].forEach(nx => {
            const cwrNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), this.mats.darkMetal);
            cwrNoz.rotation.z = Math.PI/2; cwrNoz.position.set(nx, 2.60, 0); group.add(cwrNoz);
            
            const cwsNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), this.mats.darkMetal);
            cwsNoz.rotation.z = Math.PI/2; cwsNoz.position.set(nx, 0.40, 0); group.add(cwsNoz);
        });

        group.add(this.createLabel(label, 4.0));
        
        group.userData = { type: 'Tower', tag: label, desc: 'Cooling Tower', rating: '1200 RT' };
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 2, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
    }

    createPHX(x, z, label) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const frameMat = new THREE.MeshStandardMaterial({color:0x1e3a8a, metalness:0.72, roughness:0.32});
        
        const front = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.46, 0.11), frameMat);
        front.position.set(0, 0.78, 0.49); group.add(front);
        
        const rear = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.46, 0.09), frameMat);
        rear.position.set(0, 0.78, -0.49); group.add(rear);

        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.30, 0.82), this.mats.phxPlate);
        pack.position.set(0, 0.78, 0); group.add(pack);

        const flGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
        [-0.45, -0.15, 0.15, 0.45].forEach((offset, idx) => {
            const fl = new THREE.Mesh(flGeo, this.mats.darkMetal);
            fl.position.set(0, 1.52, offset);
            group.add(fl);
        });

        group.add(this.createLabel(label, 2.2));
        
        group.userData = { type: 'PHX', tag: label, desc: 'Plate Heat Exchanger', rating: 'Free Cooling HX' };
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1.5), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 1, 0); hitBox.userData = group.userData;
        group.add(hitBox);
        this.interactables.push(hitBox);

        this.scene.add(group);
    }

    buildPlant() {
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), this.mats.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        const grid = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
        grid.position.y = 0.01;
        this.scene.add(grid);

        // Chillers
        this.createChiller(-1.5, 1.0, 'CH-01 (800 RT)', false);
        this.createChiller(4.0, 1.0, 'CH-02 (800 RT)', true);

        // PHX
        this.createPHX(-9.0, -15.0, 'PHX-01');

        // Roof and CT
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

        // Expansion Tank Injection
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
        const hitBoxTk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3), new THREE.MeshBasicMaterial({visible:false}));
        hitBoxTk.position.set(0, 1.5, 0); hitBoxTk.userData = tankGroup.userData;
        tankGroup.add(hitBoxTk);
        this.interactables.push(hitBoxTk);
        
        tankGroup.add(this.createLabel('EXP-01', 2.8));
        this.scene.add(tankGroup);

        this.drawAllPipes();
    }

    drawAllPipes() {
        const matCHWS = this.mats.pipeCHWS;
        const matCHWR = this.mats.pipeCHWR;
        const matCWS = this.mats.pipeCWS;
        const matCWR = this.mats.pipeCWR;

        // Using precise coordinates to match nozzles:
        // CH-01 Evap Nozzles: x=-2.76. Cond Nozzles: x=-2.4, y=1.75
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.45], [-3.5, 1.35, 1.45], [-2.76, 1.35, 1.45]], matCHWS); 
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.15], [-3.5, 1.35, 1.15], [-2.76, 1.35, 1.15]], matCHWR); 
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.85], [-2.4, 1.75, 0.85]], matCWS); 
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.55], [-2.4, 1.75, 0.55]], matCWR); 

        // CH-02 Evap Nozzles: x=5.26. Cond Nozzles: x=4.9, y=1.75
        this.drawOrthogonalPipe([[6.0, 3.8, 1.45], [6.0, 1.35, 1.45], [5.26, 1.35, 1.45]], matCHWS); 
        this.drawOrthogonalPipe([[6.0, 3.8, 1.15], [6.0, 1.35, 1.15], [5.26, 1.35, 1.15]], matCHWR); 
        this.drawOrthogonalPipe([[4.9, 4.4, 0.85], [4.9, 1.75, 0.85]], matCWS); 
        this.drawOrthogonalPipe([[4.9, 4.4, 0.55], [4.9, 1.75, 0.55]], matCWR); 

        // Headers
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.45], [-3.5, 3.8, -11.0], [6.0, 3.8, -11.0], [6.0, 3.8, 1.45]], matCHWS);
        this.drawOrthogonalPipe([[-3.5, 3.8, 1.15], [-3.5, 3.8, -11.5], [6.0, 3.8, -11.5], [6.0, 3.8, 1.15]], matCHWR);
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.55], [-2.4, 4.4, -13.0], [4.9, 4.4, -13.0], [4.9, 4.4, 0.55]], matCWR);
        this.drawOrthogonalPipe([[-2.4, 4.4, 0.85], [-2.4, 4.4, -12.5], [4.9, 4.4, -12.5], [4.9, 4.4, 0.85]], matCWS);

        // Cooling Towers 
        this.drawOrthogonalPipe([[-0.5, 5.8, -13.0], [-0.5, 5.8, -17.5], [-0.5, 10.6, -17.5], [-1.14, 10.6, -17.5]], matCWR);
        this.drawOrthogonalPipe([[-1.14, 8.4, -17.5], [-0.5, 8.4, -17.5], [-0.5, 5.0, -17.5], [-0.5, 5.0, -13.0]], matCWS);
        this.drawOrthogonalPipe([[5.5, 5.8, -13.0], [5.5, 5.8, -17.5], [5.5, 10.6, -17.5], [4.86, 10.6, -17.5]], matCWR);
        this.drawOrthogonalPipe([[4.86, 8.4, -17.5], [5.5, 8.4, -17.5], [5.5, 5.0, -17.5], [5.5, 5.0, -13.0]], matCWS);

        this.drawOrthogonalPipe([[-0.5, 5.8, -13.0], [5.5, 5.8, -13.0]], matCWR); 
        this.drawOrthogonalPipe([[-0.5, 5.0, -13.0], [5.5, 5.0, -13.0]], matCWS); 

        // Pumps
        [-6.5, -5.0, -3.5].forEach(px => {
            this.drawOrthogonalPipe([[px, 0.35, -11.5], [px, 0.35, -6.35]], matCHWR); 
            this.drawOrthogonalPipe([[px, 0.65, -7.0], [px, 4.4, -7.0], [px, 4.4, -11.0]], matCHWS); 
        });
        [1.5, 3.0, 4.5].forEach(px => {
            this.drawOrthogonalPipe([[px, 5.0, -13.0], [px, 0.35, -13.0], [px, 0.35, -6.35]], matCWS);
            this.drawOrthogonalPipe([[px, 0.65, -7.0], [px, 3.2, -7.0], [px, 3.2, -13.0]], matCWR); 
        });
        
        this.drawOrthogonalPipe([[-6.5, 4.4, -11.0], [-3.5, 4.4, -11.0]], matCHWS);
        this.drawOrthogonalPipe([[1.5, 3.2, -13.0], [4.9, 3.2, -13.0], [4.9, 4.4, -13.0]], matCWR);

        // PHX
        this.drawOrthogonalPipe([[-9.0, 3.8, -11.0], [-9.0, 3.8, -14.85], [-9.0, 1.52, -14.85]], matCHWS);
        this.drawOrthogonalPipe([[-9.0, 1.52, -14.55], [-9.0, 1.5, -14.55], [-8.0, 1.5, -14.55], [-8.0, 3.8, -14.55], [-8.0, 3.8, -11.5]], matCHWR);
        this.drawOrthogonalPipe([[-9.0, 1.52, -15.15], [-9.0, 5.0, -15.15], [-9.0, 5.0, -13.0]], matCWS);
        this.drawOrthogonalPipe([[-9.0, 5.8, -13.0], [-9.0, 5.8, -15.45], [-9.0, 1.52, -15.45]], matCWR);
    }

    setCamera(view) {
        document.querySelectorAll('.btn-tool').forEach(btn => btn.classList.remove('active'));
        if(document.getElementById('cam_' + view)) document.getElementById('cam_' + view).classList.add('active');
        
        if(view === 'overview') {
            this.camera.position.set(0, 15, 25);
            this.controls.target.set(0, 2, -5);
        } else if(view === 'chiller') {
            this.camera.position.set(-2, 5, 8);
            this.controls.target.set(-1, 1, 0);
        } else if(view === 'pump') {
            this.camera.position.set(-8, 4, 0);
            this.controls.target.set(-5, 0.5, -7);
        } else if(view === 'tower') {
            this.camera.position.set(0, 15, -8);
            this.controls.target.set(0, 8, -17.5);
        }
    }

    onClick(event) {
        if(!this.interactables || this.interactables.length === 0) return;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactables);
        
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            this.showDetail(obj.userData);
        }
    }

    showDetail(data) {
        document.getElementById('hud-detail').classList.add('active');
        document.getElementById('detail-title').innerText = data.desc;
        document.getElementById('detail-subtitle').innerText = data.tag;
        document.getElementById('detail-rating').innerText = data.rating;
        document.getElementById('detail-role').innerText = data.type;
        
        const dyn = document.getElementById('detail-dynamic');
        dyn.innerHTML = ''; 
        
        if (data.type === 'Chiller') {
            dyn.innerHTML = \`
                <div class="metric-box bg-slate-900/50">
                    <div class="text-[10px] text-slate-400 uppercase mb-2 flex justify-between">
                        <span>壓縮機狀態</span><span class="text-nv-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-nv-500 animate-pulse"></span> 運轉中</span>
                    </div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs text-slate-300">馬達負載</span>
                        <div class="font-mono text-yellow-400"><span class="live-val" data-base="85.4" data-var="1.5">85.4</span> %</div>
                    </div>
                    <div class="w-full bg-slate-800 rounded-full h-1.5 mb-3"><div class="bg-yellow-500 h-full rounded-full" style="width: 85%"></div></div>
                </div>\`;
        } else if (data.type === 'Pump') {
            dyn.innerHTML = \`
                <div class="metric-box bg-slate-900/50">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs text-slate-300">變頻頻率 (VFD)</span>
                        <div class="font-mono text-blue-400"><span class="live-val" data-base="48.5" data-var="0.5">48.5</span> Hz</div>
                    </div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs text-slate-300">瞬間流量</span>
                        <div class="font-mono text-white"><span class="live-val" data-base="245" data-var="2">245</span> m³/h</div>
                    </div>
                </div>\`;
        }
    }

    closeDetail() {
        document.getElementById('hud-detail').classList.remove('active');
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

fs.writeFileSync('public/code_artifact.html', FULL_HTML, 'utf8');
console.log('Successfully generated the perfect code_artifact.html!');
