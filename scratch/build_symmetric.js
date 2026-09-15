const fs = require('fs');

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>冰機房數位孿生 | Data Center Edition</title>
    
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
                        nv: { 500:'#76b900', 400:'#8add12' }
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
        .btn-tool.active { background: rgba(118, 185, 0, 0.2); color: #8add12; border-color: #76b900; }

        .metric-box { background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(51, 65, 85, 0.4); border-radius: 12px; padding: 12px; }
        .data-value { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 1.25rem; }
        .detail-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid rgba(51,65,85,0.45); }
        .detail-row:last-child { border-bottom: 0; }
        .detail-k { color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
        .detail-v { color: #e2e8f0; font-size: 12px; font-family: 'JetBrains Mono', monospace; text-align: right; overflow-wrap: anywhere; }

        .tooltip {
            position: absolute; background: rgba(0,0,0,0.85); color: #fff; padding: 6px 10px; border-radius: 6px;
            font-size: 12px; font-family: monospace; border: 1px solid #76b900; pointer-events: none; opacity: 0;
            transition: opacity 0.2s; z-index: 20; transform: translate(-50%, -150%); white-space: nowrap; font-weight: bold;
        }
        
        #sim-modal-overlay {
            position: fixed; inset: 0; z-index: 100;
            background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        #sim-modal-overlay.active {
            opacity: 1; pointer-events: auto;
        }
        .sim-modal {
            background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(51, 65, 85, 0.6);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(118, 185, 0, 0.1);
            width: 95%; max-width: 800px; border-radius: 24px; padding: 24px;
            transform: translateY(20px) scale(0.95); transition: all 0.4s;
        }
        #sim-modal-overlay.active .sim-modal { transform: translateY(0) scale(1); }
    </style>
</head>
<body class="antialiased">
    
    <div id="canvas-container"></div>
    <div id="hover-tooltip" class="tooltip">Equipment</div>

    <div id="ui-layer">
        <header class="glass-panel w-full p-4 flex justify-between items-center border-b-0 rounded-b-xl max-w-[1800px] mx-auto mt-2">
            <div class="flex items-center gap-3 md:gap-4">
                <div class="bg-nv-500 p-2 rounded-lg shadow-[0_0_15px_rgba(118,185,0,0.4)]"><i class="ph-fill ph-snowflake text-black text-xl md:text-2xl"></i></div>
                <div>
                    <h1 class="text-sm md:text-lg font-black text-white flex items-center gap-2">
                        冰機房數位孿生 <span class="text-nv-400 font-normal">|</span> Data Center Edition
                    </h1>
                    <div class="text-[9px] md:text-[10px] text-slate-400 tracking-widest font-bold uppercase mt-0.5">Symmetric Chiller Plant Architecture</div>
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
                    <div class="text-right"><span class="data-value text-white live-val" data-base="1650" data-var="25">1650</span><span class="text-[10px] text-nv-400 ml-1">RT</span></div>
                </div>
                <div class="metric-box flex justify-between items-end border-l-2 border-blue-500">
                    <span class="text-xs text-slate-400 font-bold">冰水出水溫 (CHWS)</span>
                    <div class="text-right"><span class="data-value text-blue-400 live-val" data-base="7.0" data-var="0.2">7.0</span><span class="text-[10px] text-blue-400 ml-1">°C</span></div>
                </div>
                <div class="metric-box flex justify-between items-end border-l-2 border-cyan-500">
                    <span class="text-xs text-slate-400 font-bold">冰水回水溫 (CHWR)</span>
                    <div class="text-right"><span class="data-value text-cyan-400 live-val" data-base="12.0" data-var="0.3">12.0</span><span class="text-[10px] text-cyan-400 ml-1">°C</span></div>
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
                <p>💡 提示：點擊 3D 場景中的設備以檢視詳細數據。</p>
            </div>
        </div>

        <!-- Right HUD (Detail) -->
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
            <div id="detail-dynamic" class="space-y-3"></div>
        </div>

        <!-- Sim Modal (Data Center Style) -->
        <div id="sim-modal-overlay">
            <div class="sim-modal">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700/60 pb-4">
                    <h2 class="text-lg font-black text-white flex items-center gap-3">
                        <i class="ph-fill ph-calculator text-nv-400 text-2xl"></i> 熱力學初步設計 (Plant Sizing)
                    </h2>
                    <button onclick="APP.toggleSimPanel()" class="text-slate-400 hover:text-white p-2"><i class="ph ph-x text-xl"></i></button>
                </div>
                <div class="text-slate-300 text-sm mb-4">這是一個專門為對稱式冰機房設計的 Sizing Tool。</div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="metric-box border-l-2 border-blue-500">
                        <span class="text-xs text-slate-400 block mb-1">預估總冷凍噸位</span>
                        <div class="font-mono text-2xl text-white">1600 <span class="text-sm text-nv-400">RT</span></div>
                    </div>
                    <div class="metric-box border-l-2 border-nv-500">
                        <span class="text-xs text-slate-400 block mb-1">估算系統 PUE</span>
                        <div class="font-mono text-2xl text-nv-400">1.25</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Toolbar -->
        <div class="hud-bottom glass-panel">
            <button onclick="APP.setCamera('overview')" class="btn-tool active" id="cam_overview"><i class="ph ph-cube"></i> 全景俯瞰</button>
            <div class="w-px h-6 bg-slate-700 mx-1 self-center"></div>
            <button onclick="APP.setCamera('chiller')" class="btn-tool" id="cam_chiller"><i class="ph ph-thermometer-cold"></i> 對稱冰機</button>
            <button onclick="APP.setCamera('pump')" class="btn-tool" id="cam_pump"><i class="ph ph-engine"></i> 水泵陣列</button>
            <button onclick="APP.setCamera('tower')" class="btn-tool" id="cam_tower"><i class="ph ph-fan"></i> 頂樓冷卻塔</button>
            <div class="w-px h-6 bg-slate-700 mx-1 self-center"></div>
            <button onclick="APP.toggleSimPanel()" class="btn-tool" id="btn_sim"><i class="ph ph-calculator"></i> 模擬計算</button>
        </div>
    </div>

<script>
class ChillerPlantSymmetric {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x080c14);
        this.scene.fog = new THREE.FogExp2(0x080c14, 0.015);

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 20, 30);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, -2);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactables = [];
        this.pipeGroup = new THREE.Group();
        this.scene.add(this.pipeGroup);

        this.initLights();
        this.initMaterials();
        this.buildPlant();

        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
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
        this.scene.add(new THREE.AmbientLight(0x1e293b, 2.0));
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(10, 25, 15);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.set(2048, 2048);
        this.scene.add(mainLight);

        // Highlight symmetric chillers
        const spot1 = new THREE.SpotLight(0x7dd3fc, 2.0, 30, 0.5, 0.5, 1.2);
        spot1.position.set(-3.5, 10, 5); spot1.target.position.set(-3.5, 0, 0);
        this.scene.add(spot1); this.scene.add(spot1.target);

        const spot2 = new THREE.SpotLight(0x7dd3fc, 2.0, 30, 0.5, 0.5, 1.2);
        spot2.position.set(3.5, 10, 5); spot2.target.position.set(3.5, 0, 0);
        this.scene.add(spot2); this.scene.add(spot2.target);
    }

    initMaterials() {
        this.mats = {
            floor: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9, metalness: 0.1 }),
            chillerBody: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.6 }),
            chillerDark: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.8 }),
            chillerMotor: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4, metalness: 0.2 }),
            pipeCHWS: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.2 }),
            pipeCHWR: new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.3, metalness: 0.2 }),
            pipeCWS: new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.3, metalness: 0.2 }),
            pipeCWR: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3, metalness: 0.2 }),
            darkMetal: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.9 }),
            phxPlate: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.6 })
        };
    }

    createLabel(text, yOffset = 2.5) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.roundRect(0, 0, 512, 128, 30); ctx.fill();
        ctx.strokeStyle = '#76b900'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 118);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);
        
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.scale.set(2, 0.5, 1); sprite.position.y = yOffset;
        return sprite;
    }

    drawOrthogonalPipe(pathPoints, mat, radius = 0.12) {
        for(let i = 0; i < pathPoints.length - 1; i++) {
            const start = new THREE.Vector3(...pathPoints[i]);
            const end = new THREE.Vector3(...pathPoints[i+1]);
            const len = start.distanceTo(end);
            if(len < 0.01) continue;

            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 16), mat);
            pipe.position.copy(start).add(end).multiplyScalar(0.5);
            pipe.lookAt(end); pipe.rotateX(Math.PI/2); pipe.castShadow = true;
            this.pipeGroup.add(pipe);

            const fl = new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, 0.04, 16);
            const f1 = new THREE.Mesh(fl, this.mats.darkMetal); f1.position.copy(start); f1.lookAt(end); f1.rotateX(Math.PI/2);
            const f2 = new THREE.Mesh(fl, this.mats.darkMetal); f2.position.copy(end); f2.lookAt(start); f2.rotateX(Math.PI/2);
            this.pipeGroup.add(f1); this.pipeGroup.add(f2);

            if (i > 0) {
                const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.2, 16, 16), mat);
                elbow.position.copy(start); this.pipeGroup.add(elbow);
            }
        }
    }

    createChiller(x, z, label, isMirrored = false) {
        const group = new THREE.Group(); group.position.set(x, 0, z);
        const sign = isMirrored ? 1 : -1;

        const evap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.52, 32), this.mats.chillerBody);
        evap.rotation.z = Math.PI / 2; evap.position.set(0, 0.62, 0.30); group.add(evap);
        
        [-1.0, -0.3, 0.3, 1.0].forEach(sx => {
            const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16, 1, false, 0, Math.PI), this.mats.darkMetal);
            saddle.rotation.x = Math.PI; saddle.rotation.z = Math.PI/2; saddle.position.set(sx, 0.62, 0.30); group.add(saddle);
        });

        const cond = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32), this.mats.chillerDark);
        cond.rotation.z = Math.PI / 2; cond.position.set(0, 1.16, -0.30); group.add(cond);

        const comp = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.20, 24), this.mats.chillerMotor);
        comp.rotation.z = Math.PI/2; comp.position.set(0, 0.88, 0); group.add(comp);
        
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.58, 24), this.mats.chillerMotor);
        motor.rotation.z = Math.PI/2; motor.position.set(0, 1.16, 0); group.add(motor);
        for(let i=0; i<10; i++) {
            const fin = new THREE.Mesh(new THREE.TorusGeometry(0.156, 0.008, 8, 24), this.mats.darkMetal);
            fin.rotation.y = Math.PI/2; fin.position.set(-0.25 + i*0.05, 1.16, 0); group.add(fin);
        }

        [0.45, 0.15].forEach(nz => {
            const vNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.30, 16), this.mats.chillerBody);
            vNoz.position.set(sign*1.16, 1.21, nz); group.add(vNoz);
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
        group.add(hitBox); this.interactables.push(hitBox);

        this.scene.add(group);
    }

    createPump(x, z, label, type) {
        const group = new THREE.Group(); group.position.set(x, 0, z);
        const motorMat = type === 'CHWP' ? this.mats.chillerMotor : new THREE.MeshStandardMaterial({color:0x14532d,metalness:0.6,roughness:0.35});

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.55), this.mats.darkMetal);
        base.position.set(0, 0.06, 0); group.add(base);

        const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.205, 0.27, 28), this.mats.chillerBody);
        volute.rotation.x = Math.PI/2; volute.position.set(0, 0.38, 0.24); group.add(volute);

        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.150, 0.150, 0.52, 24), motorMat);
        motor.rotation.x = Math.PI/2; motor.position.set(0, 0.38, -0.555); group.add(motor);

        group.add(this.createLabel(label, 1.5));
        
        group.userData = { type: 'Pump', tag: label, desc: 'Centrifugal Pump', rating: type==='CHWP'?'55 kW':'75 kW' };
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 2), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 0.6, 0); hitBox.userData = group.userData;
        group.add(hitBox); this.interactables.push(hitBox);

        this.scene.add(group);
    }

    createCoolingTower(x, y, z, label, isMirrored=false) {
        const group = new THREE.Group(); group.position.set(x, y, z); 

        const basin = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.45, 3.72), this.mats.darkMetal);
        basin.position.set(0, 0.225, 0); group.add(basin);

        const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.5, 3.6), this.mats.chillerDark);
        body.position.set(0, 1.2, 0); group.add(body);

        const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.44, 1.30, 0.65, 30), this.mats.darkMetal);
        stack.position.set(0, 2.3, 0); group.add(stack);

        const nx = isMirrored ? -1.86 : 1.86;
        const cwrNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), this.mats.darkMetal);
        cwrNoz.rotation.z = Math.PI/2; cwrNoz.position.set(nx, 2.60, 0); group.add(cwrNoz);
        const cwsNoz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16), this.mats.darkMetal);
        cwsNoz.rotation.z = Math.PI/2; cwsNoz.position.set(nx, 0.40, 0); group.add(cwsNoz);

        group.add(this.createLabel(label, 4.0));
        
        group.userData = { type: 'Tower', tag: label, desc: 'Cooling Tower', rating: '1200 RT' };
        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial({visible:false}));
        hitBox.position.set(0, 2, 0); hitBox.userData = group.userData;
        group.add(hitBox); this.interactables.push(hitBox);

        this.scene.add(group);
    }

    buildPlant() {
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), this.mats.floor);
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
        const grid = new THREE.GridHelper(40, 40, 0x1e293b, 0x0f172a); grid.position.y = 0.01; this.scene.add(grid);

        // Symmetric Chillers
        this.createChiller(-3.5, 0, 'CH-01 (800 RT)', false);
        this.createChiller(3.5, 0, 'CH-02 (800 RT)', true);

        // Symmetric Pumps
        this.createPump(-5.5, -7.0, 'CHWP-1', 'CHWP');
        this.createPump(-4.0, -7.0, 'CHWP-2', 'CHWP');
        this.createPump(-2.5, -7.0, 'CHWP-3', 'CHWP');
        this.createPump(2.5, -7.0, 'CWP-1', 'CWP');
        this.createPump(4.0, -7.0, 'CWP-2', 'CWP');
        this.createPump(5.5, -7.0, 'CWP-3', 'CWP');

        // Roof & Cooling Towers
        const roof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 10), this.mats.darkMetal);
        roof.position.set(0, 7.75, -15.0); this.scene.add(roof);
        this.createCoolingTower(-3.5, 8.0, -15.0, 'CT-01', false); // Nozzles right (+x)
        this.createCoolingTower(3.5, 8.0, -15.0, 'CT-02', true);  // Nozzles left (-x)

        this.drawAllPipes();
    }

    drawAllPipes() {
        const matCHWS = this.mats.pipeCHWS; const matCHWR = this.mats.pipeCHWR;
        const matCWS = this.mats.pipeCWS; const matCWR = this.mats.pipeCWR;

        // CH-01 (x=-3.5). Nozzles: Evap (-4.76, 1.35), Cond (-4.4, 1.75)
        this.drawOrthogonalPipe([[-4.76, 1.35, 1.45], [-4.76, 3.8, 1.45], [-5.5, 3.8, 1.45]], matCHWS); 
        this.drawOrthogonalPipe([[-4.76, 1.35, 1.15], [-4.76, 3.8, 1.15], [-5.5, 3.8, 1.15]], matCHWR); 
        this.drawOrthogonalPipe([[-4.4, 1.75, 0.85], [-4.4, 4.4, 0.85]], matCWS); 
        this.drawOrthogonalPipe([[-4.4, 1.75, 0.55], [-4.4, 4.4, 0.55]], matCWR); 

        // CH-02 (x=3.5). Nozzles: Evap (4.76, 1.35), Cond (4.4, 1.75)
        this.drawOrthogonalPipe([[4.76, 1.35, 1.45], [4.76, 3.8, 1.45], [5.5, 3.8, 1.45]], matCHWS); 
        this.drawOrthogonalPipe([[4.76, 1.35, 1.15], [4.76, 3.8, 1.15], [5.5, 3.8, 1.15]], matCHWR); 
        this.drawOrthogonalPipe([[4.4, 1.75, 0.85], [4.4, 4.4, 0.85]], matCWS); 
        this.drawOrthogonalPipe([[4.4, 1.75, 0.55], [4.4, 4.4, 0.55]], matCWR); 

        // Headers
        this.drawOrthogonalPipe([[-5.5, 3.8, 1.45], [-5.5, 3.8, -11.0], [5.5, 3.8, -11.0], [5.5, 3.8, 1.45]], matCHWS);
        this.drawOrthogonalPipe([[-5.5, 3.8, 1.15], [-5.5, 3.8, -11.5], [5.5, 3.8, -11.5], [5.5, 3.8, 1.15]], matCHWR);
        this.drawOrthogonalPipe([[-4.4, 4.4, 0.55], [-4.4, 4.4, -13.0], [4.4, 4.4, -13.0], [4.4, 4.4, 0.55]], matCWR);
        this.drawOrthogonalPipe([[-4.4, 4.4, 0.85], [-4.4, 4.4, -12.5], [4.4, 4.4, -12.5], [4.4, 4.4, 0.85]], matCWS);

        // Cooling Towers (Valves at CT-01: x=-1.65. CT-02: x=1.65)
        this.drawOrthogonalPipe([[-1.65, 10.6, -15.0], [-1.65, 10.6, -17.5], [-1.65, 5.8, -17.5], [-1.65, 5.8, -13.0]], matCWR);
        this.drawOrthogonalPipe([[-1.65, 8.4, -15.0], [-1.65, 8.4, -17.5], [-1.65, 5.0, -17.5], [-1.65, 5.0, -13.0]], matCWS);
        this.drawOrthogonalPipe([[1.65, 10.6, -15.0], [1.65, 10.6, -17.5], [1.65, 5.8, -17.5], [1.65, 5.8, -13.0]], matCWR);
        this.drawOrthogonalPipe([[1.65, 8.4, -15.0], [1.65, 8.4, -17.5], [1.65, 5.0, -17.5], [1.65, 5.0, -13.0]], matCWS);

        this.drawOrthogonalPipe([[-1.65, 5.8, -13.0], [1.65, 5.8, -13.0]], matCWR); // CWR Header Top
        this.drawOrthogonalPipe([[0, 5.8, -13.0], [0, 4.4, -13.0]], matCWR); // CWR Drop
        this.drawOrthogonalPipe([[-1.65, 5.0, -13.0], [5.5, 5.0, -13.0]], matCWS); // CWS Header Top to Pumps

        // Pumps
        [-5.5, -4.0, -2.5].forEach(px => {
            this.drawOrthogonalPipe([[px, 0.35, -11.5], [px, 0.35, -6.35]], matCHWR); 
            this.drawOrthogonalPipe([[px, 0.65, -7.0], [px, 4.4, -7.0], [px, 4.4, -11.5]], matCHWS); // Manifold connection
        });
        this.drawOrthogonalPipe([[-5.5, 4.4, -11.5], [-2.5, 4.4, -11.5]], matCHWS); // Pump Discharge Manifold
        this.drawOrthogonalPipe([[-5.5, 4.4, -11.5], [-5.5, 3.8, -11.0]], matCHWS); // To header

        [2.5, 4.0, 5.5].forEach(px => {
            this.drawOrthogonalPipe([[px, 5.0, -13.0], [px, 0.35, -13.0], [px, 0.35, -6.35]], matCWS);
            this.drawOrthogonalPipe([[px, 0.65, -7.0], [px, 3.2, -7.0], [px, 3.2, -12.5]], matCWR); 
        });
        this.drawOrthogonalPipe([[2.5, 3.2, -12.5], [5.5, 3.2, -12.5]], matCWR); // Pump Discharge Manifold
        this.drawOrthogonalPipe([[4.4, 3.2, -12.5], [4.4, 4.4, -12.5]], matCWR); // To header
    }

    setCamera(view) {
        document.querySelectorAll('.btn-tool').forEach(btn => btn.classList.remove('active'));
        if(document.getElementById('cam_' + view)) document.getElementById('cam_' + view).classList.add('active');
        
        if(view === 'overview') { this.camera.position.set(0, 20, 30); this.controls.target.set(0, 0, -2); }
        else if(view === 'chiller') { this.camera.position.set(0, 6, 12); this.controls.target.set(0, 1, 0); }
        else if(view === 'pump') { this.camera.position.set(-10, 5, 0); this.controls.target.set(-4, 0.5, -7); }
        else if(view === 'tower') { this.camera.position.set(0, 15, -5); this.controls.target.set(0, 8, -15); }
    }

    toggleSimPanel() {
        const overlay = document.getElementById('sim-modal-overlay');
        overlay.classList.toggle('active');
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactables);
        
        const tooltip = document.getElementById('hover-tooltip');
        if (intersects.length > 0) {
            const data = intersects[0].object.userData;
            tooltip.innerText = data.tag;
            tooltip.style.left = event.clientX + 'px';
            tooltip.style.top = event.clientY + 'px';
            tooltip.style.opacity = 1;
            document.body.style.cursor = 'pointer';
        } else {
            tooltip.style.opacity = 0;
            document.body.style.cursor = 'default';
        }
    }

    onClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactables);
        if (intersects.length > 0) {
            this.showDetail(intersects[0].object.userData);
        }
    }

    showDetail(data) {
        document.getElementById('hud-detail').classList.add('active');
        document.getElementById('detail-title').innerText = data.desc;
        document.getElementById('detail-subtitle').innerText = data.tag;
        document.getElementById('detail-rating').innerText = data.rating;
        document.getElementById('detail-role').innerText = data.type;
        
        const dyn = document.getElementById('detail-dynamic');
        if (data.type === 'Chiller') {
            dyn.innerHTML = \`<div class="metric-box bg-slate-900/50">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-xs text-slate-300">馬達負載</span>
                    <div class="font-mono text-nv-400">85.4 %</div>
                </div>
            </div>\`;
        } else {
            dyn.innerHTML = '';
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
    new ChillerPlantSymmetric();
};
</script>
</body>
</html>`;

fs.writeFileSync('public/code_artifact.html', HTML_CONTENT, 'utf8');
console.log('Successfully generated Step 1 symmetric layout and Data Center UI skeleton!');
