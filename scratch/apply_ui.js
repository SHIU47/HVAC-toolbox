const fs = require('fs');

let html = fs.readFileSync('public/code_artifact.html', 'utf8');

const getBlock = (startStr, endStr) => {
    const start = html.indexOf(startStr);
    const end = html.indexOf(endStr, start);
    if(start === -1 || end === -1) throw new Error('Cannot find ' + startStr);
    return html.substring(start, end);
};

// 1. Replace <head> ... </head> and the basic <div id="ui-layer">...</div> with the full Grey Space UI
const oldHeadAndUI = getBlock('<head>', '<div id="canvas-container"></div>');

const newHeadAndUI = `<head>
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
    
    <div id="canvas-container"></div>`;

html = html.replace(oldHeadAndUI, newHeadAndUI);

// 2. Add raycaster and listeners to constructor
const oldConstEnd = getBlock('        window.addEventListener(\'resize\', () => this.onWindowResize());', '    }');
const newConstEnd = `        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
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
`;
html = html.replace(oldConstEnd, newConstEnd);

// 3. Update ToneMapping in constructor
const oldRenderer = getBlock('        this.renderer.shadowMap.enabled = true;', '        this.container.appendChild(this.renderer.domElement);');
const newRenderer = `        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);`;
html = html.replace(oldRenderer, newRenderer);

// 4. Update initLights
const oldInitLights = getBlock('    initLights() {', '    initMaterials() {');
const newInitLights = `    initLights() {
        this.scene.add(new THREE.AmbientLight(0x4a5568, 1.5));

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.set(2048, 2048);
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.5);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);
        
        // Spotlights on Chillers
        const spot1 = new THREE.SpotLight(0xffffff, 1.5, 20, 0.6, 0.5, 1.2);
        spot1.position.set(-1.5, 8, 4);
        spot1.target.position.set(-1.5, 1, 0);
        this.scene.add(spot1); this.scene.add(spot1.target);

        const spot2 = new THREE.SpotLight(0xffffff, 1.5, 20, 0.6, 0.5, 1.2);
        spot2.position.set(4.0, 8, 4);
        spot2.target.position.set(4.0, 1, 0);
        this.scene.add(spot2); this.scene.add(spot2.target);
    }

`;
html = html.replace(oldInitLights, newInitLights);

// 5. Inject HUD interaction logic before animate()
const interactionLogic = `    setCamera(view) {
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

    animate() {`;

html = html.replace('    animate() {', interactionLogic);

fs.writeFileSync('public/code_artifact.html', html, 'utf8');
console.log('Successfully injected UI!');
