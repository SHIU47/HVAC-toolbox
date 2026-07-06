setInterval(() => {
            // Update thermodynamic offset based on chiller state
            if (typeof DTC !== 'undefined') {
                if (DTC.chillerDown) {
                    DTC.supplyTempOffset = Math.min(30, DTC.supplyTempOffset + 0.5);
                    if (DTC.materials && DTC.materials.ledGreen) {
                        DTC.materials.ledGreen.color.setHex(0xef4444);
                    }
                } else {
                    DTC.supplyTempOffset = Math.max(0, DTC.supplyTempOffset - 1.0);
                    if (DTC.materials && DTC.materials.ledGreen) {
                        DTC.materials.ledGreen.color.setHex(0x76b900);
                    }
                }
            }

            document.querySelectorAll('.live-val').forEach(el => {
                let base = parseFloat(el.getAttribute('data-base'));
                let variance = parseFloat(el.getAttribute('data-var'));

                // Apply thermal offset if chiller is down
                if (typeof DTC !== 'undefined' && DTC.supplyTempOffset > 0) {
                    if (el.id === 'hud_val_supply' || el.id === 'hud_val_return') {
                        base += DTC.supplyTempOffset;
                    } else if (el.classList.contains('live-val') && el.closest('#detail-content-rack')) {
                        if (base < 100) base += DTC.supplyTempOffset * 1.2;
                    }
                }

                let val = base + (Math.random() * variance * 2 - variance);
                let decimals = base > 1000 ? 0 : (base > 100 ? 1 : 2);
                if (variance === 0.01) decimals = 2; 
                el.innerText = val.toFixed(decimals);
            });
            
            // Send live telemetry to portal parent window
            if (window.parent && window.parent !== window) {
                const getVal = (id) => {
                    const el = document.getElementById(id);
                    return el ? parseFloat(el.innerText) : 0;
                };
                window.parent.postMessage({
                    type: 'telemetry',
                    module: 'whitespace',
                    data: {
                        load: getVal('hud_val_load'),
                        supply: getVal('hud_val_supply'),
                        return: getVal('hud_val_return'),
                        pue: getVal('hud_val_pue'),
                        flow: getVal('hud_val_flow')
                    }
                }, '*');
            }
        }, 1500);



        const DTC = {
            scene: null, camera: null, renderer: null, controls: null,
            clock: new THREE.Clock(), raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
            interactables: [], 
            
            leftHudVisible: window.innerWidth > 768,
            doorsOpen: false, rackFrontDoors: [],
            chillerDown: false,
            supplyTempOffset: 0,
            
            // 爆炸拆解狀態與儲存容器
            isExploded: false,
            explodeProgress: { val: 0 },
            explodeInstancedMeshes: [],
            explodeShells: [],
            fanRotors: [], // Rev F Phase F4：風牆風機轉子（18 組一般 Mesh，animate() 內逐一自旋）

            iData: { 
                trayBase:[], traySide:[], pcb:[],
                coldPlate:[], cpuColdPlate:[], hoseThick:[], qdc:[], nvLink:[],
                dimm:[], vrm:[], psu:[], 
                cableRed:[], cableBlack:[],
                fp:[], lcd:[], ports:[]
            },
            
            materials: {}, textures: {}, pipeUniforms: { time: { value: 0 } }, pipeGroup: null,
            cfdMode: false, cfdParticles: null, leakAlarm: false, cduIndicators: [], coldPlateCfdGroups: [],

            // Vera Rubin NVL72 (Oberon 機櫃) 佈局常數 —— 唯一真值，所有新幾何一律引用，禁止硬編碼魔術數字
            VR_LAYOUT: {
                room:   { ceilingY: 5.40, floorY: 0, ceilW: 16, ceilD: 12, colXs: [-7.5, 7.5], colZ: 5.5 },
                // Rev D：通道加寬 1.2→1.8，兩列機櫃外移到 z=±1.5；GPU 液冷櫃僅中間 6 櫃(索引3~8)
                rack:   { w: 0.6, h: 2.2, d: 1.2, pitch: 0.62, count: 12,
                          rowA_z: -1.5, rowB_z: 1.5, gpuIndices: [3,4,5,6,7,8],
                          xs: [-3.41,-2.79,-2.17,-1.55,-0.93,-0.31,0.31,0.93,1.55,2.17,2.79,3.41] },
                // Rev D：門架/主管只覆蓋 GPU 櫃區段、抬高至艙內上部（3.05/3.20）。
                // Phase D2：垂降改為球閥短垂降 + Hose Kit，connectY 邏輯已隨之移除（不再需要）。
                tcs:    { frameTopY: 3.05, headerY: 3.20,
                          postXs: [-1.86, 0.31, 2.48],                 // 只覆蓋 GPU 櫃區段
                          postZ: 0.70,                                 // 立柱 z=±0.70，隨新艙牆 wallZ=0.90 內縮
                          beamSpanZ: 1.00,
                          headerR: 0.055, branchR: 0.022,
                          headerXHalf: 2.80,                           // 只蓋 GPU 櫃區段
                          supplyZ: { A: -0.55, B: 0.55 },
                          returnZ: { A: -0.28, B: 0.28 },
                          dropXOffset: 0.10,                           // Phase D2 起垂降改讀 manifold.xOffset，此欄位保留未刪（未指示移除）
                          rackFaceZ: 0.90 },                           // 機櫃背面（熱通道側）z 絕對值，隨新艙寬調整
                // Rev D：全高煙囪，無頂板/無 grommet/無百葉，故刪除 roofY/louverBandY 的「艙頂」語意。
                // roofY 曾在 D1~D3 暫留為橋接欄位（供 whip 的 grommet 穿頂點沿用），Phase D4
                // 重寫電力/whip 系統後已無任何引用，一併移除。
                containment: { wallZ: 0.90, halfW: 3.73, topY: 5.40 },
                // Rev D：fiber 環長邊 z=±ringZHalf(機櫃列正上方)、短邊 x=±ringXHalf。橋接欄位 trayZ
                // 已隨 Phase D5 光纖區段重寫而移除（不再有任何引用）。
                // 使用者回報：光纖槽道往外移一點讓整體更整齊平均。原 1.50 距 E3 外側支撐柱
                // z=0.95 只有 0.55、距銅纜 2.30 卻有 0.80，間距不均；改為柱(0.95)與銅纜(2.30)的
                // 中點 1.625（四捨五入取 1.63），兩側淨距各 0.675，較平均。
                fiber:  { trayY: 3.75, ringXHalf: 4.30, ringZHalf: 1.63, trayW: 0.30, trayH: 0.10 },
                copper: { trayY: 4.00, trayZ: 2.30, trayW: 0.45, trayH: 0.10 },   // 外圈長邊 z（使用者回報原 2.60 太出去，收進 0.30）；短邊 x 沿用 fiber.ringXHalf
                // Rev D：power 改為艙內梯架(aisleZ) + 艙外主幹(outerZ)。trayZ 橋接欄位已隨 Phase D4
                // 電力/whip 區段重寫而移除（不再有任何引用）。
                power:  { trayY: 4.30, aisleZ: 0.75, outerZ: 2.60, trayW: 0.45, trayH: 0.12 },
                // Rev E Phase E3：舊 hanger 常數塊（細螺桿系統專用：rodR/topY/gridPitchX/gridXMin/
                // gridXMax/gridZHalf）已隨門架式 common support 取代整套細桿系統而移除（零引用）。
                // 新支撐站站距/站位改用 buildOverheadTrays() 內自訂的 stationXs 常數。
                cdu:    { x: -5.0, zA: 1.2, zB: -1.2, w: 1.2, h: 2.2, d: 1.0 },  // 列端佈置，隨新通道寬度外移
                // Rev D Phase D3：一次側改頂部出管、垂直拔高。
                // portDx 由規格值 -0.30 調整為 -0.40（詳見 Phase D3 回報）：字面值 -0.30 會讓一次側管
                // (x=-5.30, r=pipeR 0.075) 與 D2 已建置的二次側回水管(x=-5.25, r=headerR 0.055)只相距
                // 0.05m，小於兩管半徑和 0.13m，會實際穿模；-0.40 可與二次側兩條管都保持 ≥0.15m 淨距。
                riser:  { elbowY: 4.85, exitX: -7.20, pipeR: 0.075, portDx: -0.40, portDz: 0.20 },
                // Rev D 新增：機櫃背面垂直 manifold（僅 GPU 櫃，Phase D2 建置）
                manifold: { xOffset: 0.26, z: 0.82, yTop: 2.05, yBot: 0.40, r: 0.030 },
                // Rev D 新增、Rev E Phase E2 改為單支置中：機櫃背面 PDU busbar 統一常數
                // （xOffset 0.15→0，每櫃一支置中；w 為 Phase E2 新增，單支加寬到 0.12）
                pdu:      { xOffset: 0, z: 0.87, yTop: 1.95, yBot: 0.30, w: 0.12 },
                // Rev F Phase F4 新增、Rev G 修正：房間級風牆(Fanwall)，與 CDU 端(x=-5.0)相對，
                // 佈置在 +x 端，面朝機櫃模組(-x 方向)。依機房實務改為沿 +x 牆等距槽位佈置，
                // 預留位為同列空槽，徹底解決突出天花板與重疊問題。
                fanwall: { x: 6.8, slotZs: [-4.05, -1.35, 1.35, 4.05], installed: [0, 3],
                           w: 0.90, h: 2.20, d: 2.40 }
            },

            // 圖層管理器 —— 各 build 函式將幾何 group 註冊於此，供 UI 開關控制可見性
            layers: {},

            init() {
                const con = document.getElementById('canvas-container');
                this.scene = new THREE.Scene();
                this.scene.background = new THREE.Color(0x080c14); 
                this.scene.fog = new THREE.FogExp2(0x080c14, 0.015); 

                this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.camera.position.set(20, 15, 20); 

                this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                con.appendChild(this.renderer.domElement);

                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true; this.controls.dampingFactor = 0.05;
                this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
                this.controls.minDistance = 0.3; this.controls.maxDistance = 40; 

                this.createTextures();
                this.createMaterials();
                this.setupLighting();
                
                this.buildEnvironment();
                this.initLayers();
                this.buildHotAisleContainment();
                this.buildDataCenter();
                // this.buildPiping(); // Phase 2: 由 buildTCS() 取代（Vera Rubin 耐震分歧管系統）
                this.pipeGroup = new THREE.Group(); this.scene.add(this.pipeGroup); // 空殼保留，togglePipes/toggleCFD/updateExplodedView 仍引用它
                this.buildTCS();
                // this.buildPowerBusways(); // Phase 3: 由 buildOverheadTrays() 取代（Vera Rubin 上空線架系統）
                this.buswayGroup = new THREE.Group(); this.scene.add(this.buswayGroup); // 空殼保留，toggleCFD/updateExplodedView 仍引用它
                this.buildOverheadTrays();
                this.buildRackRearPDU();
                this.buildRackManifolds(); // Rev D Phase D2 新增：機櫃背面垂直 manifold
                this.buildRackCableEntries(); // Rev D Phase D5 新增：機櫃頂面纜線入口組件
                this.buildAisleBusways(); // Rev E Phase E4 新增：艙內 busway 匯流排槽系統
                this.buildRackTypeLabels(); // Rev F Phase F2 新增：機櫃角色型別標示板
                this.buildFanWalls(); // Rev F Phase F4 新增：房間級風牆機組 + 預留擴充位
                // buildInstancedDetails 已移至 createRack 中處理

                window.addEventListener('resize', () => this.resize());
                con.addEventListener('mousemove', (e) => this.onMouseMove(e));
                con.addEventListener('click', (e) => this.onClick(e));

                this.animate();

                this.updateHudState();
                setTimeout(() => { this.setCamera('overview'); }, 300);
            },

            resize() {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            },

            // ============================================================================
            // 圖層管理器（Phase 1）
            // ============================================================================
            registerLayer(name, group) {
                this.layers[name] = group;
                this.scene.add(group);
            },

            setLayerVisible(name, visible) {
                const layer = this.layers[name];
                if (!layer) {
                    console.warn(`setLayerVisible: layer "${name}" 不存在`);
                    return;
                }
                layer.visible = visible;
            },

            initLayers() {
                ['racks', 'containment', 'tcs', 'fiberTray', 'copperTray', 'powerTray', 'fanwall'].forEach(name => {
                    this.registerLayer(name, new THREE.Group());
                });
            },

            toggleLayer(name) {
                const layer = this.layers[name];
                if (!layer) {
                    console.warn(`toggleLayer: layer "${name}" 不存在`);
                    return;
                }
                layer.visible = !layer.visible;
                const btn = document.getElementById(`btn_layer_${name}`);
                if (btn) btn.classList.toggle('active', layer.visible);
            },

            toggleLeftHud() {
                this.leftHudVisible = !this.leftHudVisible;
                this.updateHudState();
            },

            updateHudState() {
                const hud = document.getElementById('hud-left');
                const btn = document.getElementById('btn_toggle_hud');
                if(this.leftHudVisible) {
                    hud.classList.add('active');
                    if(btn) btn.classList.add('active');
                } else {
                    hud.classList.remove('active');
                    if(btn) btn.classList.remove('active');
                }
            },

            applyCoupledData(data) {
                this.chillerDown = data.mepScenario === 'utilityFail';
                
                const itLoad = data.whitespaceLoad || 1200;
                const chillerPower = data.chillerPower || (itLoad * 0.12);
                
                // Realistic multi-component PUE formula
                const upsLoss = itLoad * 0.0417; // 96% efficiency
                const distLoss = itLoad * 0.015; // 1.5% distribution loss
                const crahFan = itLoad * 0.2 * 0.06; // CRAH EC fans for 20% air load
                const cduPower = 2.0; // CDU control overhead
                const pumpPower = itLoad * 0.03; // Primary/secondary pumps
                const towerPower = itLoad * 0.01; // Cooling tower fan power
                const infraPower = 50.0; // Standard facility auxiliary
                
                const totalPower = itLoad + upsLoss + distLoss + crahFan + cduPower + chillerPower + pumpPower + towerPower + infraPower;
                const calculatedPUE = itLoad > 0 ? (totalPower / itLoad) : 1.0;
                
                const pueEl = document.getElementById('hud_val_pue');
                if (pueEl) pueEl.setAttribute('data-base', calculatedPUE.toFixed(3));
            },

            createTextures() {
                const c1 = document.createElement('canvas'); c1.width = 64; c1.height = 64;
                const ctx1 = c1.getContext('2d');
                ctx1.fillStyle = '#000'; ctx1.fillRect(0,0,64,64);
                ctx1.strokeStyle = '#fff'; ctx1.lineWidth = 4;
                for(let y=0; y<64; y+=16) { for(let x=0; x<64; x+=16) {
                    ctx1.beginPath(); ctx1.arc(x + (y%32===0?0:8), y, 5, 0, Math.PI*2); ctx1.stroke();
                }}
                this.textures.honeycomb = new THREE.CanvasTexture(c1);
                this.textures.honeycomb.wrapS = this.textures.honeycomb.wrapT = THREE.RepeatWrapping; 
                this.textures.honeycomb.repeat.set(10, 30);

                const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 256;
                const ctx2 = c2.getContext('2d');
                ctx2.fillStyle = '#020617'; ctx2.fillRect(0,0,512,256);
                ctx2.fillStyle = '#76b900'; ctx2.fillRect(0,0,512,30);
                ctx2.fillStyle = '#000'; ctx2.font = 'bold 18px monospace'; ctx2.fillText('CDU CONTROL PANEL v3.2', 10, 22);
                ctx2.fillStyle = '#0ea5e9'; ctx2.font = 'bold 28px monospace'; ctx2.fillText('SUPPLY: 45.0°C', 20, 80);
                ctx2.fillStyle = '#ef4444'; ctx2.font = 'bold 28px monospace'; ctx2.fillText('RETURN: 55.0°C', 20, 120);
                ctx2.fillStyle = '#fff'; ctx2.font = '20px monospace'; ctx2.fillText('FLOW: 320.0 L/min', 20, 165);
                ctx2.fillText('PRESS: 2.45 Bar', 20, 200);
                ctx2.fillStyle = '#22c55e'; ctx2.font = 'bold 16px monospace'; ctx2.fillText('● ALL SYSTEMS NOMINAL', 20, 240);
                this.textures.cduScreen = new THREE.CanvasTexture(c2);

                // Flow pattern textures (Separate instances for independent flow direction control)
                const c3 = document.createElement('canvas'); c3.width = 64; c3.height = 128;
                const ctx3 = c3.getContext('2d');
                ctx3.fillStyle = '#1e293b'; ctx3.fillRect(0,0,64,128);
                ctx3.strokeStyle = '#ffffff';
                ctx3.lineWidth = 8;
                ctx3.lineCap = 'round';
                ctx3.lineJoin = 'round';
                
                // Chevron 1
                ctx3.beginPath();
                ctx3.moveTo(12, 35);
                ctx3.lineTo(32, 15);
                ctx3.lineTo(52, 35);
                ctx3.stroke();
                
                // Chevron 2
                ctx3.beginPath();
                ctx3.moveTo(12, 95);
                ctx3.lineTo(32, 75);
                ctx3.lineTo(52, 95);
                ctx3.stroke();
                
                this.textures.flowBlue = new THREE.CanvasTexture(c3);
                this.textures.flowBlue.wrapS = this.textures.flowBlue.wrapT = THREE.RepeatWrapping;
                this.textures.flowBlue.repeat.set(1, 4);

                const c4 = document.createElement('canvas'); c4.width = 64; c4.height = 128;
                const ctx4 = c4.getContext('2d');
                ctx4.drawImage(c3, 0, 0);
                this.textures.flowRed = new THREE.CanvasTexture(c4);
                this.textures.flowRed.wrapS = this.textures.flowRed.wrapT = THREE.RepeatWrapping;
                this.textures.flowRed.repeat.set(1, 4);

                // 熱通道滑門標誌板：Foxconn 字樣（取代原本純白方塊佔位）。無底色、白字。
                // 畫布解析度倍增到 1024×384（維持同比例、同字級佔比），配合下方標誌板
                // PlaneGeometry 放大到使用者參考紅框的尺寸，避免物理尺寸變大後貼圖模糊。
                const c5 = document.createElement('canvas'); c5.width = 1024; c5.height = 384;
                const ctx5 = c5.getContext('2d');
                ctx5.fillStyle = '#ffffff';
                ctx5.font = 'bold 258px Arial, sans-serif';
                ctx5.textAlign = 'center';
                ctx5.textBaseline = 'middle';
                ctx5.fillText('Foxconn', 512, 200);
                this.textures.foxconnBadge = new THREE.CanvasTexture(c5);

                // 機櫃頂板標誌牌：NVIDIA 字樣（使用者指定，深色底卡 + 綠色幾何圖示簡化示意
                // + 白色 NVIDIA 字樣；圖示非精確複製商標路徑，僅取相近的圓弧造型與品牌綠色）
                const c6 = document.createElement('canvas'); c6.width = 640; c6.height = 200;
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
                this.textures.nvidiaLogo = new THREE.CanvasTexture(c6);
            },

            createMaterials() {
                this.materials.rackFrame = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 });
                
                this.materials.glassDoor = new THREE.MeshPhysicalMaterial({ 
                    color: 0x334155, metalness: 0.1, roughness: 0.05, 
                    transmission: 0.85, transparent: true, opacity: 0.3, ior: 1.5, thickness: 0.02
                });
                
                this.materials.meshDoor = new THREE.MeshStandardMaterial({ 
                    color: 0x334155, metalness: 0.5, roughness: 0.5, alphaMap: this.textures.honeycomb, transparent: true, side: THREE.DoubleSide, depthWrite: false
                });

                this.materials.fp = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
                this.materials.lcd = new THREE.MeshBasicMaterial({ color: 0x0c4a6e });
                this.materials.port = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5 });
                this.materials.pipeBlueM = new THREE.MeshStandardMaterial({ 
                    color: 0x0ea5e9, 
                    metalness: 0.6, 
                    roughness: 0.3,
                    map: this.textures.flowBlue,
                    emissive: 0x0c4a6e,
                    emissiveIntensity: 0.5,
                    emissiveMap: this.textures.flowBlue
                });
                this.materials.pipeRedM = new THREE.MeshStandardMaterial({ 
                    color: 0xef4444, 
                    metalness: 0.6, 
                    roughness: 0.3,
                    map: this.textures.flowRed,
                    emissive: 0x7f1d1d,
                    emissiveIntensity: 0.5,
                    emissiveMap: this.textures.flowRed
                });
                this.materials.brass = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.3 });
                this.materials.aluminum = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.4 });
                this.materials.copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.2 });
            },

            setupLighting() {
                this.scene.add(new THREE.AmbientLight(0x4a5568, 2.5));

                const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
                mainLight.position.set(2, 8, 3);
                mainLight.castShadow = true;
                mainLight.shadow.mapSize.set(2048, 2048);
                mainLight.shadow.camera.left = -10; mainLight.shadow.camera.right = 10;
                mainLight.shadow.camera.top = 10; mainLight.shadow.camera.bottom = -10;
                this.scene.add(mainLight);

                const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
                fillLight.position.set(-5, 6, -3);
                this.scene.add(fillLight);

                const spot1 = new THREE.SpotLight(0xffffff, 1.5, 15, 0.6, 0.5, 1);
                spot1.position.set(0, 5.2, 3); spot1.target.position.set(0, 0, 0); // Rev C：頂燈隨天花板拉高 4.0→5.4，原 y=3.4≤4.2 拉高到 5.2
                this.scene.add(spot1); this.scene.add(spot1.target);

                const spot2 = new THREE.SpotLight(0xffffff, 1.5, 15, 0.6, 0.5, 1);
                spot2.position.set(0, 5.2, -3); spot2.target.position.set(0, 0, 0); // Rev C：同上
                this.scene.add(spot2); this.scene.add(spot2.target);

                const cduLight1 = new THREE.PointLight(0xffffff, 1.0, 5);
                cduLight1.position.set(-2.5, 1.5, 1.5); this.scene.add(cduLight1);

                const cduLight2 = new THREE.PointLight(0xffffff, 1.0, 5);
                cduLight2.position.set(-2.5, 1.5, -1.5); this.scene.add(cduLight2);

                const rackLight1 = new THREE.PointLight(0xfff5e6, 0.8, 3);
                rackLight1.position.set(0, 1.0, -0.9); this.scene.add(rackLight1);

                const rackLight2 = new THREE.PointLight(0xfff5e6, 0.8, 3);
                rackLight2.position.set(0, 1.0, 0.9); this.scene.add(rackLight2);
            },

            pushInstMatrix(array, x, y, z, rotY=0, parentMatrix=null) {
                const dummy = new THREE.Object3D();
                dummy.position.set(x, y, z);
                dummy.rotation.y = rotY;
                dummy.updateMatrix();
                if(parentMatrix) {
                    const worldMat = new THREE.Matrix4().multiplyMatrices(parentMatrix, dummy.matrix);
                    array.push(worldMat);
                } else {
                    array.push(dummy.matrix.clone());
                }
            },

            drawInternalPipe(parent, from, to, material) {
                const start = new THREE.Vector3(...from);
                const end = new THREE.Vector3(...to);
                const mid = start.clone().add(end).multiplyScalar(0.5);
                const len = start.distanceTo(end);
                const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 8), material);
                pipe.position.copy(mid);
                pipe.lookAt(end);
                pipe.rotateX(Math.PI/2);
                parent.add(pipe);
            },

            buildEnvironment() {
                const baseFloor = new THREE.Mesh(
                    new THREE.PlaneGeometry(30, 30), 
                    new THREE.MeshStandardMaterial({ color: 0x020408, metalness: 0.3, roughness: 0.7 })
                );
                baseFloor.rotation.x = -Math.PI / 2; 
                baseFloor.position.y = 0; 
                this.scene.add(baseFloor);

                // Rev G：冷通道地面標線已依要求移除
 
                // Rev C & Rev G：天花板連動點，隨 VR_LAYOUT.room.ceilingY 4.0→5.4 抬高，包絡擴大到 16x12
                const ceilY = this.VR_LAYOUT.room.ceilingY;
                const ceilW = this.VR_LAYOUT.room.ceilW;
                const ceilD = this.VR_LAYOUT.room.ceilD;
                const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ceilW, ceilD), new THREE.MeshStandardMaterial({color:0x1e293b, roughness:0.9}));
                ceil.rotation.x = Math.PI/2; ceil.position.y = ceilY; this.scene.add(ceil);
 
                // Rev G：建築柱，角落 4 支，colXs(-7.5/+7.5) * z=±colZ(5.5)
                // 柱底固定於 -0.6（原設計），柱頂隨新天花板拉伸到 ceilY
                const colBotY = -0.6;
                const colH = ceilY - colBotY;
                const colGeo = new THREE.BoxGeometry(0.4, colH, 0.4);
                const colMat = new THREE.MeshStandardMaterial({color:0x0f172a, roughness:0.8});
                
                this.VR_LAYOUT.room.colXs.forEach(x => {
                    [-1, 1].forEach(zSign => {
                        const colZ = zSign * this.VR_LAYOUT.room.colZ;
                        const col = new THREE.Mesh(colGeo, colMat);
                        col.position.set(x, (ceilY + colBotY) / 2, colZ);
                        this.scene.add(col);
                    });
                });
 
                // Rev G：燈具與 PointLight 從 3 組補為 5 組（z = -4/-2/0/2/4）
                for(let i=-4; i<=4; i+=2) {
                    const light = new THREE.PointLight(0xffffff, 0.8, 6);
                    light.position.set(0, ceilY - 0.2, i); // 頂燈拉高到 ceilY - 0.2 (5.2)
                    this.scene.add(light);
 
                    const fixture = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, 0.03, 0.15),
                        new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xffffff, emissiveIntensity:0.8})
                    );
                    fixture.position.set(0, ceilY - 0.02, i); // 貼天花板下緣，維持原本 0.02 間隙
                    this.scene.add(fixture);
                }
            },

            // 備份：Phase 4 改版前的 GB200 版熱通道封閉（保留不呼叫，供比對/還原用）
            buildHotAisleContainment_GB200_backup() {
                const containGroup = new THREE.Group();
                if (!this.materials.containmentPanel) {
                    this.materials.containmentPanel = new THREE.MeshPhysicalMaterial({
                        color: 0x88ccff, transmission: 0.5, transparent: true,
                        opacity: 0.45, side: THREE.DoubleSide, roughness: 0.2
                    });
                }
                if (!this.materials.containmentFrame) {
                    this.materials.containmentFrame = new THREE.MeshStandardMaterial({
                        color: 0xcbd5e1, metalness: 0.7, roughness: 0.4
                    });
                }
                const panelMat = this.materials.containmentPanel;
                const frameMat = this.materials.containmentFrame;

                const rackTopY = 2.2;
                const ceilY = 4.0;
                const frontA = -0.6;
                const frontB = 0.6;
                const aisleWidth = frontB - frontA;
                const aisleCenterZ = 0;
                const halfW = 3.73;
                const gapH = ceilY - rackTopY;
                const containCeilY = 2.8; // Raised containment ceiling Y to fit pipes inside

                const ceilPanel = new THREE.Mesh(
                    new THREE.BoxGeometry(halfW * 2 + 0.1, 0.03, aisleWidth),
                    panelMat
                );
                ceilPanel.position.set(0, containCeilY, aisleCenterZ);
                containGroup.add(ceilPanel);

                const edgeLong = new THREE.BoxGeometry(halfW * 2 + 0.1, 0.04, 0.04);
                const ceF = new THREE.Mesh(edgeLong, frameMat);
                ceF.position.set(0, containCeilY, frontA);
                containGroup.add(ceF);
                const ceB = new THREE.Mesh(edgeLong, frameMat);
                ceB.position.set(0, containCeilY, frontB);
                containGroup.add(ceB);

                if(gapH > 0.1) {
                    const gapPanelA = new THREE.Mesh(
                        new THREE.BoxGeometry(halfW * 2 + 0.1, gapH, 0.03),
                        panelMat
                    );
                    gapPanelA.position.set(0, rackTopY + gapH/2, frontA);
                    containGroup.add(gapPanelA);

                    const gapPanelB = new THREE.Mesh(
                        new THREE.BoxGeometry(halfW * 2 + 0.1, gapH, 0.03),
                        panelMat
                    );
                    gapPanelB.position.set(0, rackTopY + gapH/2, frontB);
                    containGroup.add(gapPanelB);
                }

                const endDoorH = rackTopY;
                const endL = new THREE.Mesh(
                    new THREE.BoxGeometry(0.03, endDoorH, aisleWidth),
                    panelMat
                );
                endL.position.set(-halfW, endDoorH / 2, aisleCenterZ);
                containGroup.add(endL);

                const frameVGeo = new THREE.BoxGeometry(0.04, endDoorH, 0.04);
                const flF = new THREE.Mesh(frameVGeo, frameMat);
                flF.position.set(-halfW, endDoorH/2, frontA);
                containGroup.add(flF);
                const flB = new THREE.Mesh(frameVGeo, frameMat);
                flB.position.set(-halfW, endDoorH/2, frontB);
                containGroup.add(flB);
                const flTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, aisleWidth), frameMat);
                flTop.position.set(-halfW, endDoorH, aisleCenterZ);
                containGroup.add(flTop);

                const endR = new THREE.Mesh(
                    new THREE.BoxGeometry(0.03, endDoorH, aisleWidth),
                    panelMat
                );
                endR.position.set(halfW, endDoorH / 2, aisleCenterZ);
                containGroup.add(endR);

                const frF = new THREE.Mesh(frameVGeo.clone(), frameMat);
                frF.position.set(halfW, endDoorH/2, frontA);
                containGroup.add(frF);
                const frB = new THREE.Mesh(frameVGeo.clone(), frameMat);
                frB.position.set(halfW, endDoorH/2, frontB);
                containGroup.add(frB);
                const frTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, aisleWidth), frameMat);
                frTop.position.set(halfW, endDoorH, aisleCenterZ);
                containGroup.add(frTop);

                if(gapH > 0.1) {
                    const gapEndL = new THREE.Mesh(
                        new THREE.BoxGeometry(0.03, gapH, aisleWidth),
                        panelMat
                    );
                    gapEndL.position.set(-halfW, rackTopY + gapH/2, aisleCenterZ);
                    containGroup.add(gapEndL);

                    const gapEndR = new THREE.Mesh(
                        new THREE.BoxGeometry(0.03, gapH, aisleWidth),
                        panelMat
                    );
                    gapEndR.position.set(halfW, rackTopY + gapH/2, aisleCenterZ);
                    containGroup.add(gapEndR);
                }

                const hlMat = new THREE.MeshBasicMaterial({color: 0xef4444, transparent: true, opacity: 0.4});
                const hl = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2.0, 1.0), hlMat);
                hl.rotation.x = -Math.PI/2;
                hl.position.set(0, 0.02, 0);
                containGroup.add(hl);

                this.containGroup = containGroup; // Store reference so toggleCFD can show/hide it
                this.scene.add(containGroup);
            },

            // ============================================================================
            // Vera Rubin NVL72 — 兩段式高架熱通道封閉（Phase 4）
            // 下段(0~rackTopY)：雙開玻璃滑門端部；上段(rackTopY~upperTopY)：窄煙囪式高架艙
            // （結構立柱 + 玻璃帷幕 + 回風百葉 + 艙頂封板），寬度收窄以避開 fiber 槽道。
            // 幾何仍掛在 this.containGroup，並同步指向 this.layers.containment。
            // ============================================================================
            buildHotAisleContainment() {
                const R = this.VR_LAYOUT.rack;
                const F = this.VR_LAYOUT.fiber;

                if (!this.materials.containmentPanel) {
                    this.materials.containmentPanel = new THREE.MeshPhysicalMaterial({
                        color: 0x88ccff, transmission: 0.5, transparent: true,
                        opacity: 0.45, side: THREE.DoubleSide, roughness: 0.2
                    });
                }
                if (!this.materials.containmentFrame) {
                    this.materials.containmentFrame = new THREE.MeshStandardMaterial({
                        color: 0xcbd5e1, metalness: 0.7, roughness: 0.4
                    });
                }
                if (!this.materials.hotAisleDark) {
                    this.materials.hotAisleDark = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5 }); // 深灰門框/結構立柱/百葉
                    this.materials.hotAisleBadge = new THREE.MeshBasicMaterial({ map: this.textures.foxconnBadge, transparent: true, depthWrite: false }); // Foxconn 字樣標誌板（白字無底色，需 transparent 才能顯示畫布透明區）
                }
                const panelMat = this.materials.containmentPanel;
                const darkMat = this.materials.hotAisleDark;

                const containGroup = new THREE.Group();

                const rackTopY = R.h;      // 2.20
                // Rev D：通道加寬到 1.8（機櫃前緣 z=±0.9，等於新艙牆 wallZ），下段滑門 z 範圍隨之外移
                const frontA = -0.9;
                const frontB = 0.9;
                const aisleWidth = frontB - frontA;  // 1.8
                const aisleCenterZ = 0;
                const halfW = 3.73;

                const addInstMesh = (parent, geo, mat, matrices) => {
                    if (matrices.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    parent.add(mesh);
                };

                // ============== 下段（0 ~ rackTopY）：雙開玻璃滑門端部 ==============
                // 兩端結構相同，重複元件（門扇/門框柱/標誌板）一律 InstancedMesh
                const railH = 0.06;
                const doorH = rackTopY - railH;
                const doorW = aisleWidth / 2 - 0.02;

                const doorMatrices = [], badgeMatrices = [], doorPostMatrices = [], railMatrices = [];
                [[-halfW, -1], [halfW, 1]].forEach(([xPos, sign]) => {
                    [frontA, aisleCenterZ].forEach(zStart => {
                        const doorZCenter = zStart + (aisleWidth / 2) / 2;
                        this.pushInstMatrix(doorMatrices, xPos, doorH / 2, doorZCenter);
                        this.pushInstMatrix(badgeMatrices, xPos + sign * 0.016, doorH * 0.5, doorZCenter, sign * Math.PI / 2);
                    });
                    [frontA, aisleCenterZ, frontB].forEach(z => {
                        this.pushInstMatrix(doorPostMatrices, xPos, rackTopY / 2, z);
                    });
                    this.pushInstMatrix(railMatrices, xPos, rackTopY - railH / 2, aisleCenterZ);
                });
                addInstMesh(containGroup, new THREE.BoxGeometry(0.03, doorH, doorW), panelMat, doorMatrices);
                addInstMesh(containGroup, new THREE.PlaneGeometry(0.65, 0.24), this.materials.hotAisleBadge, badgeMatrices); // 依使用者參考紅框放大（原 0.28×0.105），比例維持配合 Foxconn 字樣貼圖
                addInstMesh(containGroup, new THREE.BoxGeometry(0.04, rackTopY, 0.04), darkMat, doorPostMatrices);
                addInstMesh(containGroup, new THREE.BoxGeometry(0.08, railH, aisleWidth + 0.06), darkMat, railMatrices);

                // 底部紅色熱通道地面標示（保留）
                const hlMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.4 });
                const hl = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2.0, 1.0), hlMat);
                hl.rotation.x = -Math.PI / 2;
                hl.position.set(0, 0.02, 0);
                containGroup.add(hl);

                // ============== 上段（Rev D：全高煙囪，rackTopY ~ containment.topY 5.40，直上天花板）==============
                // 通道加寬到 1.8（艙牆 z=±0.90，與新機櫃前緣線對齊），煙囪頂部即天花板，
                // 不再有艙頂封板/grommet/百葉，回風改在頂部側牆飾框處。
                const CT = this.VR_LAYOUT.containment; // { wallZ: 0.90, halfW: 3.73, topY: 5.40, roofY: 3.50(橋接，見下方 buildOverheadTrays 註解) }
                const upperTopY = CT.topY;
                const wallZ = CT.wallZ;
                const upperMidY = (rackTopY + upperTopY) / 2;
                const upperH = upperTopY - rackTopY;

                // A. 側牆立柱（每 1.866m 一支，共 5 支含兩端，貫通全高 rackTopY~topY）
                //    + 玻璃牆分上下兩段（2.20~3.80 / 3.80~5.40，兩段等高 1.60，尺寸相同故合併一個
                //    InstancedMesh），中間一道橫 framing（draw-call 優化：全部走 InstancedMesh，
                //    不用個別 Mesh，避免相對 Phase C1 的舊 11 個 draw call 不減反增）
                const wallPostXs = [-halfW, -halfW / 2, 0, halfW / 2, halfW];
                const sidePostMatrices = [];
                const glassSplitY = 3.80;
                const glassSegH = glassSplitY - rackTopY;   // 1.60，上下兩段等高
                const glassLowerMidY = (rackTopY + glassSplitY) / 2;
                const glassUpperMidY = (glassSplitY + upperTopY) / 2;
                const glassMatrices = [], framingMatrices = [];
                [-wallZ, wallZ].forEach(z => {
                    wallPostXs.forEach(x => {
                        this.pushInstMatrix(sidePostMatrices, x, upperMidY, z);
                    });
                    this.pushInstMatrix(glassMatrices, 0, glassLowerMidY, z);
                    this.pushInstMatrix(glassMatrices, 0, glassUpperMidY, z);
                    this.pushInstMatrix(framingMatrices, 0, glassSplitY, z);
                });
                addInstMesh(containGroup, new THREE.BoxGeometry(0.10, upperH, 0.10), darkMat, sidePostMatrices);
                addInstMesh(containGroup, new THREE.BoxGeometry(halfW * 2, glassSegH, 0.03), panelMat, glassMatrices);
                addInstMesh(containGroup, new THREE.BoxGeometry(halfW * 2 + 0.06, 0.06, 0.08), darkMat, framingMatrices);

                // B. 端封板（x=±halfW，滑門上方整面，全高 rackTopY~topY）+ 門楣橫框
                //    + TCS 二次側穿牆封板預留位（y=3.20，z=±0.28/±0.55 四點，深灰方板）
                if (!this.materials.hotAisleBlind) {
                    this.materials.hotAisleBlind = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.3, roughness: 0.6 });
                }
                const endPanelMatrices = [], lintelMatrices = [], wallPlateMatrices2 = [];
                [-halfW, halfW].forEach(x => {
                    this.pushInstMatrix(endPanelMatrices, x, upperMidY, aisleCenterZ);
                    this.pushInstMatrix(lintelMatrices, x, rackTopY, aisleCenterZ);
                    [-0.55, -0.28, 0.28, 0.55].forEach(z => {
                        this.pushInstMatrix(wallPlateMatrices2, x, 3.20, z);
                    });
                });
                addInstMesh(containGroup, new THREE.BoxGeometry(0.03, upperH, wallZ * 2), panelMat, endPanelMatrices);
                addInstMesh(containGroup, new THREE.BoxGeometry(0.06, 0.06, wallZ * 2 + 0.04), darkMat, lintelMatrices);
                addInstMesh(containGroup, new THREE.BoxGeometry(0.02, 0.22, 0.22), this.materials.hotAisleBlind, wallPlateMatrices2);

                // C. 頂部側牆飾框（y=5.10~5.30，沿兩側牆全長，視覺收邊，全高煙囪頂部回風處）
                const trimMidY = (5.10 + 5.30) / 2;
                const trimH = 5.30 - 5.10;
                const trimMatrices = [];
                [-wallZ, wallZ].forEach(z => {
                    this.pushInstMatrix(trimMatrices, 0, trimMidY, z);
                });
                addInstMesh(containGroup, new THREE.BoxGeometry(halfW * 2 + 0.06, trimH, 0.06), this.materials.hotAisleBlind, trimMatrices);

                // Rev D：艙頂封板、48 個 grommet 環、百葉帶／盲板帶已隨全高煙囪設計移除（不再於此建立）

                this.containGroup = containGroup; // Store reference so toggleCFD can show/hide it
                this.layers.containment = containGroup; // 同步指向圖層系統（兩者指向同一 Group）
                this.scene.add(containGroup);
            },

            buildDataCenter() {
                const cduLayout = this.VR_LAYOUT.cdu;
                this.createCDU(cduLayout.x, 0, cduLayout.zA, 'CDU-A (Primary)');
                this.createCDU(cduLayout.x, 0, cduLayout.zB, 'CDU-B (Redundant)');
                // createCDU 不回傳 group、也沒有旋轉參數，故從 scene 內以 userData.name 尋回並旋轉，
                // 讓操作面朝向 +x（機櫃列方向），不修改 createCDU 函式本體
                ['CDU-A (Primary)', 'CDU-B (Redundant)'].forEach(name => {
                    const cduGroup = this.scene.children.find(c => c.userData && c.userData.name === name);
                    if (cduGroup) {
                        if (name.includes('CDU-A')) {
                            cduGroup.rotation.y = 0; // 下面那台，順時針轉90度 (Math.PI/2 -> 0)
                        } else {
                            cduGroup.rotation.y = Math.PI; // 上面那台，逆時針轉90度 (Math.PI/2 -> Math.PI)
                        }
                    }
                });

                const rowA_z = this.VR_LAYOUT.rack.rowA_z, rowB_z = this.VR_LAYOUT.rack.rowB_z; // Rev D：1.8m 通道，-1.5/+1.5
                const xs = [-3.41, -2.79, -2.17, -1.55, -0.93, -0.31, 0.31, 0.93, 1.55, 2.17, 2.79, 3.41];
                xs.forEach((x, i) => {
                    this.createRack(x, 0, rowA_z, 0, `Rack-A${i+1}`);
                    this.createRack(x, 0, rowB_z, Math.PI, `Rack-B${i+1}`);
                });

                // Rev F Phase F2：機櫃角色 userData 型別化（外掛寫入，不改 createRack 內部）。
                // hitBox.userData 在 createRack 內是以參考方式指向同一個 group.userData 物件
                // （hitBox.userData = group.userData），故這裡在 createRack 執行完後對該物件
                // 補寫欄位，raycast 點擊時 intersects[0].object.userData 也能同步讀到。
                const RACK_TYPE_INFO = {
                    compute: { typeLabel: 'VR200 COMPUTE', ratedPower: 240 },
                    switch:  { typeLabel: 'NVLINK SWITCH', ratedPower: 18 },
                    power:   { typeLabel: 'POWER SIDECAR', ratedPower: 35 },
                };
                const rackTypeOfCol = (colIdx) => {
                    if (colIdx === 0 || colIdx === 1 || colIdx === 10 || colIdx === 11) return 'switch';
                    if (colIdx === 2 || colIdx === 9) return 'power';
                    return 'compute';
                };
                ['A', 'B'].forEach(rowLetter => {
                    xs.forEach((x, i) => {
                        const name = `Rack-${rowLetter}${i + 1}`;
                        const rackGroup = this.scene.children.find(c => c.userData && c.userData.name === name);
                        if (rackGroup) {
                            const rackType = rackTypeOfCol(i);
                            Object.assign(rackGroup.userData, { rackType }, RACK_TYPE_INFO[rackType]);
                        }
                    });
                });
            },

            createCDU(x, y, z, name) {
                const w = 1.2, h = 2.2, d = 1.0;
                const group = new THREE.Group();
                group.position.set(x, h / 2, z);
                group.userData = { type: 'CDU', name: name };

                // ==========================================
                // 0. 材質極致精細化 (Advanced Materials)
                // ==========================================
                const stainlessMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.25, clearcoat: 0.3, clearcoatRoughness: 0.1 });
                const stainlessBrushed = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.75, roughness: 0.45 });
                const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.7 });
                const pumpMotorMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.7, clearcoat: 0.1 });
                const vesselWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.2, metalness: 0.1 }); // 膨脹槽專用白
                const copperMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.95, roughness: 0.2 });
                const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });
                const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.0 });
                const wireMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.8 });
                const phxCoreMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.6 });
                const filterMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.3, roughness: 0.4 }); // 過濾器藍色標識
                const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.98, transparent: true, opacity: 0.1, roughness: 0.0, ior: 1.52, thickness: 0.02 });
                
                // 調整：使 sideMat 玻璃外殼符合 30% 透明度 / 70% 不透明度 (transmission 0.3, opacity 0.7)
                const sideMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transmission: 0.3, transparent: true, opacity: 0.7, side: THREE.DoubleSide, roughness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.1 });

                const internalLight = new THREE.PointLight(0xffffff, 0.5, 2.5);
                internalLight.position.set(0, 0, 0);
                group.add(internalLight);

                // 共用工具函式
                const createFlange = (radius, thickness, boltCount = 8) => {
                    const fg = new THREE.Group();
                    const disk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 32), stainlessMat);
                    disk.rotation.x = Math.PI / 2;
                    fg.add(disk);
                    for (let i = 0; i < boltCount; i++) {
                        const angle = (i / boltCount) * Math.PI * 2;
                        const bx = Math.cos(angle) * (radius * 0.75);
                        const by = Math.sin(angle) * (radius * 0.75);
                        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, thickness + 0.012, 6), ironMat);
                        bolt.rotation.x = Math.PI / 2;
                        bolt.position.set(bx, by, 0);
                        fg.add(bolt);
                    }
                    return fg;
                };

                const createPipe = (radius, length, material = stainlessMat) => {
                    return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), material);
                };

                // ==========================================
                // 0.2 底部棧板與機櫃骨架 (Pallet Base & Frame)
                // ==========================================
                const baseGroup = new THREE.Group();
                // 底部重型黑色底座 (Forklift access)
                const skidBase = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), ironMat);
                skidBase.position.y = -h / 2 + 0.05;
                baseGroup.add(skidBase);
                // 堆高機孔洞 (視覺挖空)
                [-0.3, 0.3].forEach(px => {
                    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, d + 0.02), new THREE.MeshBasicMaterial({color: 0x000000}));
                    hole.position.set(px, -h / 2 + 0.05, 0);
                    baseGroup.add(hole);
                });
                group.add(baseGroup);

                const pillarGeo = new THREE.BoxGeometry(0.04, h - 0.1, 0.04);
                [[-w / 2 + 0.02, d / 2 - 0.02], [w / 2 - 0.02, d / 2 - 0.02],
                 [-w / 2 + 0.02, -d / 2 + 0.02], [w / 2 - 0.02, -d / 2 + 0.02]].forEach(p => {
                    const pMesh = new THREE.Mesh(pillarGeo, this.materials.rackFrame || ironMat);
                    pMesh.position.set(p[0], 0.05, p[1]);
                    group.add(pMesh);
                });

                // ==========================================
                // 補回原本的玻璃外殼、側板、百葉窗與門組件 (全四面半透明設計)
                // ==========================================
                // 頂板 (支援爆炸拆解)
                const topPlateGroup = new THREE.Group();
                topPlateGroup.position.set(0, h / 2, 0);
                topPlateGroup.userData = { isShell: true, origPos: topPlateGroup.position.clone(), explodeDir: new THREE.Vector3(0, 0.4, 0) };
                this.explodeShells.push(topPlateGroup);
                const topPlate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), this.materials.rackFrame || ironMat);
                topPlateGroup.add(topPlate);
                // 使用者直接授權新增（CLAUDE.md 第 5 條例外三）：頂板前緣 NVIDIA 標誌牌，
                // 掛在 topPlateGroup 下隨頂板一起爆炸拆解
                const nvidiaBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.11), this.materials.nvidiaLogoBadge);
                nvidiaBadge.position.set(0, -0.09, -d / 2 - 0.005);
                nvidiaBadge.rotation.y = Math.PI;
                topPlateGroup.add(nvidiaBadge);
                group.add(topPlateGroup);

                const botPlate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), this.materials.rackFrame || ironMat);
                botPlate.position.set(0, -h / 2 + 0.02, 0);
                group.add(botPlate);

                const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.02), sideMat);
                back.position.z = -d / 2 + 0.02;
                group.add(back);

                // 側板與散熱百葉窗 (支援爆炸拆解)
                [-1, 1].forEach(side => {
                    const sideGroup = new THREE.Group();
                    sideGroup.position.set(side * (w / 2 - 0.02), 0, 0);
                    sideGroup.userData = { isShell: true, origPos: sideGroup.position.clone(), explodeDir: new THREE.Vector3(side * 0.4, 0, 0) };
                    this.explodeShells.push(sideGroup);

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

                // 建立真正空心玻璃窗門的工具函式 (避免實心門板完全遮擋內部)
                const createGlassDoor = (dw, dh, dt, bw, xOffset) => {
                    const door = new THREE.Group();
                    const frameMat = this.materials.rackFrame || ironMat;
                    
                    // Top rail
                    const top = new THREE.Mesh(new THREE.BoxGeometry(dw, bw, dt), frameMat);
                    top.position.set(xOffset, dh / 2 - bw / 2, 0);
                    door.add(top);
                    
                    // Bottom rail
                    const bottom = new THREE.Mesh(new THREE.BoxGeometry(dw, bw, dt), frameMat);
                    bottom.position.set(xOffset, -dh / 2 + bw / 2, 0);
                    door.add(bottom);
                    
                    // Left stile
                    const left = new THREE.Mesh(new THREE.BoxGeometry(bw, dh - bw * 2, dt), frameMat);
                    left.position.set(xOffset - dw / 2 + bw / 2, 0, 0);
                    door.add(left);
                    
                    // Right stile
                    const right = new THREE.Mesh(new THREE.BoxGeometry(bw, dh - bw * 2, dt), frameMat);
                    right.position.set(xOffset + dw / 2 - bw / 2, 0, 0);
                    door.add(right);
                    
                    // Glass Pane (內嵌半透明藍色玻璃)
                    const glass = new THREE.Mesh(new THREE.PlaneGeometry(dw - bw * 2, dh - bw * 2), sideMat);
                    glass.position.set(xOffset, 0, dt / 2);
                    door.add(glass);
                    
                    return door;
                };

                // 左側玻璃視窗門 (採用空心外框，內部採用 sideMat 藍灰色高度半透明)
                const leftDoorGroup = createGlassDoor(w / 2, h - 0.08, 0.02, 0.04, -w / 4);
                leftDoorGroup.position.z = d / 2 - 0.01;
                group.add(leftDoorGroup);

                // 右側玻璃視窗門 (同上，空心玻璃外框)
                const rightDoorGroup = createGlassDoor(w / 2, h - 0.08, 0.02, 0.04, w / 4);
                rightDoorGroup.position.z = d / 2 - 0.01;
                group.add(rightDoorGroup);

                // 內部垂直 LED 燈條 (提供展示照明)
                const neonLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h - 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
                neonLeft.position.set(-w / 2 + 0.08, 0, d / 2 - 0.06);
                group.add(neonLeft);
                const neonRight = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h - 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
                neonRight.position.set(-0.08, 0, d / 2 - 0.06);
                group.add(neonRight);

                // ==========================================
                // 1. 底部：兩組大型板式熱交換器 (PHX)
                // ==========================================
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
                    // 頂部與底部導桿
                    const barGeo = new THREE.BoxGeometry(0.02, 0.04, pd + 0.1);
                    const topBar = new THREE.Mesh(barGeo, stainlessMat); topBar.position.y = ph/2 + 0.04; phx.add(topBar);
                    const botBar = new THREE.Mesh(barGeo, stainlessMat); botBar.position.y = -ph/2 - 0.04; phx.add(botBar);
                    return phx;
                };

                // 將 PHX 放置於機櫃下半部
                const phx1 = buildPHX(); phx1.position.set(-0.25, -0.55, 0.1); group.add(phx1);
                const phx2 = buildPHX(); phx2.position.set(0.25, -0.55, 0.1); group.add(phx2);

                // ==========================================
                // 2. 中段：三組並排的二次側幫浦 (3x Secondary Pumps)
                // ==========================================
                const buildXduPump = () => {
                    const pump = new THREE.Group();
                    // 前方黑色散熱馬達 (朝外)
                    const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.25, 32), pumpMotorMat);
                    motorBody.rotation.x = Math.PI / 2;
                    motorBody.position.set(0, 0, 0.15);
                    pump.add(motorBody);
                    
                    // 散熱鰭片細節
                    for (let i = 0; i < 24; i++) {
                        const angle = (i / 24) * Math.PI * 2;
                        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.02, 0.22), pumpMotorMat);
                        fin.position.set(Math.cos(angle) * 0.095, Math.sin(angle) * 0.095, 0.15);
                        fin.rotation.z = angle;
                        pump.add(fin);
                    }
                    
                    // 後方蝸殼 (Volute)
                    const volute = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 32), ironMat);
                    volute.scale.set(1, 1, 0.6);
                    volute.position.set(0, -0.02, -0.05);
                    pump.add(volute);

                    // 出水口 (垂直向上)
                    const discharge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16), ironMat);
                    discharge.position.set(0, 0.1, -0.05);
                    pump.add(discharge);
                    const dFlange = createFlange(0.05, 0.015);
                    dFlange.position.set(0, 0.15, -0.05);
                    dFlange.rotation.x = Math.PI / 2;
                    pump.add(dFlange);

                    // 進水口 (水平向後)
                    const suction = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16), ironMat);
                    suction.rotation.x = Math.PI / 2;
                    suction.position.set(0, -0.02, -0.15);
                    pump.add(suction);

                    return pump;
                };

                // 並排佈置三台幫浦 (在 PHX 上方)
                [-0.32, 0, 0.32].forEach((px, i) => {
                    const pump = buildXduPump();
                    pump.position.set(px, 0.1, 0.1);
                    pump.userData = { type: 'Pump', name: `Secondary Pump ${i+1}` };
                    group.add(pump);
                });

                // ==========================================
                // 3. 上半部前方：電控與變頻器面板 (Controller & Inverters)
                // ==========================================
                const elecPanelGroup = new THREE.Group();
                // 支援爆炸拆解 (整個面板往前飛出)
                elecPanelGroup.userData = { isShell: true, origPos: new THREE.Vector3(0, 0.6, 0.35), explodeDir: new THREE.Vector3(0, 0, 0.5) };
                this.explodeShells.push(elecPanelGroup);
                elecPanelGroup.position.set(0, 0.6, 0.35);

                // 主背板 (調整：使用半透明材料，避免擋住後面的水箱與管路)
                const panelBack = new THREE.Mesh(
                    new THREE.BoxGeometry(0.9, 0.7, 0.01), 
                    new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transmission: 0.9, transparent: true, opacity: 0.15, metalness: 0.1, roughness: 0.1 })
                );
                elecPanelGroup.add(panelBack);

                // 頂部 Controller/Processor Board
                const ctrlBoard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.04), ironMat);
                ctrlBoard.position.set(0, 0.25, 0.03);
                elecPanelGroup.add(ctrlBoard);
                const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), new THREE.MeshBasicMaterial({color: 0x0ea5e9})); // HMI 螢幕
                screen.position.set(-0.2, 0.25, 0.051);
                elecPanelGroup.add(screen);

                // 中間 3x Pump Inverter Drivers (黑色方塊帶散熱柵欄)
                [-0.25, 0, 0.25].forEach(px => {
                    const inverter = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.08), pumpMotorMat);
                    inverter.position.set(px, -0.05, 0.05);
                    elecPanelGroup.add(inverter);
                    
                    // 變頻器散熱孔
                    const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), new THREE.MeshBasicMaterial({color: 0x000000, wireframe: true}));
                    vent.position.set(px, -0.1, 0.091);
                    elecPanelGroup.add(vent);

                    // 旁邊的小型 EMC Filter
                    const emc = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.03), stainlessMat);
                    emc.position.set(px + 0.11, -0.05, 0.03);
                    elecPanelGroup.add(emc);
                });

                // 狀態指示燈帶金屬邊框 (與電控箱面板整合，維持 leakAlarm 連動)
                if (!this.cduIndicators) this.cduIndicators = [];
                const indicators = { green: null, yellow: null, red: null };

                [0x22c55e, 0xfbbf24, 0xef4444].forEach((c, i) => {
                    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.01, 16), stainlessMat);
                    bezel.rotation.x = Math.PI / 2;
                    bezel.position.set(0.1 + i * 0.04, 0.25, 0.05);
                    elecPanelGroup.add(bezel);
                    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 16), new THREE.MeshBasicMaterial({ color: c }));
                    lens.position.set(0.1 + i * 0.04, 0.25, 0.054);
                    elecPanelGroup.add(lens);

                    if (i === 0) indicators.green = lens;
                    else if (i === 1) indicators.yellow = lens;
                    else if (i === 2) indicators.red = lens;
                });

                group.userData.indicators = indicators;
                this.cduIndicators.push(indicators);

                group.add(elecPanelGroup);

                // ==========================================
                // 4. 頂部：三組膨脹槽 (3x Expansion Vessels) - 修正高度往下沉
                // ==========================================
                const vesselGroup = new THREE.Group();
                [-0.25, 0, 0.25].forEach(px => {
                    const v = new THREE.Group();
                    const vr = 0.09, vh = 0.2;
                    // 槽體
                    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(vr, vr, vh, 32), vesselWhiteMat);
                    const top = new THREE.Mesh(new THREE.SphereGeometry(vr, 32, 16, 0, Math.PI*2, 0, Math.PI/2), vesselWhiteMat);
                    top.position.y = vh/2;
                    const bot = new THREE.Mesh(new THREE.SphereGeometry(vr, 32, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2), vesselWhiteMat);
                    bot.position.y = -vh/2;
                    v.add(cyl, top, bot);

                    // 頂部洩壓閥 (Pressure Relief Valve)
                    const prValve = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04), brassMat);
                    prValve.position.y = vh/2 + vr + 0.02;
                    v.add(prValve);

                    // 底部連接管
                    const connPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1), stainlessMat);
                    connPipe.position.y = -vh/2 - 0.05;
                    v.add(connPipe);

                    v.position.set(px, 0.85, -0.1); // 高度從 1.1 修正為 0.85，使其完全收入機櫃頂板（1.1）下方
                    vesselGroup.add(v);
                });
                group.add(vesselGroup);

                // ==========================================
                // 5. 後方與側邊：複雜的歧管系統 (Manifolds & Flow Meters)
                // ==========================================
                const pipeGroup = new THREE.Group();
                // 整個管路群組支援向後爆炸拆解
                pipeGroup.userData = { isShell: true, origPos: new THREE.Vector3(0, 0, 0), explodeDir: new THREE.Vector3(0, 0, -0.5) };
                this.explodeShells.push(pipeGroup);
                group.add(pipeGroup);

                // 主要垂直供回水歧管 (Primary/Secondary Flow headers)
                const mainHeader1 = createPipe(0.06, 1.8, stainlessMat);
                mainHeader1.position.set(0.4, 0, -0.2);
                pipeGroup.add(mainHeader1);
                
                const mainHeader2 = createPipe(0.06, 1.8, stainlessMat);
                mainHeader2.position.set(0.4, 0, -0.38);
                pipeGroup.add(mainHeader2);

                // 流量計 (Flow Meters - 裝在主直管上)
                const flowMeter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 24), ironMat);
                flowMeter.position.set(0.4, 0.5, -0.2);
                pipeGroup.add(flowMeter);

                // 幫浦上方的橫向匯集管 (Secondary pump outlet manifold)
                const upperManifold = createPipe(0.05, 0.8, stainlessMat);
                upperManifold.rotation.z = Math.PI / 2;
                upperManifold.position.set(0, 0.45, 0.05);
                pipeGroup.add(upperManifold);

                // 連接幫浦到上方橫管的垂直分支
                [-0.32, 0, 0.32].forEach(px => {
                    const branch = createPipe(0.03, 0.2, stainlessMat);
                    branch.position.set(px, 0.35, 0.05);
                    pipeGroup.add(branch);
                    // 過濾器/閥門隔離 (Filter/pump isolation valves)
                    const isoValve = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), ironMat);
                    isoValve.position.set(px, 0.35, 0.05);
                    pipeGroup.add(isoValve);
                });

                // 膨脹槽底部的橫向連接管 - 高度同步下移
                const vesselManifold = createPipe(0.02, 0.6, stainlessMat);
                vesselManifold.rotation.z = Math.PI / 2;
                vesselManifold.position.set(0, 0.65, -0.1); // 高度從 0.9 修正為 0.65，配合膨脹水箱下移
                pipeGroup.add(vesselManifold);

                // 連接至熱交換器的下方橫管
                const lowerManifold = createPipe(0.05, 0.8, stainlessMat);
                lowerManifold.rotation.z = Math.PI / 2;
                lowerManifold.position.set(0, -0.2, 0.1);
                pipeGroup.add(lowerManifold);

                // ==========================================
                // 7. 互動判定框 (HitBox)
                // ==========================================
                const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
                hitBox.userData = group.userData;
                group.add(hitBox);
                this.interactables.push(hitBox);

                this.scene.add(group);
            },
            createRack(x, y, z, rot, name) {
                const w = 0.6, h = 2.2, d = 1.2;
                const group = new THREE.Group();
                group.position.set(x, h / 2, z);
                group.rotation.y = rot;
                group.userData = { type: 'Rack', name: name };
                
                // 1. 初始化與擴展材質 (新增 Vera Rubin 世代的特調香檳金)
                if (!this.materials.copperDetail) {
                    this.materials.copperDetail = new THREE.MeshStandardMaterial({ color: 0xd27d2d, metalness: 0.9, roughness: 0.15 });
                    this.materials.pcbGreen = new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.9 });
                    this.materials.chromeDetail = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
                    this.materials.darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.7, roughness: 0.5 }); // 加深為極深的鐵灰色/黑
                    this.materials.goldPin = new THREE.MeshStandardMaterial({ color: 0xfbb034, metalness: 1.0, roughness: 0.1 });
                    this.materials.ledGreen = new THREE.MeshBasicMaterial({ color: 0x76b900 });
                    this.materials.rubberBlack = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, metalness: 0.1 }); // 線材黑
                    this.materials.blankingPanel = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.8 });
                    this.materials.copperTube = new THREE.MeshStandardMaterial({ color: 0xc47e4a, metalness: 0.85, roughness: 0.25 });
                    this.materials.leakSensor = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.4, roughness: 0.5 });
                    this.materials.blueHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 });
                    this.materials.redHose = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.1, roughness: 0.8 });
                    this.materials.blueCollar = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.8, roughness: 0.2 });
                    this.materials.redCollar = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 });
                    this.materials.brassDetail = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
                    
                    // Rubin / GB200 標誌性香檳金面板（色號 #C5B091 由使用者指定為目標色）。
                    // 場景沒有 envMap，metalness 過高會全黑（第一次修正的問題）；但 metalness
                    // 太低時，這個場景偏強的 Ambient(2.5)+Directional+Spot 光會把亮色系底色
                    // 洗到接近白色（第二次回報「差了一點」，偏白偏亮）。改用「降底色亮度＋
                    // 中等 metalness」取得平衡：色號本身不變（仍是 C5B091 的色相與飽和度），
                    // 只是整體調暗約 28% 讓實際顯色落在暖金色範圍，不會被場景光洗白。
                    this.materials.champagneGold = new THREE.MeshStandardMaterial({
                        color: 0x8E7F68,
                        metalness: 0.4,
                        roughness: 0.45
                    });

                    // 機櫃頂板 NVIDIA 標誌牌（使用者直接授權，CLAUDE.md 第 5 條例外三）
                    this.materials.nvidiaLogoBadge = new THREE.MeshBasicMaterial({ map: this.textures.nvidiaLogo });
                }

                const {
                    copperDetail, pcbGreen, chromeDetail, darkMetal, goldPin, ledGreen,
                    rackFrame, meshDoor, pipeBlueM, pipeRedM,
                    rubberBlack, blankingPanel, copperTube, leakSensor, champagneGold
                } = this.materials;

                const createFlange = (radius, thickness, boltCount = 4) => {
                    const fg = new THREE.Group();
                    fg.add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 20), chromeDetail));
                    for (let i = 0; i < boltCount; i++) {
                        const angle = (i / boltCount) * Math.PI * 2;
                        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, thickness + 0.008, 6), darkMetal);
                        bolt.position.set(Math.cos(angle) * radius * 0.7, 0, Math.sin(angle) * radius * 0.7);
                        fg.add(bolt);
                    }
                    return fg;
                };

                // 2. 機櫃骨架 (深色系)
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

                const eiaGeo = new THREE.BoxGeometry(0.018, h - 0.12, 0.025);
                const eiaPositions = [
                    [-w / 2 + 0.05, d / 2 - 0.06], [w / 2 - 0.05, d / 2 - 0.06],
                    [-w / 2 + 0.05, -d / 2 + 0.06], [w / 2 - 0.05, -d / 2 + 0.06],
                ];
                eiaPositions.forEach(pos => {
                    const eiaPost = new THREE.Mesh(eiaGeo, darkMetal);
                    eiaPost.position.set(pos[0], 0, pos[1]);
                    group.add(eiaPost);
                    for (let hole = 0; hole < 42 * 3; hole++) {
                        if (hole % 6 !== 0) continue;
                        const holeY = -h / 2 + 0.12 + hole * ((h - 0.15) / (42 * 3));
                        const holeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.003), darkMetal);
                        holeMesh.position.set(pos[0], holeY, pos[1] + 0.013);
                        group.add(holeMesh);
                    }
                });

                // 機櫃頂板與底板
                const topCoverGroup = new THREE.Group();
                topCoverGroup.position.y = h / 2;
                topCoverGroup.userData = { isShell: true, origPos: topCoverGroup.position.clone(), explodeDir: new THREE.Vector3(0, 2.8, 0) };
                this.explodeShells.push(topCoverGroup);
                const topCover = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), darkMetal);
                topCoverGroup.add(topCover);
                group.add(topCoverGroup);

                const botCover = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d + 0.04), darkMetal);
                botCover.position.y = -h / 2;
                group.add(botCover);

                const casterPositions = [
                    [-w / 2 + 0.08, -d / 2 + 0.1], [w / 2 - 0.08, -d / 2 + 0.1],
                    [-w / 2 + 0.08, d / 2 - 0.1], [w / 2 - 0.08, d / 2 - 0.1]
                ];
                casterPositions.forEach((cp, idx) => {
                    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), darkMetal);
                    bracket.position.set(cp[0], -h / 2 - 0.02, cp[1]);
                    group.add(bracket);
                    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12), rubberBlack);
                    wheel.rotation.z = Math.PI / 2;
                    wheel.position.set(cp[0], -h / 2 - 0.045, cp[1]);
                    group.add(wheel);
                    if (idx < 2) {
                        const brake = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.01), chromeDetail);
                        brake.position.set(cp[0] + 0.02, -h / 2 - 0.035, cp[1]);
                        group.add(brake);
                    }
                });

                casterPositions.forEach(cp => {
                    const footBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), chromeDetail);
                    footBolt.position.set(cp[0], -h / 2 - 0.03, cp[1]);
                    group.add(footBolt);
                    const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.008, 12), rubberBlack);
                    footPad.position.set(cp[0], -h / 2 - 0.06, cp[1]);
                    group.add(footPad);
                });

                // 使用者直接授權移除（見 CLAUDE.md 第 5 條例外二）：前門整組已移除，機櫃不再有門。
                // rackFrontDoors 保持為空陣列，toggleDoors()/toggleExplode() 本體不動，
                // 其既有的 `if (this.rackFrontDoors)` 防呆已可安全處理空陣列。

                // 機櫃側板
                [-1, 1].forEach(side => {
                    const sideGroup = new THREE.Group();
                    sideGroup.position.set(side * (w / 2), 0, 0);
                    let explodeDist = 0;
                    if (rot === 0) { 
                        if (side === -1 && x < -1.2) explodeDist = -0.6; 
                        if (side === 1 && x > 1.2) explodeDist = 0.6;   
                    } else { 
                        if (side === 1 && x < -1.2) explodeDist = 0.6;   
                        if (side === -1 && x > 1.2) explodeDist = -0.6;  
                    }
                    sideGroup.userData = { isShell: true, origPos: sideGroup.position.clone(), explodeDir: new THREE.Vector3(explodeDist, 0, 0) };
                    if (explodeDist !== 0) {
                        this.explodeShells.push(sideGroup);
                    }
                    const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.015, h - 0.1, d - 0.08), darkMetal);
                    sideGroup.add(sidePanel);
                    
                    [-0.3, 0.3].forEach(cy => {
                        const clip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.015), chromeDetail);
                        clip.position.set(side * 0.005, cy, d / 2 - 0.08);
                        sideGroup.add(clip);
                    });
                    group.add(sideGroup);
                });

                const instData = {
                    trayBody: [], trayFaceplate: [], trayBottom: [], pcb: [], handle: [],
                    gpuPlate: [], cpuPlate: [], switchPlate: [],
                    plateCover: [], fittings: [],
                    qdcMale: [], qdcFemale: [],
                    osfpPort: [], psuModule: [], statusLed: [], ledStrip: [],
                    blankPanel: [], coldTube: [], coldTubeBlue: [], coldTubeRed: [],
                    hoseCollarBlue: [], hoseCollarRed: [],
                    psuFanGrill: [], psuHandle: [],
                    memModule: [], vrm: [],
                };

                const pushInst = (arr, px, py, pz, sx = 1, sy = 1, sz = 1, ry = 0) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(px, py, pz);
                    dummy.scale.set(sx, sy, sz);
                    dummy.rotation.y = ry;
                    dummy.updateMatrix();
                    arr.push(dummy.dummyMatrix || dummy.matrix);
                };

                const totalU = 48;
                const uHeight = 0.0444; 
                const startY = -h / 2 + 0.08;
                const trayW = w - 0.08;
                const trayD = d - 0.12;

                const xs = [-3.41, -2.79, -2.17, -1.55, -0.93, -0.31, 0.31, 0.93, 1.55, 2.17, 2.79, 3.41];
                let colIdx = 0;
                let minDist = 999;
                xs.forEach((px, idx) => {
                    const dDist = Math.abs(x - px);
                    if (dDist < minDist) { minDist = dDist; colIdx = idx; }
                });

                const isSwitchRack = colIdx === 0 || colIdx === 1 || colIdx === 10 || colIdx === 11;
                const isPowerRack = colIdx === 2 || colIdx === 9;
                const isComputeRack = !isSwitchRack && !isPowerRack;

                // 前置線束群組 (用於 Vera Rubin 密集佈線特徵)
                const frontCableGroup = new THREE.Group();
                group.add(frontCableGroup);

                for (let u = 0; u < totalU; u++) {
                    const ty = startY + u * uHeight;

                    if (isComputeRack) {
                        if (u === 0 || u === 1 || u === 2) {
                            // 底部 Power Shelves (深色)
                            for (let p = 0; p < 4; p++) {
                                const px = -trayW/2 + 0.05 + p * (trayW - 0.1)/3;
                                pushInst(instData.psuModule, px, ty, 0, 0.06, uHeight * 0.9, trayD * 0.95);
                                pushInst(instData.psuFanGrill, px, ty, -trayD/2 - 0.002, 0.05, uHeight * 0.8, 0.005);
                                pushInst(instData.psuHandle, px - 0.02, ty, -trayD/2 - 0.005, 0.008, uHeight * 0.6, 0.01);
                                pushInst(instData.statusLed, px + 0.02, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                            }
                        }
                        else if (u >= 3 && u <= 11) {
                            // NVLink Switch trays (香檳金面板)
                            pushInst(instData.trayBody, 0, ty, 0, trayW, uHeight * 0.9, trayD - 0.02);
                            pushInst(instData.trayFaceplate, 0, ty, -trayD / 2 - 0.005, trayW, uHeight * 0.95, 0.015);

                            for (let port = 0; port < 24; port++) {
                                const px = -trayW / 2 + 0.03 + port * (trayW - 0.06)/23;
                                pushInst(instData.osfpPort, px, ty, -trayD / 2 - 0.015, 0.01, uHeight * 0.35, 0.02);
                            }
                            pushInst(instData.ledStrip, 0, ty + uHeight * 0.35, -trayD / 2 - 0.008, trayW * 0.92, 0.003, 0.002);
                            [-0.16, 0.16].forEach(sx => {
                                pushInst(instData.cpuPlate, sx, ty, -0.15, 0.06, 0.012, 0.06);
                                pushInst(instData.cpuPlate, sx, ty, 0.15, 0.06, 0.012, 0.06);
                            });
                            pushInst(instData.coldTube, -0.16, ty + 0.006, 0.0, 0.005, 0.005, 0.3);
                            pushInst(instData.coldTube, 0.16, ty + 0.006, 0.0, 0.005, 0.005, 0.3);
                            
                            // 動態生成前置短線束 (迴圈式)
                            for (let side of [-1, 1]) {
                                for (let c = 0; c < 3; c++) {
                                    const start = new THREE.Vector3(side * (0.1 + c * 0.08), ty, -trayD / 2 - 0.02);
                                    const end = new THREE.Vector3(side * (w / 2 - 0.06), ty + (c-1)*0.01, -trayD / 2 + 0.03);
                                    const ctrl = new THREE.Vector3(side * (w / 2 - 0.12), ty, -trayD / 2 - 0.12);
                                    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
                                    const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.0025, 4, false), rubberBlack);
                                    frontCableGroup.add(cableMesh);
                                }
                            }
                        }
                        else if (u >= 12 && u <= 47 && u % 2 === 0) {
                            // Compute trays (2U, 香檳金面板)
                            pushInst(instData.trayBody, 0, ty + uHeight * 0.5, 0.01, trayW, uHeight * 1.8, trayD - 0.02);
                            pushInst(instData.trayFaceplate, 0, ty + uHeight * 0.5, -trayD / 2 - 0.005, trayW, uHeight * 1.9, 0.015);

                            pushInst(instData.handle, -trayW / 2 + 0.03, ty + uHeight * 0.5, -trayD / 2 - 0.02, 0.015, uHeight * 0.8, 0.02);
                            pushInst(instData.handle, trayW / 2 - 0.03, ty + uHeight * 0.5, -trayD / 2 - 0.02, 0.015, uHeight * 0.8, 0.02);

                            for (let p = 0; p < 8; p++) {
                                const px = -0.1 + p * 0.025;
                                pushInst(instData.osfpPort, px, ty + uHeight * 0.5, -trayD / 2 - 0.015, 0.015, uHeight * 0.4, 0.01);
                            }
                            pushInst(instData.statusLed, -trayW / 2 + 0.05, ty + uHeight * 0.5, -trayD / 2 - 0.016, 0.006, 0.006, 0.006);

                            // 生成標誌性密集高壓線束 (連至兩側理線槽)
                            for (let side of [-1, 1]) {
                                for (let c = 0; c < 5; c++) {
                                    const start = new THREE.Vector3(side * (0.05 + c * 0.035), ty + uHeight * 0.5, -trayD / 2 - 0.02);
                                    const end = new THREE.Vector3(side * (w / 2 - 0.05), ty + uHeight * 0.5 + (c-2)*0.015, -trayD / 2 + 0.05);
                                    const ctrl = new THREE.Vector3(side * (w / 2 - 0.08), ty + uHeight * 0.5, -trayD / 2 - 0.18 - (c*0.01));
                                    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
                                    const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.0035, 5, false), rubberBlack);
                                    frontCableGroup.add(cableMesh);
                                }
                            }

                            // 內部液冷與硬體組件 (保留精確的 Direct-to-Chip 設定)
                            pushInst(instData.pcb, 0, ty + uHeight * 0.25, 0, trayW * 0.92, 0.004, trayD * 0.88);
                            pushInst(instData.gpuPlate, 0, ty + uHeight * 0.25 + 0.005, 0.05, 0.03, 0.008, 0.08);

                            [-0.1, 0.1].forEach(gx => {
                                [-0.15, -0.02].forEach(gz => {
                                    pushInst(instData.gpuPlate, gx, ty + uHeight * 0.5 - 0.004, gz, 0.09, 0.006, 0.09);
                                    pushInst(instData.plateCover, gx, ty + uHeight * 0.5 + 0.003, gz, 0.086, 0.006, 0.086);
                                    pushInst(instData.fittings, gx - 0.022, ty + uHeight * 0.5 + 0.012, gz, 0.006, 0.012, 0.006);
                                    pushInst(instData.fittings, gx + 0.022, ty + uHeight * 0.5 + 0.012, gz, 0.006, 0.012, 0.006);
                                    pushInst(instData.coldTube, gx, ty + uHeight * 0.5 + 0.008, gz, 0.004, 0.004, 0.07, Math.PI / 2);
                                });
                            });
                            [-0.1, 0.1].forEach(cx => {
                                pushInst(instData.cpuPlate, cx, ty + uHeight * 0.5 - 0.004, 0.18, 0.075, 0.006, 0.075);
                                pushInst(instData.plateCover, cx, ty + uHeight * 0.5 + 0.003, 0.18, 0.071, 0.006, 0.071);
                                pushInst(instData.fittings, cx - 0.018, ty + uHeight * 0.5 + 0.012, 0.18, 0.006, 0.012, 0.006);
                                pushInst(instData.fittings, cx + 0.018, ty + uHeight * 0.5 + 0.012, 0.18, 0.006, 0.012, 0.006);
                                pushInst(instData.coldTube, cx, ty + uHeight * 0.5 + 0.008, 0.18, 0.004, 0.004, 0.06, Math.PI / 2);
                            });
                            for (let mem = 0; mem < 16; mem++) {
                                const mx = -0.16 + (mem % 8) * 0.012 + (mem >= 8 ? 0.22 : 0);
                                const mz = mem >= 8 ? 0.22 : 0.05;
                                pushInst(instData.memModule, mx, ty + uHeight * 0.5 + 0.005, mz, 0.005, 0.015, 0.045);
                            }
                            [-0.12, 0.12].forEach(vx => {
                                pushInst(instData.vrm, vx, ty + uHeight * 0.5 + 0.005, -0.05, 0.08, 0.01, 0.04);
                            });
                            
                            pushInst(instData.qdcMale, -trayW / 2 + 0.035, ty + uHeight * 0.5, trayD / 2 + 0.015, 0.022, 0.022, 0.06);
                            pushInst(instData.qdcMale, trayW / 2 - 0.035, ty + uHeight * 0.5, trayD / 2 + 0.015, 0.022, 0.022, 0.06);
                            const qdcZ_Male = trayD / 2 + 0.008;
                            const qdcZ_Female = trayD / 2 + 0.035;
                            [-0.13, 0.13].forEach(qx => {
                                pushInst(instData.qdcMale, qx, ty + uHeight * 0.5, qdcZ_Male, 0.018, 0.018, 0.035);
                                pushInst(instData.qdcFemale, qx, ty + uHeight * 0.5, qdcZ_Female, 0.022, 0.022, 0.035);
                            });
                            
                            [-0.14, -0.06].forEach(tx => {
                                pushInst(instData.coldTubeBlue, tx, ty + uHeight * 0.5 + 0.010, 0.05, 0.006, 0.006, 0.38);
                                pushInst(instData.hoseCollarBlue, tx, ty + uHeight * 0.5 + 0.010, -0.13, 0.007, 0.007, 0.015);
                                pushInst(instData.hoseCollarBlue, tx, ty + uHeight * 0.5 + 0.010, 0.23, 0.007, 0.007, 0.015);
                            });
                            [0.06, 0.14].forEach(tx => {
                                pushInst(instData.coldTubeRed, tx, ty + uHeight * 0.5 + 0.010, 0.05, 0.006, 0.006, 0.38);
                                pushInst(instData.hoseCollarRed, tx, ty + uHeight * 0.5 + 0.010, -0.13, 0.007, 0.007, 0.015);
                                pushInst(instData.hoseCollarRed, tx, ty + uHeight * 0.5 + 0.010, 0.23, 0.007, 0.007, 0.015);
                            });
                        }
                    }
                    else if (isPowerRack) {
                        // Power Rack 保持深色外觀
                        if (u % 2 === 0) {
                            for (let p = 0; p < 6; p++) {
                                const px = -trayW/2 + 0.04 + p * (trayW - 0.08)/5;
                                pushInst(instData.psuModule, px, ty, 0, 0.06, uHeight * 0.9, trayD * 0.95);
                                pushInst(instData.psuFanGrill, px, ty, -trayD/2 - 0.002, 0.05, uHeight * 0.8, 0.005);
                                pushInst(instData.psuHandle, px - 0.02, ty, -trayD/2 - 0.005, 0.008, uHeight * 0.6, 0.01);
                                pushInst(instData.statusLed, px + 0.02, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                            }
                        } else {
                            for (let b = 0; b < 4; b++) {
                                const bx = -trayW/2 + 0.05 + b * (trayW - 0.1)/3;
                                pushInst(instData.trayBody, bx, ty, 0, 0.1, uHeight * 0.9, trayD * 0.9);
                                pushInst(instData.statusLed, bx, ty + 0.015, -trayD/2 - 0.006, 0.006, 0.006, 0.006);
                            }
                        }
                    }
                    else if (isSwitchRack) {
                        if (u % 2 === 0) {
                            pushInst(instData.trayBody, 0, ty + uHeight * 0.5, 0, trayW, uHeight * 1.8, trayD);
                            pushInst(instData.trayFaceplate, 0, ty + uHeight * 0.5, -trayD / 2 - 0.005, trayW, uHeight * 1.9, 0.015); // 開關櫃也使用金面板
                            
                            for (let port = 0; port < 24; port++) {
                                const px = -trayW / 2 + 0.03 + port * (trayW - 0.06)/23;
                                pushInst(instData.osfpPort, px, ty + uHeight * 0.5, -trayD / 2 - 0.015, 0.012, uHeight * 0.7, 0.025);
                            }
                            pushInst(instData.ledStrip, 0, ty + uHeight * 1.25, -trayD / 2 - 0.008, trayW * 0.92, 0.003, 0.002);
                            [-0.16, 0.16].forEach(sx => {
                                pushInst(instData.cpuPlate, sx, ty + uHeight * 0.5, -0.15, 0.06, 0.015, 0.06);
                                pushInst(instData.cpuPlate, sx, ty + uHeight * 0.5, 0.15, 0.06, 0.015, 0.06);
                            });
                            
                            // 動態生成前置短線束
                            for (let side of [-1, 1]) {
                                for (let c = 0; c < 6; c++) {
                                    const start = new THREE.Vector3(side * (0.05 + c * 0.04), ty + uHeight*0.5, -trayD / 2 - 0.02);
                                    const end = new THREE.Vector3(side * (w / 2 - 0.05), ty + uHeight*0.5 + (c-2.5)*0.01, -trayD / 2 + 0.03);
                                    const ctrl = new THREE.Vector3(side * (w / 2 - 0.08), ty + uHeight*0.5, -trayD / 2 - 0.12);
                                    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
                                    const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.0025, 4, false), rubberBlack);
                                    frontCableGroup.add(cableMesh);
                                }
                            }
                        }
                    }
                }

                const addInstMesh = (geo, mat, arr, isTrayComponent = true) => {
                    if (arr.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, arr.length);
                    arr.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
                    mesh.instanceMatrix.needsUpdate = true;
                    mesh.userData = { originalMatrices: arr.map(m => m.clone()), isTrayComponent: isTrayComponent };
                    group.add(mesh);
                    this.explodeInstancedMeshes.push(mesh);
                };

                const box1 = new THREE.BoxGeometry(1, 1, 1);
                const cyl1 = new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2);
                const sphere1 = new THREE.SphereGeometry(1, 8, 8);

                addInstMesh(box1, darkMetal, instData.trayBody);
                addInstMesh(box1, champagneGold, instData.trayFaceplate); // 套用香檳金面板
                addInstMesh(box1, darkMetal, instData.trayBottom);
                addInstMesh(box1, darkMetal, instData.handle); // 門把手改黑化
                addInstMesh(box1, pcbGreen, instData.pcb);
                addInstMesh(box1, copperDetail, instData.gpuPlate);
                addInstMesh(box1, copperDetail, instData.cpuPlate);
                addInstMesh(box1, copperDetail, instData.switchPlate);
                addInstMesh(box1, chromeDetail, instData.plateCover); 
                addInstMesh(new THREE.CylinderGeometry(1, 1, 1, 8), chromeDetail, instData.fittings);
                addInstMesh(cyl1, this.materials.blueCollar, instData.hoseCollarBlue);
                addInstMesh(cyl1, this.materials.redCollar, instData.hoseCollarRed);
                addInstMesh(box1, darkMetal, instData.psuModule);
                addInstMesh(box1, darkMetal, instData.osfpPort); // 連接埠改深色，配合金面板
                addInstMesh(cyl1, chromeDetail, instData.qdcMale);
                addInstMesh(cyl1, darkMetal, instData.qdcFemale, false); 
                addInstMesh(sphere1, ledGreen, instData.statusLed);
                addInstMesh(box1, ledGreen, instData.ledStrip);
                addInstMesh(box1, blankingPanel, instData.blankPanel);
                addInstMesh(cyl1, copperTube, instData.coldTube);
                addInstMesh(cyl1, this.materials.blueHose, instData.coldTubeBlue); 
                addInstMesh(cyl1, this.materials.redHose, instData.coldTubeRed);   
                const grillMat = new THREE.MeshStandardMaterial({ color: 0x111111, wireframe: true });
                addInstMesh(box1, grillMat, instData.psuFanGrill);
                addInstMesh(box1, chromeDetail, instData.psuHandle);

                addInstMesh(box1, new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.2 }), instData.memModule); // Premium blue RAM modules
                addInstMesh(box1, chromeDetail, instData.vrm); // Silver aluminum heatsinks for VRM

                // ==========================================
                // 5. 盲插歧管 (Blind-Mate Manifold) + 避讓群組
                // ==========================================
                const spineH = totalU * uHeight;

                if (isComputeRack) {
                    const rackPipingGroup = new THREE.Group();
                    rackPipingGroup.userData = { 
                        isShell: true, 
                        origPos: new THREE.Vector3(0, 0, 0), 
                        explodeDir: new THREE.Vector3(0, 0, 0.8) // 往機櫃背後退開 0.8 米 (正Z方向)
                    };
                    this.explodeShells.push(rackPipingGroup);
                    group.add(rackPipingGroup);

                    // Rev E Phase E1（CLAUDE.md 第 5 條例外授權）：內建 spineSupply/spineReturn/
                    // insulS/insulR 四支 mesh 已移除——與 Rev D 外掛的 buildRackManifolds() 在同一
                    // 區域重疊形成雙重 manifold，使用者決定保留外掛 hose-kit 版本。spineH 仍供下方
                    // 法蘭/倒鉤/束帶/排水閥定位使用，未刪除。

                    for (let u = 0; u < totalU; u++) {
                        const isCompute = isComputeRack && (u >= 12 && u <= 46 && u % 2 === 0);
                        const isSwitch = isSwitchRack && (u % 2 === 0);
                        if (!isCompute && !isSwitch) continue;

                        const branchY = startY + u * uHeight + uHeight * 0.5;
                        const branchLength = 0.06;

                        const bSupply = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeBlueM);
                        bSupply.rotation.x = Math.PI / 2;
                        bSupply.position.set(-0.13, branchY, trayD / 2 + 0.04);
                        rackPipingGroup.add(bSupply);

                        const bReturn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeRedM);
                        bReturn.rotation.x = Math.PI / 2;
                        bReturn.position.set(0.13, branchY, trayD / 2 + 0.04);
                        rackPipingGroup.add(bReturn);
                    }

                    [-0.13, 0.13].forEach((fx, idx) => {
                        const fl = createFlange(0.04, 0.015, 4);
                        fl.position.set(fx, spineH / 2 + 0.01, trayD / 2 + 0.07);
                        rackPipingGroup.add(fl);
                        const barb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 12), chromeDetail);
                        barb.position.set(fx, spineH / 2 + 0.04, trayD / 2 + 0.07);
                        rackPipingGroup.add(barb);
                        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x3b82f6 : 0xef4444 }));
                        band.position.set(fx, spineH / 2 + 0.025, trayD / 2 + 0.07);
                        rackPipingGroup.add(band);
                    });

                    [-0.13, 0.13].forEach(fx => {
                        const drainValve = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }));
                        drainValve.position.set(fx, -spineH / 2 - 0.01, trayD / 2 + 0.07);
                        rackPipingGroup.add(drainValve);
                    });

                    const leakRope = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), leakSensor);
                    leakRope.rotation.z = Math.PI / 2;
                    leakRope.position.set(0, -h / 2 + 0.055, trayD / 2 + 0.07);
                    rackPipingGroup.add(leakRope);

                    const leakController = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), leakSensor);
                    leakController.position.set(0.2, -h / 2 + 0.08, trayD / 2 + 0.07);
                    rackPipingGroup.add(leakController);
                }

                // Switch Racks: 背部雙路垂直 PDU 供電插槽與連接線
                if (isSwitchRack) {
                    const rackPduGroup = new THREE.Group();
                    rackPduGroup.userData = { 
                        isShell: true, 
                        origPos: new THREE.Vector3(0, 0, 0), 
                        explodeDir: new THREE.Vector3(0, 0, 0.8) // 往機櫃背後退開 0.8 米
                    };
                    this.explodeShells.push(rackPduGroup);
                    group.add(rackPduGroup);

                    const pduH = totalU * uHeight;
                    const pduW = 0.05;
                    const pduD = 0.03;
                    const pduMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 }); // 黑色 PDU 外殼

                    [-0.2, 0.2].forEach((px) => {
                        const chassis = new THREE.Mesh(new THREE.BoxGeometry(pduW, pduH, pduD), pduMat);
                        chassis.position.set(px, 0, trayD / 2 + 0.06);
                        rackPduGroup.add(chassis);

                        const pduScreen = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.005), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 })); // HMI 電腦螢幕
                        pduScreen.position.set(px, pduH / 2 - 0.06, trayD / 2 + 0.076);
                        rackPduGroup.add(pduScreen);

                        const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e })); // 狀態綠燈
                        led.position.set(px - 0.01, pduH / 2 - 0.12, trayD / 2 + 0.076);
                        rackPduGroup.add(led);

                        for (let u = 2; u <= 44; u += 3) {
                            const oy = startY + u * uHeight;
                            const outlet = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.005), darkMetal); // 插座
                            outlet.position.set(px, oy, trayD / 2 + 0.076);
                            rackPduGroup.add(outlet);

                            const startPt = new THREE.Vector3(px, oy, trayD / 2 + 0.076);
                            const endPt = new THREE.Vector3(px * 0.8, oy, trayD / 2);
                            const curve = new THREE.CatmullRomCurve3([
                                startPt,
                                new THREE.Vector3(px, oy - 0.02, trayD / 2 + 0.04),
                                endPt
                            ]);
                            const tubeGeo = new THREE.TubeGeometry(curve, 4, 0.005, 6, false);
                            const cable = new THREE.Mesh(tubeGeo, rubberBlack);
                            rackPduGroup.add(cable);
                        }
                    });
                }

                // Power Rack 重點特色：背後重型銅排 Busbar
                if (isPowerRack) {
                    const busbarW = 0.015, busbarH = h - 0.1, busbarD = 0.03;
                    [-0.15, 0, 0.15].forEach(bx => {
                        const busbar = new THREE.Mesh(new THREE.BoxGeometry(busbarW, busbarH, busbarD), this.materials.copperDetail || copperTube);
                        busbar.position.set(bx, 0, trayD / 2 - 0.02);
                        group.add(busbar);
                    });
                }

                // Switch/Transmission Rack 重點特色：前端密集光纖繞線
                if (isSwitchRack) {
                    const fiberMatBlue = new THREE.LineBasicMaterial({ color: 0x0ea5e9 });
                    const fiberMatGreen = new THREE.LineBasicMaterial({ color: 0x22c55e });
                    
                    for (let u = 0; u <= 46; u += 2) {
                        const ty = startY + u * uHeight;
                        [-0.18, -0.06, 0.06, 0.18].forEach((fx, idx) => {
                            const start = new THREE.Vector3(fx, ty + uHeight * 0.5, -trayD/2 - 0.01);
                            const side = fx < 0 ? -1 : 1;
                            const end = new THREE.Vector3(side * (w/2 - 0.02), ty + uHeight * 0.5 - 0.04, -d/2 + 0.15 + idx * 0.05);
                            const control = new THREE.Vector3(fx + side * 0.05, ty + uHeight * 0.5, -trayD/2 - 0.08);
                            
                            const curve = new THREE.QuadraticBezierCurve3(start, control, end);
                            const points = curve.getPoints(8);
                            const fiberGeo = new THREE.BufferGeometry().setFromPoints(points);
                            const fiberLine = new THREE.Line(fiberGeo, idx % 2 === 0 ? fiberMatBlue : fiberMatGreen);
                            group.add(fiberLine);
                        });
                    }
                }

                const dripTray = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.015, d - 0.06), new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5, roughness: 0.6 }));
                dripTray.position.set(0, -h / 2 + 0.05, 0);
                group.add(dripTray);

                [
                    [0, 0, d / 2 - 0.04, w - 0.04, 0.02, 0.01],
                    [0, 0, -d / 2 + 0.04, w - 0.04, 0.02, 0.01],
                    [-w / 2 + 0.03, 0, 0, 0.01, 0.02, d - 0.06],
                    [w / 2 - 0.03, 0, 0, 0.01, 0.02, d - 0.06],
                ].forEach(r => {
                    const rim = new THREE.Mesh(new THREE.BoxGeometry(r[3], r[4], r[5]), new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5 }));
                    rim.position.set(r[0], -h / 2 + 0.06, r[2]);
                    group.add(rim);
                });

                // 把垂直走線槽也歸入背板避讓群組
                const cableParentGroup = isPowerRack ? group : (group.getObjectByName("rackPipingGroup") || group.children[group.children.length - 2] || group); // Safe fallback
                // Note: since we added rackPipingGroup only for non-power racks, let's use a specific group:
                const targetCableGroup = isPowerRack ? group : (group.children.find(c => c.userData && c.userData.explodeDir) || group);

                [-w / 2 + 0.03, w / 2 - 0.03].forEach(cx => {
                    const cableTrough = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.7, 0.04), darkMetal);
                    cableTrough.position.set(cx, 0.1, d / 2 - 0.06);
                    targetCableGroup.add(cableTrough);
                    for (let ring = 0; ring < 6; ring++) {
                        const cableRing = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 6, 12), darkMetal);
                        cableRing.rotation.y = Math.PI / 2;
                        cableRing.position.set(cx, -0.3 + ring * 0.15, d / 2 - 0.06);
                        targetCableGroup.add(cableRing);
                    }
                });

                const fiberTray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.15), darkMetal);
                fiberTray.position.set(0, h / 2 - 0.05, d / 2 - 0.2);
                group.add(fiberTray);

                [
                    { pos: [0, h / 2 - 0.1, d / 2 - 0.05], label: 'INLET_TEMP' },
                    { pos: [0, h / 2 - 0.1, -d / 2 + 0.05], label: 'OUTLET_TEMP' },
                ].forEach(sp => {
                    const tSensor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6 }));
                    tSensor.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
                    group.add(tSensor);
                    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.15, 4), new THREE.MeshBasicMaterial({ color: 0x64748b }));
                    wire.position.set(sp.pos[0] + 0.02, sp.pos[1] - 0.05, sp.pos[2]);
                    group.add(wire);
                });

                for (let u = 0; u < totalU; u += 6) {
                    const labelY = startY + u * uHeight;
                    const uLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.008), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                    uLabel.position.set(-w / 2 + 0.065, labelY, d / 2 - 0.04);
                    group.add(uLabel);
                }

                const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.04), new THREE.MeshBasicMaterial({ color: 0x76b900 }));
                logo.position.set(0, h / 2 - 0.03, d / 2 + 0.015);
                group.add(logo);

                const assetTag = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                assetTag.position.set(w / 2 + 0.008, 0.6, 0);
                assetTag.rotation.y = Math.PI / 2;
                group.add(assetTag);

                const warnLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
                warnLabel.position.set(w / 2 + 0.008, 0.3, 0.2);
                warnLabel.rotation.y = Math.PI / 2;
                group.add(warnLabel);

                // ==========================================
                // CFD Cold Plate Visualization (Compute Racks only, hidden by default)
                // ==========================================
                if (isComputeRack) {
                    const cpCfdGroup = new THREE.Group();
                    cpCfdGroup.visible = false;
                    cpCfdGroup.userData.isColdPlateCfdGroup = true;
                    const boxGeo1 = new THREE.BoxGeometry(1, 1, 1);
                    const cylGeo1 = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2);
                    const dummy2 = new THREE.Object3D();
                    const gpuCpMats2 = [], gpuHeatMats2 = [], cpuCpMats2 = [], cpuHeatMats2 = [];
                    const flowMatS2 = [], flowMatR2 = [];
                    for (let u2 = 12; u2 <= 46; u2 += 2) {
                        const ty2 = startY + u2 * uHeight + uHeight * 0.5;
                        [-0.1, 0.1].forEach(gx => {
                            [-0.15, -0.02].forEach(gz => {
                                // GPU Cold Plate
                                dummy2.position.set(gx, ty2 + 0.010, gz);
                                dummy2.scale.set(0.091, 0.013, 0.091);
                                dummy2.rotation.set(0,0,0); dummy2.updateMatrix();
                                gpuCpMats2.push(dummy2.matrix.clone());
                                // GPU Chip (Larger than Cold Plate horizontally to be prominent)
                                dummy2.position.set(gx, ty2 - 0.005, gz);
                                dummy2.scale.set(0.096, 0.012, 0.096);
                                dummy2.updateMatrix(); gpuHeatMats2.push(dummy2.matrix.clone());
                            });
                        });
                        [-0.1, 0.1].forEach(cx => {
                            // CPU Cold Plate
                            dummy2.position.set(cx, ty2 + 0.010, 0.18);
                            dummy2.scale.set(0.076, 0.013, 0.076);
                            dummy2.rotation.set(0,0,0); dummy2.updateMatrix();
                            cpuCpMats2.push(dummy2.matrix.clone());
                            // CPU Chip (Larger than Cold Plate horizontally to be prominent)
                            dummy2.position.set(cx, ty2 - 0.005, 0.18);
                            dummy2.scale.set(0.081, 0.012, 0.081);
                            dummy2.updateMatrix(); cpuHeatMats2.push(dummy2.matrix.clone());
                        });
                        // supply / return internal flow tube segments
                        dummy2.position.set(-0.1, ty2, 0.015); dummy2.scale.set(0.005, 0.005, 0.38);
                        dummy2.rotation.set(0,0,0); dummy2.updateMatrix(); flowMatS2.push(dummy2.matrix.clone());
                        dummy2.position.set(0.1, ty2, 0.015); dummy2.scale.set(0.005, 0.005, 0.38);
                        dummy2.updateMatrix(); flowMatR2.push(dummy2.matrix.clone());
                    }
                    const gpuCpM  = new THREE.MeshStandardMaterial({ color: 0x00bfff, emissive: 0x0055bb, emissiveIntensity: 2.0, transparent: true, opacity: 0.88, metalness: 0.9, roughness: 0.05 });
                    const cpuCpM  = new THREE.MeshStandardMaterial({ color: 0x00ffee, emissive: 0x009988, emissiveIntensity: 1.8, transparent: true, opacity: 0.85, metalness: 0.9, roughness: 0.05 });
                    // High-intensity emissive red-hot material for chips
                    const chipHM  = new THREE.MeshStandardMaterial({ color: 0xff3b00, emissive: 0xff1100, emissiveIntensity: 5.0, transparent: true, opacity: 0.95 });
                    const flowSM  = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x003366, emissiveIntensity: 1.2, transparent: true, opacity: 0.60, metalness: 0.7 });
                    const flowRM  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xcc2200, emissiveIntensity: 1.0, transparent: true, opacity: 0.60, metalness: 0.7 });
                    const mkIM = (geo, mat, mats) => { if (!mats.length) return; const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m,i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; cpCfdGroup.add(im); };
                    mkIM(boxGeo1, gpuCpM,  gpuCpMats2);
                    mkIM(boxGeo1, chipHM,  gpuHeatMats2);
                    mkIM(boxGeo1, cpuCpM,  cpuCpMats2);
                    mkIM(boxGeo1, chipHM.clone(), cpuHeatMats2);
                    mkIM(cylGeo1, flowSM, flowMatS2);
                    mkIM(cylGeo1, flowRM, flowMatR2);
                    group.add(cpCfdGroup);
                    this.coldPlateCfdGroups.push(cpCfdGroup);
                }

                const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
                hitBox.userData = group.userData;
                group.add(hitBox);
                this.interactables.push(hitBox);

                this.scene.add(group);
            },

            buildPiping() {
                this.pipeGroup = new THREE.Group();
                const rMain = 0.06, rBranch = 0.03;
                const headerY = 2.5; 
                const cduPipeY = 2.8;

                const drawStraightPipe = (start, end, radius, material) => {
                    const s = new THREE.Vector3(...start);
                    const e = new THREE.Vector3(...end);
                    const mid = s.clone().add(e).multiplyScalar(0.5);
                    const len = s.distanceTo(e);
                    const pipe = new THREE.Mesh(
                        new THREE.CylinderGeometry(radius, radius, len, 12),
                        material
                    );
                    pipe.position.copy(mid);
                    pipe.lookAt(e);
                    pipe.rotateX(Math.PI / 2);
                    this.pipeGroup.add(pipe);
                };

                const addElbow = (x, y, z, material) => {
                    const elbow = new THREE.Mesh(
                        new THREE.SphereGeometry(rMain * 1.1, 12, 12),
                        material
                    );
                    elbow.position.set(x, y, z);
                    this.pipeGroup.add(elbow);
                };

                const addElbowSmall = (x, y, z, material) => {
                    const elbow = new THREE.Mesh(
                        new THREE.SphereGeometry(rBranch * 1.1, 10, 10),
                        material
                    );
                    elbow.position.set(x, y, z);
                    this.pipeGroup.add(elbow);
                };

                const addButterfly = (x, y, z) => {
                    const disc = new THREE.Mesh(new THREE.TorusGeometry(rBranch * 1.2, 0.008, 8, 16), this.materials.brass);
                    disc.position.set(x, y, z);
                    this.pipeGroup.add(disc);
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.01), this.materials.brass);
                    handle.position.set(x, y + 0.04, z);
                    this.pipeGroup.add(handle);
                };

                const zA = -0.3; 
                const zB = 0.3;  
                const zAr = -0.1;
                const zBr = 0.1;
                const blueM = this.materials.pipeBlueM;  
                const redM = this.materials.pipeRedM;

                // --- CDU 側總幹管 (順序為 TCS Supply => FWS Return => FWS Supply => TCS Return) ---
                const xBlueM = -4.8;  // TCS Supply (Blue)
                const xFwsR = -4.6;   // FWS Return (Dark Green)
                const xFwsS = -4.4;   // FWS Supply (Green)
                const xRedM = -4.2;   // TCS Return (Red)

                const addCollar = (x, y, z) => {
                    const collar = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24),
                        this.materials.rackFrame // Dark metal collar base
                    );
                    collar.position.set(x, y + 0.01, z);
                    this.pipeGroup.add(collar);
                };

                // --- 一次側 (Facility Loop) 已移除 (FWS 綠色管路取消) ---
                // (Primary FWS green pipes above CDU removed per design update)

                // --- 二次側 (TCS Loop) CDU 接頭與垂直管 ---
                // CDU A (Z = 1.5)
                addCollar(xBlueM, 2.2, 1.5);
                drawStraightPipe([xBlueM, 2.2, 1.5], [xBlueM, cduPipeY, 1.5], rMain, blueM);
                addElbow(xBlueM, cduPipeY, 1.5, blueM);

                addCollar(xRedM, 2.2, 1.5);
                drawStraightPipe([xRedM, 2.2, 1.5], [xRedM, cduPipeY, 1.5], rMain, redM);
                addElbow(xRedM, cduPipeY, 1.5, redM);

                // CDU B (Z = -1.5)
                addCollar(xBlueM, 2.2, -1.5);
                drawStraightPipe([xBlueM, 2.2, -1.5], [xBlueM, cduPipeY, -1.5], rMain, blueM);
                addElbow(xBlueM, cduPipeY, -1.5, blueM);

                addCollar(xRedM, 2.2, -1.5);
                drawStraightPipe([xRedM, 2.2, -1.5], [xRedM, cduPipeY, -1.5], rMain, redM);
                addElbow(xRedM, cduPipeY, -1.5, redM);

                // 二次側天花板總幹管 (CDU B Z=-1.5 to CDU A Z=1.5)
                drawStraightPipe([xBlueM, cduPipeY, -1.5], [xBlueM, cduPipeY, 1.5], rMain, blueM);
                drawStraightPipe([xRedM, cduPipeY, 1.5], [xRedM, cduPipeY, -1.5], rMain, redM);

                // --- 走到各排機櫃的水平幹管 (過渡垂直管避免衝突) ---
                // Aisle A Headers
                addElbow(xBlueM, cduPipeY, zA, blueM);
                drawStraightPipe([xBlueM, headerY, zA], [xBlueM, cduPipeY, zA], rMain, blueM);
                addElbow(xBlueM, headerY, zA, blueM);
                drawStraightPipe([xBlueM, headerY, zA], [3.7, headerY, zA], rMain, blueM); // Extended to 3.7

                addElbow(xRedM, cduPipeY, zAr, redM);
                drawStraightPipe([xRedM, headerY, zAr], [xRedM, cduPipeY, zAr], rMain, redM);
                addElbow(xRedM, headerY, zAr, redM);
                drawStraightPipe([3.7, headerY, zAr], [xRedM, headerY, zAr], rMain, redM); // REVERSED FLOW & Extended
                
                // Aisle B Headers
                addElbow(xBlueM, cduPipeY, zB, blueM);
                drawStraightPipe([xBlueM, headerY, zB], [xBlueM, cduPipeY, zB], rMain, blueM);
                addElbow(xBlueM, headerY, zB, blueM);
                drawStraightPipe([xBlueM, headerY, zB], [3.7, headerY, zB], rMain, blueM); // Extended to 3.7

                addElbow(xRedM, cduPipeY, zBr, redM);
                drawStraightPipe([xRedM, headerY, zBr], [xRedM, cduPipeY, zBr], rMain, redM);
                addElbow(xRedM, headerY, zBr, redM);
                drawStraightPipe([3.7, headerY, zBr], [xRedM, headerY, zBr], rMain, redM); // REVERSED FLOW & Extended

                // --- 下接至機櫃的分支管 ---
                const yDrop = 2.18;       // 剛好接到機櫃 Spine Manifold 頂部接頭 (配合 2.2m 機櫃)
                const yTransition = 2.35; // 水平分支管的高度 (從 2.45 降為 2.35)
                const zDropA = -0.655;    // A排機櫃後方 Manifold 的世界 Z 座標 (Z = -1.2 + 0.545 = -0.655)
                const zDropB = 0.655;     // B排機櫃後方 Manifold 的世界 Z 座標 (Z = 1.2 - 0.545 = 0.655)

                const xs = [-3.41, -2.79, -2.17, -1.55, -0.93, -0.31, 0.31, 0.93, 1.55, 2.17, 2.79, 3.41];
                xs.forEach((x, colIdx) => {
                    if (colIdx < 3 || colIdx > 8) return; // Only Compute Racks (indices 3-8) have water cooling lines
                    // Rack A (z = -1.2, rot = 0)
                    // Spine local: Blue -0.13, Red +0.13
                    const bXa = x - 0.13;
                    const rXa = x + 0.13;

                    // Blue Branch A (Drop to Aisle A, then run to Rack)
                    addElbowSmall(bXa, headerY, zA, blueM);
                    drawStraightPipe([bXa, headerY, zA], [bXa, yTransition, zA], rBranch, blueM);     
                    addElbowSmall(bXa, yTransition, zA, blueM);
                    drawStraightPipe([bXa, yTransition, zA], [bXa, yTransition, zDropA], rBranch, blueM);     
                    addElbowSmall(bXa, yTransition, zDropA, blueM);
                    drawStraightPipe([bXa, yTransition, zDropA], [bXa, yDrop, zDropA], rBranch, blueM);   

                    // Red Branch A (REVERSED FLOW)
                    addElbowSmall(rXa, headerY, zAr, redM);
                    drawStraightPipe([rXa, yTransition, zAr], [rXa, headerY, zAr], rBranch, redM);
                    addElbowSmall(rXa, yTransition, zAr, redM);
                    drawStraightPipe([rXa, yTransition, zDropA], [rXa, yTransition, zAr], rBranch, redM);
                    addElbowSmall(rXa, yTransition, zDropA, redM);
                    drawStraightPipe([rXa, yDrop, zDropA], [rXa, yTransition, zDropA], rBranch, redM);

                    addButterfly(bXa, 2.3, zDropA);
                    addButterfly(rXa, 2.3, zDropA);

                    const flGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16);
                    const flMat = this.materials.chromeDetail || this.materials.aluminum;
                    const fBlueA = new THREE.Mesh(flGeo, flMat);
                    fBlueA.position.set(bXa, yDrop + 0.01, zDropA);
                    this.pipeGroup.add(fBlueA);
                    const fRedA = new THREE.Mesh(flGeo, flMat);
                    fRedA.position.set(rXa, yDrop + 0.01, zDropA);
                    this.pipeGroup.add(fRedA);

                    // Rack B (z = 1.2, rot = Math.PI)
                    // Spine local: Blue -0.13, Red +0.13 -> World (with rot): Blue +0.13, Red -0.13
                    const bXb = x + 0.13;
                    const rXb = x - 0.13;

                    // Blue Branch B
                    addElbowSmall(bXb, headerY, zB, blueM);
                    drawStraightPipe([bXb, headerY, zB], [bXb, yTransition, zB], rBranch, blueM);
                    addElbowSmall(bXb, yTransition, zB, blueM);
                    drawStraightPipe([bXb, yTransition, zB], [bXb, yTransition, zDropB], rBranch, blueM);
                    addElbowSmall(bXb, yTransition, zDropB, blueM);
                    drawStraightPipe([bXb, yTransition, zDropB], [bXb, yDrop, zDropB], rBranch, blueM);

                    // Red Branch B (REVERSED FLOW)
                    addElbowSmall(rXb, headerY, zBr, redM);
                    drawStraightPipe([rXb, yTransition, zBr], [rXb, headerY, zBr], rBranch, redM);
                    addElbowSmall(rXb, yTransition, zBr, redM);
                    drawStraightPipe([rXb, yTransition, zDropB], [rXb, yTransition, zBr], rBranch, redM);
                    addElbowSmall(rXb, yTransition, zDropB, redM);
                    drawStraightPipe([rXb, yDrop, zDropB], [rXb, yTransition, zDropB], rBranch, redM);

                    addButterfly(bXb, 2.3, zDropB);
                    addButterfly(rXb, 2.3, zDropB);

                    const fBlueB = new THREE.Mesh(flGeo, flMat);
                    fBlueB.position.set(bXb, yDrop + 0.01, zDropB);
                    this.pipeGroup.add(fBlueB);
                    const fRedB = new THREE.Mesh(flGeo, flMat);
                    fRedB.position.set(rXb, yDrop + 0.01, zDropB);
                    this.pipeGroup.add(fRedB);
                });

                // --- 支撐吊架 (Support Brackets) ---
                // A 與 B 排通道上方橫向管的支撐 (配合 Z 座標移動與 headerY 調整)
                for(let x = -3.6; x <= 3.6; x += 0.8) {
                    const sA = new THREE.Group();
                    const rodA = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.57), this.materials.aluminum);
                    rodA.position.y = 3.215; sA.add(rodA);
                    const armA = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.4), this.materials.aluminum);
                    armA.position.y = headerY - 0.07; 
                    sA.add(armA);
                    sA.position.set(x, 0, -0.2); // Centered at Aisle A pipes (Z = -0.3 & Z = -0.1)
                    this.pipeGroup.add(sA);

                    const sB = new THREE.Group();
                    const rodB = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.57), this.materials.aluminum);
                    rodB.position.y = 3.215; sB.add(rodB);
                    const armB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.4), this.materials.aluminum);
                    armB.position.y = headerY - 0.07;
                    sB.add(armB);
                    sB.position.set(x, 0, 0.2); // Centered at Aisle B pipes (Z = 0.3 & Z = 0.1)
                    this.pipeGroup.add(sB);
                }

                // CDU 側縱向主幹管的支撐
                for(let z = -1.0; z <= 1.0; z += 1.0) {
                    const sM = new THREE.Group();
                    const rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.27), this.materials.aluminum);
                    rodM.position.y = 3.365; sM.add(rodM);
                    const armM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.04), this.materials.aluminum);
                    armM.position.y = cduPipeY - 0.07;
                    sM.add(armM);
                    sM.position.set(-4.5, 0, z); // Aligned with CDU X = -4.5
                    this.pipeGroup.add(sM);
                }

                this.scene.add(this.pipeGroup);
            },

            // ============================================================================
            // Vera Rubin NVL72 — TCS 耐震分歧管系統（Phase 2）
            // 幾何全部掛在 this.layers.tcs，取代舊 buildPiping()。
            // 所有座標一律取自 this.VR_LAYOUT，不硬編碼。
            // ============================================================================
            buildTCS() {
                const T = this.VR_LAYOUT.tcs;
                const R = this.VR_LAYOUT.rack;
                const RISER = this.VR_LAYOUT.riser;
                const CDU = this.VR_LAYOUT.cdu;
                const ROOM = this.VR_LAYOUT.room;
                const tcsGroup = this.layers.tcs;
                const xMin = -3.9, xMax = 3.9;

                if (!this.materials.steelFrame) {
                    this.materials.steelFrame = new THREE.MeshStandardMaterial({ color: 0xcbd3da, metalness: 0.7, roughness: 0.35 }); // 亮鍍鋅灰
                    this.materials.qdcBody = new THREE.MeshStandardMaterial({ color: 0xd8dee4, metalness: 0.85, roughness: 0.2 }); // 不鏽鋼快接頭
                    this.materials.qdcRing = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.5 }); // 滾花環
                }

                const blueM = this.materials.pipeBlueM;
                const redM = this.materials.pipeRedM;

                // ---- 小工具函式（僅供 buildTCS 內使用，不修改 createCDU / buildPiping）----
                const drawPipeSeg = (parent, start, end, radius, material) => {
                    const s = new THREE.Vector3(...start);
                    const e = new THREE.Vector3(...end);
                    const mid = s.clone().add(e).multiplyScalar(0.5);
                    const len = s.distanceTo(e);
                    if (len < 1e-6) return;
                    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), material);
                    pipe.position.copy(mid);
                    pipe.lookAt(e);
                    pipe.rotateX(Math.PI / 2);
                    parent.add(pipe);
                };

                const addJointSphere = (parent, x, y, z, radius, material) => {
                    const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.15, 10, 10), material);
                    joint.position.set(x, y, z);
                    parent.add(joint);
                };

                // axis: 'y'（預設，罩住垂直管，扁面朝上）或 'x'（罩住沿 x 走向的水平管，扁面朝 x 軸）
                const createFlange = (parent, x, y, z, radius, material, axis = 'y') => {
                    const flange = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, 0.02, 16), material);
                    if (axis === 'x') flange.rotation.z = Math.PI / 2;
                    flange.position.set(x, y, z);
                    parent.add(flange);
                };

                const addInstMesh = (parent, geo, mat, matrices) => {
                    if (matrices.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    parent.add(mesh);
                };

                // 局部工具：X 軸旋轉的 instance matrix（水平走向的圓柱需要，pushInstMatrix 只支援繞 Y）
                const pushRotXMatrix = (array, x, y, z, rotX) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(x, y, z);
                    dummy.rotation.x = rotX;
                    dummy.updateMatrix();
                    array.push(dummy.matrix.clone());
                };

                // ================= A. 耐震門架（Rev B：遷入熱通道帶，立柱 z=±postZ）=================
                const frameGroup = new THREE.Group();
                const anchorBoltMatrices = [];
                T.postXs.forEach(x => {
                    [-T.postZ, T.postZ].forEach(z => {
                        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, T.frameTopY, 0.08), this.materials.steelFrame);
                        post.position.set(x, T.frameTopY / 2, z);
                        frameGroup.add(post);

                        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), this.materials.steelFrame);
                        basePlate.position.set(x, 0.01, z);
                        frameGroup.add(basePlate);

                        [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]].forEach(([dx, dz]) => {
                            this.pushInstMatrix(anchorBoltMatrices, x + dx, 0.03, z + dz);
                        });
                    });

                    // 橫梁跨 z=-postZ ~ +postZ（僅跨熱通道，不再跨到機櫃上方）
                    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, T.postZ * 2), this.materials.steelFrame);
                    beam.position.set(x, T.frameTopY - 0.05, 0);
                    frameGroup.add(beam);
                });
                addInstMesh(frameGroup, new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), this.materials.steelFrame, anchorBoltMatrices);

                // 縱向繫梁：z=±0.40，x 跨 ±headerXHalf，架在門架橫梁頂上
                [-0.40, 0.40].forEach(z => {
                    const tie = new THREE.Mesh(new THREE.BoxGeometry(T.headerXHalf * 2, 0.06, 0.06), this.materials.steelFrame);
                    tie.position.set(0, T.frameTopY + 0.03, z);
                    frameGroup.add(tie);
                });
                tcsGroup.add(frameGroup);

                // ================= B. TCS 主管（Rev B：headers，全部在熱通道內，x=±headerXHalf）=================
                // 使用者目視回報：熱通道主管紅色箭頭要跟藍色相反（供水/回水對向流動）。
                // drawPipeSeg 的 chevron 方向跟隨 (start→end)，紅管（回水）反過來畫。
                const headerGroup = new THREE.Group();
                const headers = [
                    { z: T.supplyZ.A, mat: blueM, reverse: false },
                    { z: T.returnZ.A, mat: redM, reverse: true },
                    { z: T.supplyZ.B, mat: blueM, reverse: false },
                    { z: T.returnZ.B, mat: redM, reverse: true },
                ];
                headers.forEach(hdr => {
                    const a = [-T.headerXHalf, T.headerY, hdr.z], b = [T.headerXHalf, T.headerY, hdr.z];
                    if (hdr.reverse) {
                        drawPipeSeg(headerGroup, b, a, T.headerR, hdr.mat);
                    } else {
                        drawPipeSeg(headerGroup, a, b, T.headerR, hdr.mat);
                    }
                });

                // 管夾：每條主管在每個門架位置固定於橫梁上
                const clampMatrices = [];
                T.postXs.forEach(x => {
                    headers.forEach(hdr => {
                        this.pushInstMatrix(clampMatrices, x, T.headerY, hdr.z, Math.PI / 2);
                    });
                });
                addInstMesh(headerGroup, new THREE.TorusGeometry(T.headerR * 1.3, 0.008, 6, 12), this.materials.steelFrame, clampMatrices);

                // 主管兩端封頭（半球，Rev D 新增）
                const capMatricesPos = [], capMatricesNeg = [];
                headers.forEach(hdr => {
                    this.pushInstMatrix(capMatricesPos, T.headerXHalf, T.headerY, hdr.z);
                    this.pushInstMatrix(capMatricesNeg, -T.headerXHalf, T.headerY, hdr.z);
                });
                {
                    const capGeo = new THREE.SphereGeometry(T.headerR * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
                    const capGeoPos = capGeo.clone().rotateZ(-Math.PI / 2); // 圓頂朝 +X
                    const capGeoNeg = capGeo.clone().rotateZ(Math.PI / 2);  // 圓頂朝 -X
                    addInstMesh(headerGroup, capGeoPos, this.materials.steelFrame, capMatricesPos);
                    addInstMesh(headerGroup, capGeoNeg, this.materials.steelFrame, capMatricesNeg);
                }
                tcsGroup.add(headerGroup);

                // ================= C. 每 GPU 櫃分支垂降 + Hose Kit（Rev D：主管在上、球閥短垂降、
                // 黑色軟管自然下垂弧接機櫃背面 manifold；僅中間 6 個 GPU 櫃 × 2 列 × 2 條 = 24 條）=================
                // 路徑：主管 → 三通/球閥（垂降 0.20 至 y≈3.00，沿用既有 IM 元件）→ 短接管 →
                // Hose Kit（CatmullRom 下垂弧，黑色軟管材質）→ manifold 頂。
                // Rev B 遺留的硬管水平段／90°彎頭／QDC 快接頭整套（含 connectY 邏輯）已完全移除，
                // 改由 Hose Kit 銜接 buildRackManifolds() 建立的機櫃背面 manifold。
                const dropGroup = new THREE.Group();
                const M = this.VR_LAYOUT.manifold;

                if (!this.materials.tcsHose) {
                    this.materials.tcsHose = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
                }

                const teeMatrices = [], valveBodyMatrices = [], handleMatrices = [],
                      pipeBlueVertMatrices = [], pipeRedVertMatrices = [], collarMatrices = [];

                const teeH = 0.04, valveH = 0.05;
                const y0 = T.headerY;              // header 中心 3.20
                const y1 = y0 - teeH;               // 三通底 = 球閥頂
                const y2 = y1 - valveH;             // 球閥底
                const hoseStartY = y0 - 0.20;       // 球閥短垂降 0.20（規格值：三通+球閥+短接管全部算入），至 y≈3.00
                const teeY = (y0 + y1) / 2;
                const valveY = (y1 + y2) / 2;
                const handleY = y1 + 0.015;         // 手柄朝上，貼近球閥頂
                const connLen = y2 - hoseStartY;    // 球閥底到 Hose Kit 起點的短接管
                const connMidY = (y2 + hoseStartY) / 2;

                const hoseMidY = 2.55;              // Hose Kit 控制點高度（規格值，製造下垂弧）
                const hoseCtrlDz = 0.12;            // 控制點 z 向牆推出量（規格值）
                const manifoldTopY = M.yTop;        // 2.05

                const rows = [
                    { sign: -1, supplyZ: T.supplyZ.A, returnZ: T.returnZ.A },  // Row A，牆面方向 z 為負
                    { sign: 1,  supplyZ: T.supplyZ.B, returnZ: T.returnZ.B },  // Row B，牆面方向 z 為正
                ];

                // 效能規則：同列同功能 6 條 Hose Kit 曲線形狀相同、僅 x 平移 → 全場只建 4 個
                // TubeGeometry（A供/A回/B供/B回），本地座標 x=0，實際世界位置靠 InstancedMesh 平移。
                const buildHoseGeo = (headerZ, wallDir) => {
                    const curve = new THREE.CatmullRomCurve3([
                        new THREE.Vector3(0, hoseStartY, headerZ),
                        new THREE.Vector3(0, hoseMidY, headerZ + wallDir * hoseCtrlDz),
                        new THREE.Vector3(0, manifoldTopY, wallDir * M.z),
                    ]);
                    return new THREE.TubeGeometry(curve, 12, 0.020, 8, false);
                };
                const hoseGeoASupply = buildHoseGeo(T.supplyZ.A, -1);
                const hoseGeoAReturn = buildHoseGeo(T.returnZ.A, -1);
                const hoseGeoBSupply = buildHoseGeo(T.supplyZ.B, 1);
                const hoseGeoBReturn = buildHoseGeo(T.returnZ.B, 1);
                const hoseMatASupply = [], hoseMatAReturn = [], hoseMatBSupply = [], hoseMatBReturn = [];

                rows.forEach(row => {
                    R.gpuIndices.forEach(idx => {
                        const rackX = R.xs[idx];
                        [
                            { type: 'supply', headerZ: row.supplyZ, blue: true,
                              hoseArr: row.sign < 0 ? hoseMatASupply : hoseMatBSupply },
                            { type: 'return', headerZ: row.returnZ, blue: false,
                              hoseArr: row.sign < 0 ? hoseMatAReturn : hoseMatBReturn },
                        ].forEach(drop => {
                            const x = rackX + (drop.type === 'supply' ? -M.xOffset : M.xOffset);
                            const manifoldZ = row.sign * M.z;

                            // 三通 + 球閥 + 手柄（沿用既有 IM 元件，主管正下方）
                            this.pushInstMatrix(teeMatrices, x, teeY, drop.headerZ);
                            this.pushInstMatrix(valveBodyMatrices, x, valveY, drop.headerZ);
                            this.pushInstMatrix(handleMatrices, x, handleY, drop.headerZ);
                            // 球閥底到 Hose Kit 起點（y≈3.00）的短接管
                            this.pushInstMatrix(drop.blue ? pipeBlueVertMatrices : pipeRedVertMatrices, x, connMidY, drop.headerZ);

                            // Hose Kit：純 x 平移矩陣
                            this.pushInstMatrix(drop.hoseArr, x, 0, 0);

                            // 軟管兩端不鏽鋼接頭環（球閥端 + manifold 端）
                            pushRotXMatrix(collarMatrices, x, hoseStartY, drop.headerZ, Math.PI / 2);
                            pushRotXMatrix(collarMatrices, x, manifoldTopY, manifoldZ, Math.PI / 2);
                        });
                    });
                });

                addInstMesh(dropGroup, new THREE.BoxGeometry(0.05, teeH, 0.05), this.materials.aluminum, teeMatrices);
                addInstMesh(dropGroup, new THREE.CylinderGeometry(0.03, 0.03, valveH, 10), this.materials.aluminum, valveBodyMatrices);
                addInstMesh(dropGroup, new THREE.BoxGeometry(0.07, 0.012, 0.018), this.materials.brass, handleMatrices);
                addInstMesh(dropGroup, new THREE.CylinderGeometry(T.branchR, T.branchR, connLen, 10), blueM, pipeBlueVertMatrices);
                addInstMesh(dropGroup, new THREE.CylinderGeometry(T.branchR, T.branchR, connLen, 10), redM, pipeRedVertMatrices);
                addInstMesh(dropGroup, hoseGeoASupply, this.materials.tcsHose, hoseMatASupply);
                addInstMesh(dropGroup, hoseGeoAReturn, this.materials.tcsHose, hoseMatAReturn);
                addInstMesh(dropGroup, hoseGeoBSupply, this.materials.tcsHose, hoseMatBSupply);
                addInstMesh(dropGroup, hoseGeoBReturn, this.materials.tcsHose, hoseMatBReturn);
                addInstMesh(dropGroup, new THREE.TorusGeometry(0.026, 0.008, 8, 16), this.materials.qdcRing, collarMatrices);
                tcsGroup.add(dropGroup);

                // ================= D. CDU ↔ TCS 連接（Rev B：四條管出口錯開、不共點不交叉）=================
                // CDU-A（z=0.9）接 Row B 主管（z=+0.15/+0.35）；CDU-B（z=-0.9）接 Row A 主管（z=-0.15/-0.35）。
                // supply 走 x=-4.75、return 走 x=-5.25，各自獨立車道直上直走，段落座標已人工核對無交叉。
                const cduConnGroup = new THREE.Group();
                const cduTopY = CDU.h;
                const cduOutletX = { supply: CDU.x + 0.25, return: CDU.x - 0.25 }; // -4.75 / -5.25
                const wallPlateX = -this.VR_LAYOUT.containment.halfW; // 端牆穿越點 x=-3.73
                const wallPlateMatrices = [], headerFlangeMatrices = [];
                const cduConns = [
                    { cduZ: CDU.zA, targetSupplyZ: T.supplyZ.B, targetReturnZ: T.returnZ.B },
                    { cduZ: CDU.zB, targetSupplyZ: T.supplyZ.A, targetReturnZ: T.returnZ.A },
                ];
                // Rev D：CDU 頂面四點錯開（供 z=cduZ-0.20、回 z=cduZ+0.20），仍完全從頂面出管，
                // 路徑拓撲不變（垂直上升→z 對位→x 穿端牆→接主管端部），已核對四條管無交叉。
                cduConns.forEach(conn => {
                    [
                        { type: 'supply', targetZ: conn.targetSupplyZ, mat: blueM, dz: -0.20 },
                        { type: 'return', targetZ: conn.targetReturnZ, mat: redM, dz: 0.20 },
                    ].forEach(pipe => {
                        const outX = cduOutletX[pipe.type];
                        const outletZ = conn.cduZ + pipe.dz;
                        // 1. 出口（CDU 頂面）垂直上升到 headerY
                        drawPipeSeg(cduConnGroup, [outX, cduTopY, outletZ], [outX, T.headerY, outletZ], T.headerR, pipe.mat);
                        addJointSphere(cduConnGroup, outX, T.headerY, outletZ, T.headerR, pipe.mat);
                        // 2. 沿 z 移動到目標主管的 z（仍在 headerY 高度、CDU 正上方，不碰機櫃/端牆）
                        drawPipeSeg(cduConnGroup, [outX, T.headerY, outletZ], [outX, T.headerY, pipe.targetZ], T.headerR, pipe.mat);
                        addJointSphere(cduConnGroup, outX, T.headerY, pipe.targetZ, T.headerR, pipe.mat);
                        // 3. 沿 x 進入端牆、接主管端部（端牆穿越點加封板，端部加法蘭，兩者皆 InstancedMesh）
                        drawPipeSeg(cduConnGroup, [outX, T.headerY, pipe.targetZ], [-T.headerXHalf, T.headerY, pipe.targetZ], T.headerR, pipe.mat);
                        this.pushInstMatrix(wallPlateMatrices, wallPlateX, T.headerY, pipe.targetZ);
                        this.pushInstMatrix(headerFlangeMatrices, -T.headerXHalf, T.headerY, pipe.targetZ);
                    });
                });
                addInstMesh(cduConnGroup, new THREE.BoxGeometry(0.02, 0.20, 0.20), this.materials.hotAisleDark || this.materials.steelFrame, wallPlateMatrices);
                {
                    const flangeGeo = new THREE.CylinderGeometry(T.headerR * 1.35, T.headerR * 1.35, 0.02, 16);
                    flangeGeo.rotateZ(Math.PI / 2); // 扁面朝 x 軸，罩住沿 x 走向的水平管
                    addInstMesh(cduConnGroup, flangeGeo, this.materials.steelFrame, headerFlangeMatrices);
                }
                tcsGroup.add(cduConnGroup);

                // ================= E. 廠務水立管（Rev D：CDU 頂部出管、垂直拔高至 elbowY、
                // 90° 彎頭後水平甩出艙外——與 D2 的二次側管一樣全部從頂面出，側面零接管）=================
                // 材質沿用主管材質 this.materials.pipeBlueM/pipeRedM（與 Section B/D 完全相同的快取材質，
                // 純色 + 既有 flow chevron 貼圖，並非 cosmetic pass 引入的 createCDU() 局部材質——
                // 確認零共用/零污染，見本 Phase 回報）。
                const riserGroup = new THREE.Group();
                const riserR = RISER.pipeR; // 0.075

                const pushRotZMatrix = (array, x, y, z, rotZ) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(x, y, z);
                    dummy.rotation.z = rotZ;
                    dummy.updateMatrix();
                    array.push(dummy.matrix.clone());
                };

                const endFlangeMatrices = [], valveDiscMatrices = [], valveHandleMatrices = [],
                      flange340Matrices = [], flange450Matrices = [], gaugeStemMatrices = [], gaugeFaceMatrices = [],
                      clampRodMatrices = [], clampRingMatrices = [];

                // 使用者目視回報：CDU 一次側應為「冷水(藍)進、熱水(紅)出」——藍管示意由廠務主管
                // 流向 CDU（進），紅管由 CDU 流向廠務主管（出）。drawPipeSeg 的 chevron 方向跟隨
                // (start→end) 走，供水(藍)兩段都要反過來畫（結尾→CDU側），回水(紅)維持原本
                // （CDU側→結尾）畫法不動。
                [CDU.zA, CDU.zB].forEach(cduZ => {
                    [{ dz: -RISER.portDz, mat: blueM, reverse: true }, { dz: RISER.portDz, mat: redM, reverse: false }].forEach(riser => {
                        const outX = CDU.x + RISER.portDx; // CDU 頂面出管口 x（與二次側四點錯開，見常數備註）
                        const outZ = cduZ + riser.dz;
                        const cduPt = [outX, CDU.h, outZ], elbowPt = [outX, RISER.elbowY, outZ], exitPt = [RISER.exitX, RISER.elbowY, outZ];

                        // 1. 垂直段：CDU 頂面 ↔ elbowY（藍管反畫：elbowY→CDU 頂面，示意水流入 CDU）
                        if (riser.reverse) {
                            drawPipeSeg(riserGroup, elbowPt, cduPt, riserR, riser.mat);
                        } else {
                            drawPipeSeg(riserGroup, cduPt, elbowPt, riserR, riser.mat);
                        }
                        addJointSphere(riserGroup, outX, RISER.elbowY, outZ, riserR, riser.mat);
                        // 2. 90° 彎頭後水平沿 -x 走到 exitX（離開模型範圍，示意接廠務主管；藍管反畫：
                        // exitX→elbow，示意水從廠務主管流向 CDU）
                        if (riser.reverse) {
                            drawPipeSeg(riserGroup, exitPt, elbowPt, riserR, riser.mat);
                        } else {
                            drawPipeSeg(riserGroup, elbowPt, exitPt, riserR, riser.mat);
                        }
                        pushRotZMatrix(endFlangeMatrices, RISER.exitX, RISER.elbowY, outZ, Math.PI / 2);

                        // 蝶閥 + 手輪（垂直段 y=2.60，人員可操作高度）
                        this.pushInstMatrix(valveDiscMatrices, outX, 2.60, outZ);
                        this.pushInstMatrix(valveHandleMatrices, outX + riserR * 1.4, 2.60, outZ);
                        // 法蘭對 y=3.40 / 4.50
                        this.pushInstMatrix(flange340Matrices, outX, 3.40, outZ);
                        this.pushInstMatrix(flange450Matrices, outX, 4.50, outZ);
                        // 壓力表樁 y=2.95
                        this.pushInstMatrix(gaugeStemMatrices, outX + riserR * 1.4, 2.95, outZ);
                        pushRotZMatrix(gaugeFaceMatrices, outX + riserR * 1.4 + 0.025, 2.95, outZ, Math.PI / 2);

                        // 管夾：水平段每 0.9m 一只，短吊桿至天花板 5.40
                        const horizLen = outX - RISER.exitX;
                        const clampCount = Math.max(0, Math.round(horizLen / 0.9) - 1);
                        for (let c = 1; c <= clampCount; c++) {
                            const cx = outX - c * 0.9;
                            this.pushInstMatrix(clampRodMatrices, cx, (ROOM.ceilingY + RISER.elbowY) / 2, outZ);
                            this.pushInstMatrix(clampRingMatrices, cx, RISER.elbowY, outZ, Math.PI / 2);
                        }
                    });
                });

                addInstMesh(riserGroup, new THREE.CylinderGeometry(riserR * 1.35, riserR * 1.35, 0.02, 16), this.materials.steelFrame, endFlangeMatrices);
                addInstMesh(riserGroup, new THREE.CylinderGeometry(riserR * 1.3, riserR * 1.3, 0.03, 16), this.materials.brass, valveDiscMatrices);
                addInstMesh(riserGroup, new THREE.BoxGeometry(0.015, 0.12, 0.015), this.materials.brass, valveHandleMatrices);
                addInstMesh(riserGroup, new THREE.CylinderGeometry(riserR * 1.35, riserR * 1.35, 0.02, 16), this.materials.steelFrame, flange340Matrices);
                addInstMesh(riserGroup, new THREE.CylinderGeometry(riserR * 1.35, riserR * 1.35, 0.02, 16), this.materials.steelFrame, flange450Matrices);
                addInstMesh(riserGroup, new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), this.materials.steelFrame, gaugeStemMatrices);
                addInstMesh(riserGroup, new THREE.CylinderGeometry(0.025, 0.025, 0.01, 12), this.materials.containmentFrame, gaugeFaceMatrices);
                addInstMesh(riserGroup, new THREE.CylinderGeometry(0.006, 0.006, ROOM.ceilingY - RISER.elbowY, 8), this.materials.aluminum, clampRodMatrices);
                addInstMesh(riserGroup, new THREE.TorusGeometry(riserR * 1.2, 0.007, 8, 16), this.materials.steelFrame, clampRingMatrices);
                tcsGroup.add(riserGroup);
            },

            // ============================================================================
            // Rev D 新增：機櫃背面垂直 manifold（僅中間 6 個 GPU 櫃 × 2 列 = 12 櫃，每櫃供藍/回紅一對）。
            // 幾何掛在 this.layers.tcs（與 buildTCS 的其他冷卻管路同一圖層開關）。
            // ============================================================================
            buildRackManifolds() {
                const R = this.VR_LAYOUT.rack;
                const M = this.VR_LAYOUT.manifold;
                const tcsGroup = this.layers.tcs;

                const blueM = this.materials.pipeBlueM;
                const redM = this.materials.pipeRedM;
                if (!this.materials.manifoldFitting) {
                    this.materials.manifoldFitting = new THREE.MeshStandardMaterial({ color: 0xcbd3da, metalness: 0.7, roughness: 0.35 }); // 封頭/快接樁/支架共用鍍鋅灰
                }
                const fitMat = this.materials.manifoldFitting;

                const addInstMesh = (parent, geo, mat, matrices) => {
                    if (matrices.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    parent.add(mesh);
                };
                const pushRotXMatrix = (array, x, y, z, rotX) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(x, y, z);
                    dummy.rotation.x = rotX;
                    dummy.updateMatrix();
                    array.push(dummy.matrix.clone());
                };
                // Rev E Phase E1 初版曾誤判方向（沿用 createRack 舊 spineSupply 註解「rotation.z=PI
                // 使方向由上往下」，但實測是反的）。使用者目視回報後修正：flowBlue/flowRed 貼圖共用
                // 同一全域 offset.y -= 0.015 捲動方向（見 animate()），CylinderGeometry 預設 UV
                // 不轉時 chevron 呈由上往下移動。垂直 manifold 上藍管（供水，從CDU過來、向下流入
                // 機櫃）維持預設不轉；紅管（回水，流回CDU、向上流出）須繞 Z 轉 180° 翻轉——只動
                // instance matrix 旋轉，不碰貼圖全域捲動方向（水平主管等其他管路共用同材質不受影響）。
                const pushRotZMatrix = (array, x, y, z, rotZ) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(x, y, z);
                    dummy.rotation.z = rotZ;
                    dummy.updateMatrix();
                    array.push(dummy.matrix.clone());
                };

                const manifoldGroup = new THREE.Group();
                const tubeH = M.yTop - M.yBot;
                const tubeMidY = (M.yTop + M.yBot) / 2;
                const stubCount = 4;

                const blueTubeMatrices = [], redTubeMatrices = [];
                const capMatrices = [], stubMatrices = [], footVertMatrices = [], footHorizMatrices = [];

                const rows = [
                    { sign: -1 }, // Row A
                    { sign: 1 },  // Row B
                ];
                rows.forEach(row => {
                    const z = row.sign * M.z;
                    const faceDir = row.sign; // 快接短樁/支架朝機櫃面（沿row.sign方向，遠離熱通道中央）
                    R.gpuIndices.forEach(idx => {
                        const rackX = R.xs[idx];
                        [
                            { dx: -M.xOffset, tubeArr: blueTubeMatrices, flip: false }, // 供水（藍，從CDU過來、向下流入機櫃，維持預設方向）
                            { dx: M.xOffset,  tubeArr: redTubeMatrices, flip: true },   // 回水（紅，流回CDU、向上流出機櫃，需翻轉）
                        ].forEach(feed => {
                            const x = rackX + feed.dx;
                            if (feed.flip) {
                                pushRotZMatrix(feed.tubeArr, x, tubeMidY, z, Math.PI);
                            } else {
                                this.pushInstMatrix(feed.tubeArr, x, tubeMidY, z);
                            }
                            this.pushInstMatrix(capMatrices, x, M.yTop, z);
                            for (let s = 0; s < stubCount; s++) {
                                const sy = M.yBot + (s + 0.5) * (tubeH / stubCount);
                                pushRotXMatrix(stubMatrices, x, sy, z + faceDir * 0.04, Math.PI / 2);
                            }
                            // 底部 L 型支撐：垂直短腳 + 水平短腳（伸向機櫃面）
                            this.pushInstMatrix(footVertMatrices, x, M.yBot - 0.03, z);
                            this.pushInstMatrix(footHorizMatrices, x, M.yBot - 0.06, z + faceDir * 0.03);
                        });
                    });
                });

                addInstMesh(manifoldGroup, new THREE.CylinderGeometry(M.r, M.r, tubeH, 12), blueM, blueTubeMatrices);
                addInstMesh(manifoldGroup, new THREE.CylinderGeometry(M.r, M.r, tubeH, 12), redM, redTubeMatrices);
                addInstMesh(manifoldGroup, new THREE.SphereGeometry(M.r * 1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), fitMat, capMatrices);
                addInstMesh(manifoldGroup, new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), fitMat, stubMatrices);
                addInstMesh(manifoldGroup, new THREE.BoxGeometry(0.03, 0.06, 0.03), fitMat, footVertMatrices);
                addInstMesh(manifoldGroup, new THREE.BoxGeometry(0.03, 0.03, 0.08), fitMat, footHorizMatrices);

                tcsGroup.add(manifoldGroup);
            },

            buildPowerBusways() {
                this.buswayGroup = new THREE.Group();
                
                if (!this.materials.busway) {
                    this.materials.busway = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 }); // Starline grey
                    this.materials.buswayBox = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 }); // Tap-off box dark grey
                    this.materials.buswayConduit = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }); // Black/Dark metallic flexible conduit
                    this.materials.buswayHanger = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 });
                    this.materials.blueFeed = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.3 }); // Feed A (Blue)
                    this.materials.redFeed = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 });  // Feed B (Red)
                }

                const buswayMat = this.materials.busway;
                const boxMat = this.materials.buswayBox;
                const conduitMat = this.materials.buswayConduit;
                const copperMat = this.materials.copperDetail || new THREE.MeshStandardMaterial({ color: 0xc47e4a, metalness: 0.95 });
                const hangerMat = this.materials.buswayHanger;
                const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
                const greenLed = new THREE.MeshBasicMaterial({ color: 0x22c55e });
                const yellowLed = new THREE.MeshBasicMaterial({ color: 0xeab308 });
                
                // Color coding for dual redundant feeds
                const blueFeedMat = this.materials.blueFeed;
                const redFeedMat = this.materials.redFeed;

                const buswayY = 3.25;
                const buswayW = 0.08;
                const buswayH = 0.14;
                const buswayLength = 7.5; // Extended to 7.5 to cover 12 racks
                
                // Redundancy Offsets (Feed A and Feed B)
                const zOffset = 0.12; 
                const zA = -1.45;
                const zB = 1.45;

                const zA_FeedA = zA - zOffset; // -1.57
                const zA_FeedB = zA + zOffset; // -1.33
                const zB_FeedA = zB - zOffset; // 1.33
                const zB_FeedB = zB + zOffset; // 1.57

                // Helper to create detailed busway housing with internal copper conductors
                const createDetailedBusway = (zPos, feedType) => {
                    const bg = new THREE.Group();
                    bg.userData = { row: zPos < 0 ? 'A' : 'B', type: 'busway' };
                    // Main housing
                    const mainBar = new THREE.Mesh(new THREE.BoxGeometry(buswayLength, buswayH, buswayW), buswayMat);
                    bg.add(mainBar);

                    // Continuous slot recess at the bottom (black strip)
                    const slotBacking = new THREE.Mesh(new THREE.BoxGeometry(buswayLength, 0.005, buswayW - 0.015), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
                    slotBacking.position.y = -buswayH/2 + 0.002;
                    bg.add(slotBacking);

                    // 4 copper busbar conductors running inside the bottom slot
                    const condW = 0.004;
                    const condH = 0.002;
                    const condSpacing = 0.012;
                    [-1.5, -0.5, 0.5, 1.5].forEach((offsetVal) => {
                        const cond = new THREE.Mesh(new THREE.BoxGeometry(buswayLength, condH, condW), copperMat);
                        cond.position.set(0, -buswayH/2 - 0.001, offsetVal * condSpacing);
                        bg.add(cond);
                    });

                    // Longitudinal aluminum ribs/side plates for premium industrial look
                    const ribGeo = new THREE.BoxGeometry(buswayLength, 0.015, 0.006);
                    [-0.04, 0, 0.04].forEach(ry => {
                        const ribL = new THREE.Mesh(ribGeo, hangerMat);
                        ribL.position.set(0, ry, buswayW/2 + 0.002);
                        bg.add(ribL);
                        const ribR = new THREE.Mesh(ribGeo, hangerMat);
                        ribR.position.set(0, ry, -buswayW/2 - 0.002);
                        bg.add(ribR);
                    });

                    // Color coded Joint/connectors along the busway (every 2.4 meters)
                    const jointMat = feedType === 'A' ? blueFeedMat : redFeedMat;
                    for (let x = -2.4; x <= 2.4; x += 2.4) {
                        const joint = new THREE.Mesh(new THREE.BoxGeometry(0.12, buswayH + 0.01, buswayW + 0.01), jointMat);
                        joint.position.set(x, 0, 0);
                        bg.add(joint);
                    }

                    // Color coded End Caps
                    [-buswayLength/2, buswayLength/2].forEach(ex => {
                        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.02, buswayH + 0.008, buswayW + 0.008), jointMat);
                        cap.position.set(ex, 0, 0);
                        bg.add(cap);
                    });

                    bg.position.set(0, buswayY, zPos);
                    return bg;
                };

                // Add the 4 busway runs
                this.buswayGroup.add(createDetailedBusway(zA_FeedA, 'A'));
                this.buswayGroup.add(createDetailedBusway(zA_FeedB, 'B'));
                this.buswayGroup.add(createDetailedBusway(zB_FeedA, 'A'));
                this.buswayGroup.add(createDetailedBusway(zB_FeedB, 'B'));

                // Trapeze Hangers for the busways (threaded rods from ceiling holding a unistrut support bar)
                const ceilingY = 4.0;
                const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, ceilingY - buswayY, 8);

                for (let hx = -3.6; hx <= 3.6; hx += 0.8) {
                    [zA, zB].forEach(zCenter => {
                        const hanger = new THREE.Group();
                        hanger.position.set(hx, buswayY, zCenter);
                        hanger.userData = { row: zCenter < 0 ? 'A' : 'B', type: 'hanger' };

                        // Dual hanger rods (straddling both busways)
                        const rodL = new THREE.Mesh(rodGeo, hangerMat);
                        rodL.position.set(0, (ceilingY - buswayY) / 2, -0.18);
                        hanger.add(rodL);

                        const rodR = new THREE.Mesh(rodGeo, hangerMat);
                        rodR.position.set(0, (ceilingY - buswayY) / 2, 0.18);
                        hanger.add(rodR);

                        // Ceiling bracket flanges
                        const ceilFlangeL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), hangerMat);
                        ceilFlangeL.position.set(0, ceilingY - buswayY - 0.005, -0.18);
                        hanger.add(ceilFlangeL);

                        const ceilFlangeR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), hangerMat);
                        ceilFlangeR.position.set(0, ceilingY - buswayY - 0.005, 0.18);
                        hanger.add(ceilFlangeR);

                        // Horizontal support channel (unistrut) under both busways
                        const channel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.44), hangerMat);
                        channel.position.set(0, -buswayH/2 - 0.01, 0);
                        hanger.add(channel);

                        // Individual support clamps holding the two parallel runs
                        const clampA = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, buswayW + 0.01), boxMat);
                        clampA.position.set(0, -buswayH/2 + 0.005, -zOffset);
                        hanger.add(clampA);

                        const clampB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, buswayW + 0.01), boxMat);
                        clampB.position.set(0, -buswayH/2 + 0.005, zOffset);
                        hanger.add(clampB);

                        this.buswayGroup.add(hanger);
                    });
                }

                // Tap-Off Boxes and Vertical Drops above each cabinet position
                const xs = [-3.41, -2.79, -2.17, -1.55, -0.93, -0.31, 0.31, 0.93, 1.55, 2.17, 2.79, 3.41];
                xs.forEach(x => {
                    // Tap-off Box Helper
                    const createTapOffBox = (bx, by, bz, feedType) => {
                        const tg = new THREE.Group();
                        tg.position.set(bx, by, bz);
                        tg.userData = { row: bz < 0 ? 'A' : 'B', type: 'tapoff' };

                        // Main enclosure
                        const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.12), boxMat);
                        tg.add(body);

                        // Breaker handle (switch)
                        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.01), redMat);
                        handle.position.set(0.05, 0.02, 0.061);
                        tg.add(handle);

                        // Status LEDs (Green = Load Normal, Feed LED = Blue/Red)
                        const ledG = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), greenLed);
                        ledG.position.set(-0.04, 0.04, 0.061);
                        tg.add(ledG);

                        const feedLedMat = feedType === 'A' ? new THREE.MeshBasicMaterial({ color: 0x00a8ff }) : new THREE.MeshBasicMaterial({ color: 0xff3b30 });
                        const ledFeed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), feedLedMat);
                        ledFeed.position.set(-0.02, 0.04, 0.061);
                        tg.add(ledFeed);

                        // Gland Connector at bottom
                        const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), hangerMat);
                        gland.position.y = -0.085;
                        tg.add(gland);

                        // Latch brackets clamping onto the busway
                        const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, buswayW + 0.01), hangerMat);
                        latch.position.y = 0.09;
                        tg.add(latch);

                        return tg;
                    };

                    // Rack Top Input Connection Box
                    const createRackTopBox = (rx, ry, rz, feedType) => {
                        const rbox = new THREE.Group();
                        rbox.position.set(rx, ry, rz);
                        rbox.userData = { row: rz < 0 ? 'A' : 'B', type: 'racktop' };

                        const mainBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.10), buswayMat);
                        rbox.add(mainBox);

                        // Connector flange on top with color-coded ring
                        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.015, 12), hangerMat);
                        flange.position.y = 0.035;
                        rbox.add(flange);

                        const ringMat = feedType === 'A' ? blueFeedMat : redFeedMat;
                        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.005, 12), ringMat);
                        ring.position.y = 0.035;
                        rbox.add(ring);

                        return rbox;
                    };

                    // Row A Dual Feeds
                    const tboxA_FeedA = createTapOffBox(x, buswayY - 0.085, zA_FeedA, 'A');
                    this.buswayGroup.add(tboxA_FeedA);

                    const tboxA_FeedB = createTapOffBox(x, buswayY - 0.085, zA_FeedB, 'B');
                    this.buswayGroup.add(tboxA_FeedB);

                    const rboxA_FeedA = createRackTopBox(x, 2.23, -1.2 - 0.12, 'A');
                    this.buswayGroup.add(rboxA_FeedA);

                    const rboxA_FeedB = createRackTopBox(x, 2.23, -1.2 + 0.12, 'B');
                    this.buswayGroup.add(rboxA_FeedB);

                    // Conduit A (Feed A)
                    const startA_A = new THREE.Vector3(x, buswayY - 0.17, zA_FeedA);
                    const endA_A = new THREE.Vector3(x, 2.26, -1.2 - 0.12); 
                    const controlA_A = new THREE.Vector3(x, 2.6, zA_FeedA + 0.1);
                    const curveA_A = new THREE.QuadraticBezierCurve3(startA_A, controlA_A, endA_A);
                    const pointsA_A = curveA_A.getPoints(12);
                    const conduitGeoA_A = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pointsA_A), 12, 0.014, 8, false);
                    const conduitA_A = new THREE.Mesh(conduitGeoA_A, conduitMat);
                    conduitA_A.userData = { row: 'A', type: 'conduit' };
                    this.buswayGroup.add(conduitA_A);

                    // Conduit B (Feed B)
                    const startA_B = new THREE.Vector3(x, buswayY - 0.17, zA_FeedB);
                    const endA_B = new THREE.Vector3(x, 2.26, -1.2 + 0.12); 
                    const controlA_B = new THREE.Vector3(x, 2.6, zA_FeedB + 0.1);
                    const curveA_B = new THREE.QuadraticBezierCurve3(startA_B, controlA_B, endA_B);
                    const pointsA_B = curveA_B.getPoints(12);
                    const conduitGeoA_B = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pointsA_B), 12, 0.014, 8, false);
                    const conduitA_B = new THREE.Mesh(conduitGeoA_B, conduitMat);
                    conduitA_B.userData = { row: 'A', type: 'conduit' };
                    this.buswayGroup.add(conduitA_B);


                    // Row B Dual Feeds
                    const tboxB_FeedA = createTapOffBox(x, buswayY - 0.085, zB_FeedA, 'A');
                    this.buswayGroup.add(tboxB_FeedA);

                    const tboxB_FeedB = createTapOffBox(x, buswayY - 0.085, zB_FeedB, 'B');
                    this.buswayGroup.add(tboxB_FeedB);

                    const rboxB_FeedA = createRackTopBox(x, 2.23, 1.2 - 0.12, 'A');
                    this.buswayGroup.add(rboxB_FeedA);

                    const rboxB_FeedB = createRackTopBox(x, 2.23, 1.2 + 0.12, 'B');
                    this.buswayGroup.add(rboxB_FeedB);

                    // Conduit A (Feed A)
                    const startB_A = new THREE.Vector3(x, buswayY - 0.17, zB_FeedA);
                    const endB_A = new THREE.Vector3(x, 2.26, 1.2 - 0.12); 
                    const controlB_A = new THREE.Vector3(x, 2.6, zB_FeedA - 0.1);
                    const curveB_A = new THREE.QuadraticBezierCurve3(startB_A, controlB_A, endB_A);
                    const pointsB_A = curveB_A.getPoints(12);
                    const conduitGeoB_A = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pointsB_A), 12, 0.014, 8, false);
                    const conduitB_A = new THREE.Mesh(conduitGeoB_A, conduitMat);
                    conduitB_A.userData = { row: 'B', type: 'conduit' };
                    this.buswayGroup.add(conduitB_A);

                    // Conduit B (Feed B)
                    const startB_B = new THREE.Vector3(x, buswayY - 0.17, zB_FeedB);
                    const endB_B = new THREE.Vector3(x, 2.26, 1.2 + 0.12); 
                    const controlB_B = new THREE.Vector3(x, 2.6, zB_FeedB - 0.1);
                    const curveB_B = new THREE.QuadraticBezierCurve3(startB_B, controlB_B, endB_B);
                    const pointsB_B = curveB_B.getPoints(12);
                    const conduitGeoB_B = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pointsB_B), 12, 0.014, 8, false);
                    const conduitB_B = new THREE.Mesh(conduitGeoB_B, conduitMat);
                    conduitB_B.userData = { row: 'B', type: 'conduit' };
                    this.buswayGroup.add(conduitB_B);
                });

                this.scene.add(this.buswayGroup);
            },

            // ============================================================================
            // Vera Rubin NVL72 — 上空線架系統（Phase 3）
            // 幾何依類別分別掛在 this.layers.powerTray / copperTray / fiberTray，取代舊 buildPowerBusways()。
            // 所有高程/座標一律取自 this.VR_LAYOUT，不硬編碼。
            // ============================================================================
            buildOverheadTrays() {
                const F = this.VR_LAYOUT.fiber, C = this.VR_LAYOUT.copper, P = this.VR_LAYOUT.power,
                      R = this.VR_LAYOUT.rack, ROOM = this.VR_LAYOUT.room;
                const fiberGroup = this.layers.fiberTray, copperGroup = this.layers.copperTray, powerGroup = this.layers.powerTray;
                // Rev E Phase E3：VR_LAYOUT.hanger（H，含 gridXMin/gridXMax/gridPitchX/rodR）與衍生的
                // xMin/xMax 已隨門架式 common support 取代整套細螺桿系統而移除，站距/站位改用本區段
                // 自訂的 stationXs（見下方，唯一真值：-4.28~4.27，每 0.95m 一站）。

                if (!this.materials.fiberDuct) {
                    this.materials.fiberDuct = new THREE.MeshStandardMaterial({ color: 0xd4d92b, roughness: 0.6 }); // 黃色封閉槽道
                    this.materials.trayRail = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 });
                    this.materials.jbox = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.7 });
                    this.materials.whipHose = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
                    this.materials.receptRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
                    this.materials.receptWhite = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
                    this.materials.wireBasket = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.5, roughness: 0.5 });
                    // Rev E Phase E5：fiberCable（黃色尾纖材質）已隨尾纖幾何移除而不再使用
                }

                const addInstMesh = (parent, geo, mat, matrices) => {
                    if (matrices.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    parent.add(mesh);
                };

                // ================= A. 門架式 Common Support（Rev E Phase E3：取代全部細螺桿系統）=================
                // 支撐站：沿 x 每 0.95m，x 從 -4.28 到 +4.27（與 tray 端部對齊），10 站，外側與艙內
                // 支撐站共用同一組 x（對位）。已驗算：
                //   型式 A 橫擔跨距 [0.87,2.88]（柱 z=0.95/2.80，兩端各外伸 0.08）涵蓋光纖環長邊
                //   z=±ringZHalf(1.50) 與銅纜/電力外圈長邊 z=±2.60，三層 tray 都坐得到橫擔上。
                //   型式 B 柱 z=±0.85（艙牆內側 0.05，wallZ=0.90，牆體 z∈[0.885,0.915]，
                //   淨距 0.035）不貫穿玻璃牆，且不與 y=3.80 橫框、y=5.10~5.30 頂部飾框
                //   （z∈[0.87,0.93]，淨距 0.02，較緊但無交集）相撞；橫擔跨 z∈[-0.85,0.85]
                //   涵蓋艙內梯架 z=±aisleZ(0.75)。
                const hangerGroup = new THREE.Group();
                if (!this.materials.steelFrame) {
                    this.materials.steelFrame = new THREE.MeshStandardMaterial({ color: 0xcbd3da, metalness: 0.7, roughness: 0.35 });
                }
                const stationXs = [];
                for (let x = -4.28; x <= 4.27 + 1e-6; x += 0.95) stationXs.push(x);

                const pushRotXMatrix2 = (arr, x, y, z, rotX) => {
                    const d = new THREE.Object3D(); d.position.set(x, y, z); d.rotation.x = rotX; d.updateMatrix();
                    arr.push(d.matrix.clone());
                };

                // 型式 A：外側 common support（左右各一列，鏡像）
                const outerColBotY = 3.55, outerColTopY = ROOM.ceilingY;
                const supportColZs = [0.95, 2.80]; // 型式 A 立柱 z（與 Section B 的 power.outerZ 無關，改名避免撞名）
                const beamYs = [3.65, 3.95, 4.25]; // 光纖 3.75 / 銅纜 4.00 / 電力外圈 4.30 各坐其上
                const beamSpanLo = supportColZs[0] - 0.08, beamSpanHi = supportColZs[1] + 0.08;
                const beamMidZ = (beamSpanLo + beamSpanHi) / 2, beamLen = beamSpanHi - beamSpanLo;

                // 型式 B：艙內 common support
                const innerColBotY = 4.15, innerColTopY = ROOM.ceilingY;
                const innerZ = 0.85;
                const innerBeamY = 4.25; // 托兩條艙內電力梯架（busway 已於 Phase E4 後移至艙外，改掛型式 A 橫擔）

                // 立柱斷面統一 0.06×0.06，但型式 A（長 1.85，柱頂貼頂板）與型式 B（長 1.25，無頂板）
                // 柱長不同，分開建兩個 InstancedMesh；橫擔同理（型式 A 長 beamLen，型式 B 長 innerZ*2）。
                const colMatricesA = [], colMatricesB = [], plateMatrices = [],
                      beamMatricesA = [], beamMatricesB = [], gussetMatrices = [];

                stationXs.forEach(x => {
                    // 型式 A：z=±0.95/±2.80 共 4 支立柱，柱頂頂板貼天花板
                    [-1, 1].forEach(side => {
                        supportColZs.forEach(z => {
                            const colZ = side * z;
                            this.pushInstMatrix(colMatricesA, x, (outerColBotY + outerColTopY) / 2, colZ);
                            this.pushInstMatrix(plateMatrices, x, outerColTopY - 0.01, colZ);
                        });
                        // 三層橫擔（跨 supportColZs 兩端外伸 0.08），橫擔與立柱交點加角撐小板
                        beamYs.forEach(y => {
                            this.pushInstMatrix(beamMatricesA, x, y, side * beamMidZ);
                            supportColZs.forEach(z => {
                                pushRotXMatrix2(gussetMatrices, x, y, side * z, Math.PI / 4);
                            });
                        });
                    });
                    // 型式 B：z=±0.85 共 2 支立柱，單層橫擔跨 z=-0.85~+0.85
                    [-1, 1].forEach(side => {
                        this.pushInstMatrix(colMatricesB, x, (innerColBotY + innerColTopY) / 2, side * innerZ);
                        pushRotXMatrix2(gussetMatrices, x, innerBeamY, side * innerZ, Math.PI / 4);
                    });
                    this.pushInstMatrix(beamMatricesB, x, innerBeamY, 0);
                });

                addInstMesh(hangerGroup, new THREE.BoxGeometry(0.06, outerColTopY - outerColBotY, 0.06), this.materials.steelFrame, colMatricesA);
                addInstMesh(hangerGroup, new THREE.BoxGeometry(0.06, innerColTopY - innerColBotY, 0.06), this.materials.steelFrame, colMatricesB);
                addInstMesh(hangerGroup, new THREE.BoxGeometry(0.14, 0.02, 0.14), this.materials.steelFrame, plateMatrices);
                addInstMesh(hangerGroup, new THREE.BoxGeometry(0.05, 0.05, beamLen), this.materials.steelFrame, beamMatricesA);
                addInstMesh(hangerGroup, new THREE.BoxGeometry(0.05, 0.05, innerZ * 2), this.materials.steelFrame, beamMatricesB);
                addInstMesh(hangerGroup, new THREE.BoxGeometry(0.10, 0.02, 0.10), this.materials.steelFrame, gussetMatrices);
                powerGroup.add(hangerGroup);

                // ================= B. 電力系統（Rev D：艙內梯架 z=±power.aisleZ(0.75)，x 跨 ±3.60，
                // 不穿端牆；外圈主幹 z=±power.outerZ(2.60)，x 跨 ±4.30；皆 y=power.trayY=4.30）=================
                const CT = this.VR_LAYOUT.containment;
                const PDU = this.VR_LAYOUT.pdu;
                const powerTrayGroup = new THREE.Group();
                const innerZs = [-P.aisleZ, P.aisleZ];
                const outerZs = [-P.outerZ, P.outerZ];
                const innerXMin = -3.60, innerXMax = 3.60;
                const outerXMin = -4.30, outerXMax = 4.30;

                const pushRotZMatrix = (array, x, y, z, rotZ) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(x, y, z);
                    dummy.rotation.z = rotZ;
                    dummy.updateMatrix();
                    array.push(dummy.matrix.clone());
                };

                const innerRailMatrices = [], outerRailMatrices = [], rungMatrices = [];
                const buildTrayRails = (zs, xLo, xHi, railMatArr) => {
                    const xMid = (xHi + xLo) / 2;
                    zs.forEach(z => {
                        [z - P.trayW / 2, z + P.trayW / 2].forEach(railZ => {
                            this.pushInstMatrix(railMatArr, xMid, P.trayY, railZ);
                        });
                        for (let x = xLo; x <= xHi + 1e-6; x += 0.25) {
                            this.pushInstMatrix(rungMatrices, x, P.trayY, z);
                        }
                    });
                };
                buildTrayRails(innerZs, innerXMin, innerXMax, innerRailMatrices);
                buildTrayRails(outerZs, outerXMin, outerXMax, outerRailMatrices);
                addInstMesh(powerTrayGroup, new THREE.BoxGeometry(innerXMax - innerXMin, 0.05, 0.02), this.materials.trayRail, innerRailMatrices);
                addInstMesh(powerTrayGroup, new THREE.BoxGeometry(outerXMax - outerXMin, 0.05, 0.02), this.materials.trayRail, outerRailMatrices);
                addInstMesh(powerTrayGroup, new THREE.BoxGeometry(0.02, 0.02, P.trayW), this.materials.trayRail, rungMatrices);

                // j-box + 導管/纜束移到外圈：j-box 每列 3 只（共 6 只）
                const jboxXs = [R.xs[1], R.xs[5], R.xs[9]];
                const jboxMatrices = [];
                outerZs.forEach(z => {
                    jboxXs.forEach(x => {
                        this.pushInstMatrix(jboxMatrices, x, P.trayY, z + Math.sign(z) * (P.trayW / 2 + 0.1));
                    });
                });
                addInstMesh(powerTrayGroup, new THREE.BoxGeometry(0.25, 0.15, 0.2), this.materials.jbox, jboxMatrices);

                // 外圈纜束（原「線架上鋪電纜束」隨 j-box 一併移到外圈）
                const cableMatrices = [];
                [-0.1, 0.05, 0.15].forEach((dz, i) => {
                    pushRotZMatrix(cableMatrices, (outerXMax + outerXMin) / 2, P.trayY + 0.03, outerZs[i % 2] + dz, Math.PI / 2);
                });
                addInstMesh(powerTrayGroup, new THREE.CylinderGeometry(0.012, 0.012, outerXMax - outerXMin, 8), this.materials.whipHose, cableMatrices);

                // 饋入導管束：艙內梯架 x=-3.60 端，沿端封板內面（近艙牆 x=-halfW）垂直下走到 y=2.60，
                // 再穿端牆小封板接出（示意來自配電室）；每條梯架一組 3 條黑導管
                const feedConduitMatrices = [], feedPlateMatrices = [];
                const feedX = -CT.halfW + 0.08; // 貼端封板內面
                innerZs.forEach(z => {
                    [-0.03, 0, 0.03].forEach(dz => {
                        this.pushInstMatrix(feedConduitMatrices, feedX, (P.trayY + 2.60) / 2, z + dz);
                    });
                    this.pushInstMatrix(feedPlateMatrices, -CT.halfW, 2.60, z);
                });
                addInstMesh(powerTrayGroup, new THREE.CylinderGeometry(0.02, 0.02, P.trayY - 2.60, 8), this.materials.jbox, feedConduitMatrices);
                addInstMesh(powerTrayGroup, new THREE.BoxGeometry(0.02, 0.20, 0.30), this.materials.hotAisleBlind, feedPlateMatrices);

                // 饋電垂降（whip，Rev E Phase E4，busway 後移至最上層後跟著調整）：四條 busway
                // 的 tap-off box 正下方懸掛紅白 receptacle 組（y 3.75~4.15，busway 底面 4.29
                // 到 receptacle 頂 4.15 之間即 tap-off box 本體，見 buildAisleBusways()）→
                // 黑色軟管自然垂落弧 → 機櫃背面置中 PDU 頂（y=pdu.yTop，x=櫃位∓0.05，z=±pdu.z，
                // 沿用 E2 收斂終點）。每櫃每列 2 條（A/B）= 12×2×2 = 48 條。
                const receptTopY = 4.15, receptBotY = 3.75, receptSegH = (receptTopY - receptBotY) / 5;
                const pduTopY = PDU.yTop;
                // 使用者目視回報修正：busway 應在熱通道艙牆外側（冷通道/機櫃上空區），不應在艙內。
                // 須與 buildAisleBusways() 的 BUS_OUTER_Z/BUS_INNER_Z 完全一致（艙牆 wallZ=0.90，
                // 內緣 0.885；BUS_INNER_Z=1.10 距內緣 0.155 淨距，在艙外）。
                const BUS_OUTER_Z = 1.35, BUS_INNER_Z = 1.10;

                const receptRedMatrices = [], receptWhiteMatrices = [], plugMatrices = [];
                const buildWhipHoseGeo = (busZ, pduZ, plugDx) => {
                    const curve = new THREE.CatmullRomCurve3([
                        new THREE.Vector3(0, receptBotY, busZ),
                        new THREE.Vector3(plugDx / 2, (receptBotY + pduTopY) / 2, (busZ + pduZ) / 2),
                        new THREE.Vector3(plugDx, pduTopY, pduZ),
                    ]);
                    return new THREE.TubeGeometry(curve, 12, 0.015, 8, false);
                };
                // Row A/B（z 鏡像）× 外/內 busway（z 行程不同，無法共用），4 個 TubeGeometry，
                // 各 IM 12 次（對應 12 櫃）。
                const hoseGeoAOuter = buildWhipHoseGeo(-BUS_OUTER_Z, -PDU.z, -0.05); // Row A，A-feed（藍，外）
                const hoseGeoAInner = buildWhipHoseGeo(-BUS_INNER_Z, -PDU.z, 0.05);  // Row A，B-feed（紅，內）
                const hoseGeoBOuter = buildWhipHoseGeo(BUS_OUTER_Z, PDU.z, -0.05);   // Row B，A-feed（藍，外，鏡像）
                const hoseGeoBInner = buildWhipHoseGeo(BUS_INNER_Z, PDU.z, 0.05);    // Row B，B-feed（紅，內，鏡像）
                const hoseMatAOuter = [], hoseMatAInner = [], hoseMatBOuter = [], hoseMatBInner = [];

                const busRows = [
                    { rowSign: -1, outerHoseArr: hoseMatAOuter, innerHoseArr: hoseMatAInner },
                    { rowSign: 1,  outerHoseArr: hoseMatBOuter, innerHoseArr: hoseMatBInner },
                ];
                busRows.forEach(row => {
                    const outerZ = row.rowSign * BUS_OUTER_Z, innerZ = row.rowSign * BUS_INNER_Z;
                    const pduZ = row.rowSign * PDU.z;
                    R.xs.forEach(rackX => {
                        [
                            { busZ: outerZ, hoseArr: row.outerHoseArr, plugDx: -0.05 }, // A-feed（藍）
                            { busZ: innerZ, hoseArr: row.innerHoseArr, plugDx: 0.05 },  // B-feed（紅）
                        ].forEach(feed => {
                            // 紅白條紋 receptacle（5 節，紅3白2交替，紅頭尾），懸掛於對應 busway 的
                            // tap-off box 正下方（x=rackX，z=該 busway 自身 z）
                            for (let s = 0; s < 5; s++) {
                                const sy = receptTopY - (s + 0.5) * receptSegH;
                                this.pushInstMatrix(s % 2 === 0 ? receptRedMatrices : receptWhiteMatrices, rackX, sy, feed.busZ);
                            }
                            // 黑色軟管（純 x=rackX 平移，本地座標已含收斂路徑）
                            this.pushInstMatrix(feed.hoseArr, rackX, 0, 0);
                            // 末端插頭（並排接入置中 PDU 頂）
                            this.pushInstMatrix(plugMatrices, rackX + feed.plugDx, pduTopY - 0.03, pduZ);
                        });
                    });
                });
                addInstMesh(powerTrayGroup, new THREE.CylinderGeometry(0.030, 0.030, receptSegH, 10), this.materials.receptRed, receptRedMatrices);
                addInstMesh(powerTrayGroup, new THREE.CylinderGeometry(0.030, 0.030, receptSegH, 10), this.materials.receptWhite, receptWhiteMatrices);
                addInstMesh(powerTrayGroup, hoseGeoAOuter, this.materials.whipHose, hoseMatAOuter);
                addInstMesh(powerTrayGroup, hoseGeoAInner, this.materials.whipHose, hoseMatAInner);
                addInstMesh(powerTrayGroup, hoseGeoBOuter, this.materials.whipHose, hoseMatBOuter);
                addInstMesh(powerTrayGroup, hoseGeoBInner, this.materials.whipHose, hoseMatBInner);
                addInstMesh(powerTrayGroup, new THREE.BoxGeometry(0.04, 0.06, 0.04), this.materials.whipHose, plugMatrices);

                powerGroup.add(powerTrayGroup);

                // ================= C. 銅纜外圈（Rev D：長邊 z=±copper.trayZ(2.60)、短邊 x=±4.30 成環，
                // y=copper.trayY=4.00；網籃絲網/銅色纜束/吊桿沿用既有規格，僅補上短邊）=================
                const copperTrayGroup = new THREE.Group();
                const copperZs = [-C.trayZ, C.trayZ];
                const copperXs = [-F.ringXHalf, F.ringXHalf]; // 短邊 x，與 fiber 環同值，構成外圈周邊
                const uWireCurve = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(0, 0, -C.trayW / 2),
                    new THREE.Vector3(0, -C.trayH, 0),
                    new THREE.Vector3(0, 0, C.trayW / 2),
                ]);
                const uWireGeoLong = new THREE.TubeGeometry(uWireCurve, 8, 0.004, 6, false);   // 長邊（沿 x）
                const uWireGeoShort = uWireGeoLong.clone().rotateY(Math.PI / 2);                // 短邊（沿 z）

                // pushRotXMatrix2 沿用 Section A 已宣告的版本（同函式作用域，避免重複宣告撞名）
                const pushRotZMatrix2 = (arr, x, y, z, rotZ) => {
                    const d = new THREE.Object3D(); d.position.set(x, y, z); d.rotation.z = rotZ; d.updateMatrix();
                    arr.push(d.matrix.clone());
                };

                const rodMatricesLong = [], rodMatricesShort = [], bundleMatricesLong = [], bundleMatricesShort = [],
                      uWireMatricesLong = [], uWireMatricesShort = [];
                const longSpan = copperXs[1] * 2, shortSpan = copperZs[1] * 2;

                // 長邊（沿 x，z=±trayZ）
                copperZs.forEach(z => {
                    [-0.15, -0.05, 0.05, 0.15].forEach(dz => pushRotZMatrix2(rodMatricesLong, 0, C.trayY, z + dz, Math.PI / 2));
                    for (let x = copperXs[0]; x <= copperXs[1] + 1e-6; x += 0.1) {
                        this.pushInstMatrix(uWireMatricesLong, x, C.trayY, z);
                    }
                    [-0.1, 0.1].forEach(dz => pushRotZMatrix2(bundleMatricesLong, 0, C.trayY - 0.03, z + dz, Math.PI / 2));
                });
                // 短邊（沿 z，x=±4.30）
                copperXs.forEach(x => {
                    [-0.15, -0.05, 0.05, 0.15].forEach(dx => pushRotXMatrix2(rodMatricesShort, x + dx, C.trayY, 0, Math.PI / 2));
                    for (let z = copperZs[0]; z <= copperZs[1] + 1e-6; z += 0.1) {
                        this.pushInstMatrix(uWireMatricesShort, x, C.trayY, z);
                    }
                    [-0.1, 0.1].forEach(dx => pushRotXMatrix2(bundleMatricesShort, x + dx, C.trayY - 0.03, 0, Math.PI / 2));
                });

                addInstMesh(copperTrayGroup, new THREE.CylinderGeometry(0.004, 0.004, longSpan, 6), this.materials.wireBasket, rodMatricesLong);
                addInstMesh(copperTrayGroup, new THREE.CylinderGeometry(0.004, 0.004, shortSpan, 6), this.materials.wireBasket, rodMatricesShort);
                addInstMesh(copperTrayGroup, new THREE.CylinderGeometry(0.018, 0.018, longSpan, 8), this.materials.copperTube, bundleMatricesLong);
                addInstMesh(copperTrayGroup, new THREE.CylinderGeometry(0.018, 0.018, shortSpan, 8), this.materials.copperTube, bundleMatricesShort);
                addInstMesh(copperTrayGroup, uWireGeoLong, this.materials.wireBasket, uWireMatricesLong);
                addInstMesh(copperTrayGroup, uWireGeoShort, this.materials.wireBasket, uWireMatricesShort);
                copperGroup.add(copperTrayGroup);

                // ================= D. 光纖封閉槽道環（Rev D：封閉矩形環，y=fiber.trayY=3.75，長邊
                // z=±fiber.ringZHalf(機櫃列正上方)、短邊 x=±fiber.ringXHalf；四角水平 L 型轉角，
                // 全程無斜坡段——列間跨接已隨全高煙囪阻隔移除，改由環短邊繞行連通）=================
                const fiberTrayGroup = new THREE.Group();
                const fiberZs = [-F.ringZHalf, F.ringZHalf];
                const fiberXs = [-F.ringXHalf, F.ringXHalf];

                // 長邊（沿 x，z=±ringZHalf）
                fiberZs.forEach(z => {
                    const duct = new THREE.Mesh(new THREE.BoxGeometry(F.ringXHalf * 2, F.trayH, F.trayW), this.materials.fiberDuct);
                    duct.position.set(0, F.trayY, z);
                    fiberTrayGroup.add(duct);
                });
                // 短邊（沿 z，x=±ringXHalf）——列間跨接改由此處繞行
                fiberXs.forEach(x => {
                    const duct = new THREE.Mesh(new THREE.BoxGeometry(F.trayW, F.trayH, F.ringZHalf * 2), this.materials.fiberDuct);
                    duct.position.set(x, F.trayY, 0);
                    fiberTrayGroup.add(duct);
                });
                // 四角 45° 斜切角板（水平面內收邊，y 不變、非斜坡）
                const cornerMatrices = [];
                fiberXs.forEach(x => {
                    fiberZs.forEach(z => {
                        const dummy = new THREE.Object3D();
                        dummy.position.set(x, F.trayY, z);
                        dummy.rotation.y = Math.PI / 4;
                        dummy.updateMatrix();
                        cornerMatrices.push(dummy.matrix.clone());
                    });
                });
                addInstMesh(fiberTrayGroup, new THREE.BoxGeometry(F.trayW * 1.3, F.trayH + 0.01, 0.03), this.materials.fiberDuct, cornerMatrices);

                // 接縫環，長邊每 1.2m 一個（照舊規格）
                const collarMatrices = [];
                fiberZs.forEach(z => {
                    for (let x = -F.ringXHalf; x <= F.ringXHalf + 1e-6; x += 1.2) {
                        this.pushInstMatrix(collarMatrices, x, F.trayY, z);
                    }
                });
                addInstMesh(fiberTrayGroup, new THREE.BoxGeometry(0.03, F.trayH + 0.02, F.trayW + 0.02), this.materials.fiberDuct, collarMatrices);

                // Waterfall 1/4 圓弧滑軌（Rev E Phase E5：尾纖已移除，僅保留空置彎件本體——
                // 「空置的下線彎件是真實機房常態，也與參考圖一致」，故不接任何纖纜，純結構裝飾）。
                // 每 2 櫃一處，從環長邊內側伸出。buildRackCableEntries() 入口組件維持不變。
                const waterfallRailMatrices = [];
                const railR = 0.15;
                [-1, 1].forEach(rowSign => {
                    const ductZ = rowSign * (F.ringZHalf - F.trayW / 2); // 環長邊內側
                    [1, 3, 5, 7, 9, 11].forEach(i => {
                        const dummy = new THREE.Object3D();
                        dummy.position.set(R.xs[i], F.trayY, ductZ);
                        dummy.rotation.y = Math.PI / 2;
                        dummy.rotation.z = rowSign > 0 ? Math.PI : 0; // 依列別調整彎向
                        dummy.updateMatrix();
                        waterfallRailMatrices.push(dummy.matrix.clone());
                    });
                });
                addInstMesh(fiberTrayGroup, new THREE.TorusGeometry(railR, 0.010, 8, 12, Math.PI / 2), this.materials.fiberDuct, waterfallRailMatrices);

                fiberGroup.add(fiberTrayGroup);
            },

            // ============================================================================
            // Rev B Phase R4 — 機櫃背面 PDU busbar（新函式，掛於 powerTray 圖層）
            // 每櫃 2 支垂直 busbar（A/B 饋電），貼在機櫃背面（熱通道側），供 whip 接入。
            // createRack() 依 CLAUDE.md 第 5 條禁改，此為獨立新建的外掛幾何，不觸碰機櫃本體。
            // ============================================================================
            buildRackRearPDU() {
                const R = this.VR_LAYOUT.rack;
                const PDU = this.VR_LAYOUT.pdu; // Rev D Phase D4：座標改讀 VR_LAYOUT.pdu，內部型態不動
                const powerGroup = this.layers.powerTray;

                if (!this.materials.blueFeed) {
                    this.materials.blueFeed = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.3 });
                    this.materials.redFeed = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 });
                    this.materials.pduBody = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.4, roughness: 0.6 });
                    this.materials.pduSocket = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 });
                }

                const addInstMesh = (parent, geo, mat, matrices) => {
                    if (matrices.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    parent.add(mesh);
                };

                // Rev E Phase E2：每櫃單支 PDU 置中（pdu.xOffset=0），24 櫃共 24 支（原本每櫃兩支、
                // 共 48 支）。識別環改為單支上藍下紅雙環，代表雙饋電（A/B）匯入同一支 busbar；
                // 插座模組維持 6 個、LED 維持 1 顆，全部沿用既有 InstancedMesh 寫法。
                const pduGroup = new THREE.Group();
                const busbarBotY = PDU.yBot, busbarTopY = PDU.yTop;
                const busbarH = busbarTopY - busbarBotY;
                const busbarMidY = (busbarBotY + busbarTopY) / 2;
                const socketCount = 6;

                const bodyMatrices = [], blueRingMatrices = [], redRingMatrices = [], socketMatrices = [], ledMatrices = [];
                const rows = [
                    { rackZ: R.rowA_z, pduZ: -PDU.z }, // Row A 背面（熱通道側）
                    { rackZ: R.rowB_z, pduZ: PDU.z },  // Row B 背面（熱通道側）
                ];
                rows.forEach(row => {
                    const faceDir = -Math.sign(row.pduZ); // 插座/LED 朝向熱通道中央（背離機櫃面）
                    R.xs.forEach(x => {
                        this.pushInstMatrix(bodyMatrices, x, busbarMidY, row.pduZ);
                        // 雙環：上藍（A 饋電/供）、下紅（B 饋電/回），同一支 busbar 雙饋電入
                        this.pushInstMatrix(blueRingMatrices, x, busbarTopY - 0.03, row.pduZ);
                        this.pushInstMatrix(redRingMatrices, x, busbarTopY - 0.09, row.pduZ);
                        this.pushInstMatrix(ledMatrices, x, busbarTopY - 0.15, row.pduZ + faceDir * 0.026);
                        for (let s = 0; s < socketCount; s++) {
                            const sy = busbarBotY + (s + 0.5) * (busbarH / socketCount);
                            this.pushInstMatrix(socketMatrices, x, sy, row.pduZ + faceDir * 0.036);
                        }
                    });
                });

                addInstMesh(pduGroup, new THREE.BoxGeometry(PDU.w, busbarH, 0.05), this.materials.pduBody, bodyMatrices);
                {
                    // 半徑+管徑須 ≤ 0.03（busbar 中心距機櫃背面/艙牆僅 0.03 空隙），避免識別環穿出艙牆
                    const ringGeo = new THREE.TorusGeometry(0.022, 0.005, 6, 12);
                    ringGeo.rotateX(Math.PI / 2); // 躺平的環改直立套住 busbar
                    addInstMesh(pduGroup, ringGeo, this.materials.blueFeed, blueRingMatrices);
                    addInstMesh(pduGroup, ringGeo.clone(), this.materials.redFeed, redRingMatrices);
                }
                addInstMesh(pduGroup, new THREE.BoxGeometry(0.05, 0.10, 0.02), this.materials.pduSocket, socketMatrices);
                addInstMesh(pduGroup, new THREE.SphereGeometry(0.008, 6, 6), this.materials.ledGreen, ledMatrices);
                powerGroup.add(pduGroup);
            },

            // ============================================================================
            // Rev E Phase E4 新增、Phase E4 後使用者目視回報修正：busway 原建在艙內（熱通道），
            // 應在熱通道艙牆外側（冷通道/機櫃上空區）——已移出。掛於 powerTray 圖層。
            // 拓撲（經與使用者確認調整，取代原規格「單組 A/B 各一條、每條服務全部 24 櫃」的方案，
            // 避免軟管跨整條熱通道的不合理走法）：每列各自一對 busway（2N 冗餘正確版）：
            //   Row A：A-feed(藍) z=-BUS_OUTER_Z(1.35，外)、B-feed(紅) z=-BUS_INNER_Z(1.10，內)
            //   Row B：鏡像，z=+1.35(藍,外) / +1.10(紅,內)
            // 每條 busway 12 只 tap-off（對應該列 12 櫃），全場 4×12=48 只，總數與原規格一致。
            // 艙牆 wallZ=0.90，內緣 0.885；BUS_INNER_Z=1.10（半寬0.06，外緣1.16 內緣1.04）距牆
            // 內緣淨距 0.155，已在艙外；同時距 Phase E3 型式 A 外側 common support 立柱
            // （z=0.95，外緣0.98）淨距 0.06，不衝突；busway 現改吊掛於型式 A 的橫擔（z 跨
            // [0.87,2.88] 涵蓋 1.10/1.35），非原本的型式 B（艙內）。間距沿用 0.25。
            // BUS_OUTER_Z/BUS_INNER_Z 須與 buildOverheadTrays() 電力區段的 whip 收尾完全一致。
            // ============================================================================
            buildAisleBusways() {
                const R = this.VR_LAYOUT.rack;
                const CT = this.VR_LAYOUT.containment;
                const powerGroup = this.layers.powerTray;

                if (!this.materials.busway) {
                    this.materials.busway = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.35 });
                    this.materials.buswayFeedBox = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.6 });
                    this.materials.buswayStripeBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 });
                    this.materials.buswayStripeRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
                    this.materials.tapOffBox = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.6 });
                }

                const addInstMesh = (parent, geo, mat, matrices) => {
                    if (matrices.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    parent.add(mesh);
                };

                const buswayGroup = new THREE.Group();
                // 使用者回報：busway 應放在 common support 最上層——移到型式 A 橫擔（4.25）之上，
                // 4.35 貼齊橫擔頂（4.275）加 0.015 淨距，成為整個吊架系統最高的一層（原電力外圈 4.30 之上）。
                const buswayY = 4.35, buswayW = 0.12, buswayH = 0.12;
                const xLo = -3.60, xHi = 3.60, buswayLen = xHi - xLo;
                const BUS_OUTER_Z = 1.35, BUS_INNER_Z = 1.10;

                const busways = [
                    { z: -BUS_OUTER_Z, blue: true },   // Row A，A-feed（藍，外）
                    { z: -BUS_INNER_Z, blue: false },  // Row A，B-feed（紅，內）
                    { z: BUS_OUTER_Z, blue: true },    // Row B，A-feed（藍，外，鏡像）
                    { z: BUS_INNER_Z, blue: false },   // Row B，B-feed（紅，內，鏡像）
                ];

                // 支撐站：與 Section A 完全一致（10 站，-4.28~4.27）。busway 現位於 z=1.10~1.35，
                // 落在型式 A（外側 common support）橫擔跨距 [0.87,2.88] 內，故吊掛對照型式 A 橫擔
                // （非原本的型式 B／艙內），y 同為 4.25。
                const stationXs = [];
                for (let x = -4.28; x <= 4.27 + 1e-6; x += 0.95) stationXs.push(x);
                const hangBeamY = 4.25; // 對照型式 A 橫擔
                const hangBeamTopY = hangBeamY + 0.025; // 橫擔頂面（橫擔斷面 0.05，半高 0.025）

                const bodyMatrices = [], collarMatrices = [], feedBoxMatrices = [], conduitMatrices = [],
                      platePlateMatrices = [], stripeBlueMatrices = [], stripeRedMatrices = [],
                      tapOffMatrices = [], hangerMatrices = [];

                busways.forEach(bw => {
                    this.pushInstMatrix(bodyMatrices, 0, buswayY, bw.z);
                    this.pushInstMatrix(bw.blue ? stripeBlueMatrices : stripeRedMatrices, 0, buswayY - buswayH / 2 - 0.005, bw.z);
                    // 接頭箍：每 1.5m 一圈
                    for (let x = xLo; x <= xHi + 1e-6; x += 1.5) {
                        this.pushInstMatrix(collarMatrices, x, buswayY, bw.z);
                    }
                    // 端部饋入箱：x=-3.60 端，垂直饋線導管沿端封板內面下到 y=2.60 穿小封板接出
                    this.pushInstMatrix(feedBoxMatrices, xLo - 0.05, buswayY, bw.z);
                    this.pushInstMatrix(conduitMatrices, -CT.halfW + 0.08, (buswayY + 2.60) / 2, bw.z);
                    this.pushInstMatrix(platePlateMatrices, -CT.halfW, 2.60, bw.z);
                    // tap-off box：每櫃位一只，扣在 busway 底面（24 櫃分 2 列，此處每條 busway 12 只）
                    R.xs.forEach(x => {
                        this.pushInstMatrix(tapOffMatrices, x, buswayY - buswayH / 2 - 0.07, bw.z);
                    });
                    // 吊掛：busway 現坐在型式 A 橫擔頂上方（最上層），改為短立柱由橫擔頂面
                    // 撐起 busway 底面（非原本由上往下垂吊的長吊桿）
                    stationXs.forEach(x => {
                        this.pushInstMatrix(hangerMatrices, x, (hangBeamTopY + buswayY - buswayH / 2) / 2, bw.z);
                    });
                });

                addInstMesh(buswayGroup, new THREE.BoxGeometry(buswayLen, buswayH, buswayW), this.materials.busway, bodyMatrices);
                addInstMesh(buswayGroup, new THREE.BoxGeometry(0.02, buswayH + 0.02, buswayW + 0.02), this.materials.busway, collarMatrices);
                addInstMesh(buswayGroup, new THREE.BoxGeometry(0.30, 0.25, 0.20), this.materials.buswayFeedBox, feedBoxMatrices);
                addInstMesh(buswayGroup, new THREE.CylinderGeometry(0.02, 0.02, buswayY - 2.60, 8), this.materials.buswayFeedBox, conduitMatrices);
                addInstMesh(buswayGroup, new THREE.BoxGeometry(0.02, 0.20, 0.30), this.materials.hotAisleBlind, platePlateMatrices);
                addInstMesh(buswayGroup, new THREE.BoxGeometry(buswayLen, 0.01, buswayW * 0.6), this.materials.buswayStripeBlue, stripeBlueMatrices);
                addInstMesh(buswayGroup, new THREE.BoxGeometry(buswayLen, 0.01, buswayW * 0.6), this.materials.buswayStripeRed, stripeRedMatrices);
                addInstMesh(buswayGroup, new THREE.BoxGeometry(0.18, 0.14, 0.12), this.materials.tapOffBox, tapOffMatrices);
                addInstMesh(buswayGroup, new THREE.CylinderGeometry(0.012, 0.012, (buswayY - buswayH / 2) - hangBeamTopY, 8), this.materials.trayRail, hangerMatrices);

                powerGroup.add(buswayGroup);
            },

            // ============================================================================
            // Rev D Phase D5 新增：機櫃頂面纜線入口組件（24 櫃全配，靠冷通道側），供光纖 waterfall
            // 尾纖對位終點，取代舊版尾纖直插機櫃頂面的做法。掛於 fiberTray 圖層。
            // ============================================================================
            buildRackCableEntries() {
                const R = this.VR_LAYOUT.rack;
                const fiberGroup = this.layers.fiberTray;

                if (!this.materials.cableEntryBox) {
                    this.materials.cableEntryBox = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
                    this.materials.cableBrush = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
                }

                const addInstMesh = (parent, geo, mat, matrices) => {
                    if (matrices.length === 0) return;
                    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    parent.add(mesh);
                };

                const entryGroup = new THREE.Group();
                const boxH = 0.06;
                const boxMatrices = [], brushMatrices = [];
                const rows = [
                    { rowZ: R.rowA_z, sign: -1 },
                    { rowZ: R.rowB_z, sign: 1 },
                ];
                rows.forEach(row => {
                    const z = row.rowZ + row.sign * 0.45; // 靠冷通道側（機櫃頂外緣，遠離熱通道中心）
                    R.xs.forEach(x => {
                        this.pushInstMatrix(boxMatrices, x, R.h + boxH / 2, z);
                        this.pushInstMatrix(brushMatrices, x, R.h + boxH + 0.005, z);
                    });
                });
                addInstMesh(entryGroup, new THREE.BoxGeometry(0.18, boxH, 0.12), this.materials.cableEntryBox, boxMatrices);
                addInstMesh(entryGroup, new THREE.BoxGeometry(0.16, 0.01, 0.02), this.materials.cableBrush, brushMatrices);
                fiberGroup.add(entryGroup);
            },

            // ============================================================================
            // Rev F Phase F2 新增：機櫃角色型別標示板（外掛於 racks 圖層，createRack() 本體零修改）。
            // 中間 6 櫃(idx3-8)=VR200 Compute、邊櫃 idx0,1,10,11=NVLink Switch、idx2,9=Power Sidecar，
            // 與 createRack() 內既有 isComputeRack/isSwitchRack/isPowerRack 判斷邏輯一致。
            // 貼於機櫃正面（冷通道側）頂部：z 偏移公式與既有頂板 NVIDIA 標誌牌（app.js 內
            // topPlateGroup 的 nvidiaBadge，local z=-d/2-0.005、rotation.y=Math.PI）同一套換算，
            // 換算到世界座標後 Row A/B 的 z 偏移方向與 rotY 互為鏡像。
            // ============================================================================
            buildRackTypeLabels() {
                const R = this.VR_LAYOUT.rack;
                const racksGroup = this.layers.racks;

                if (!this.materials.rackLabelCompute) {
                    const mkLabelTexture = (bg, text) => {
                        const c = document.createElement('canvas'); c.width = 1050; c.height = 200;
                        const ctx = c.getContext('2d');
                        ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
                        ctx.fillStyle = '#f4f6f8';
                        ctx.font = 'bold 66px Arial, sans-serif';
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(text, c.width / 2, c.height / 2);
                        return new THREE.CanvasTexture(c);
                    };
                    this.textures.rackLabelCompute = mkLabelTexture('#0d2b18', 'VR200 COMPUTE • 240 kW');
                    this.textures.rackLabelSwitch  = mkLabelTexture('#243447', 'NVLINK SWITCH');
                    this.textures.rackLabelPower   = mkLabelTexture('#3a2a1c', 'POWER SIDECAR');

                    this.materials.rackLabelCompute = new THREE.MeshBasicMaterial({ map: this.textures.rackLabelCompute });
                    this.materials.rackLabelSwitch  = new THREE.MeshBasicMaterial({ map: this.textures.rackLabelSwitch });
                    this.materials.rackLabelPower   = new THREE.MeshBasicMaterial({ map: this.textures.rackLabelPower });
                }

                const plateGeo = new THREE.PlaneGeometry(0.42, 0.08);
                const plateY = 1.95; // 機櫃頂 y=2.20 下方一小段，避開既有 NVIDIA 標誌牌所在高度帶(約 y=2.11)
                const rows = [
                    { faceZ: R.rowA_z - R.d / 2 - 0.005, rotY: Math.PI }, // Row A 正面朝 -z（冷通道側）
                    { faceZ: R.rowB_z + R.d / 2 + 0.005, rotY: 0 },       // Row B 正面朝 +z（冷通道側）
                ];

                const computeMatrices = [], switchMatrices = [], powerMatrices = [];
                rows.forEach(row => {
                    R.xs.forEach((x, colIdx) => {
                        const isSwitch = colIdx === 0 || colIdx === 1 || colIdx === 10 || colIdx === 11;
                        const isPower  = colIdx === 2 || colIdx === 9;
                        const target = isSwitch ? switchMatrices : (isPower ? powerMatrices : computeMatrices);
                        this.pushInstMatrix(target, x, plateY, row.faceZ, row.rotY);
                    });
                });

                const addLabelMesh = (matrices, material) => {
                    if (!matrices.length) return;
                    const mesh = new THREE.InstancedMesh(plateGeo, material, matrices.length);
                    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                    mesh.instanceMatrix.needsUpdate = true;
                    racksGroup.add(mesh);
                };
                addLabelMesh(computeMatrices, this.materials.rackLabelCompute);
                addLabelMesh(switchMatrices, this.materials.rackLabelSwitch);
                addLabelMesh(powerMatrices, this.materials.rackLabelPower);
            },

            // ============================================================================
            // Rev F Phase F4 新增：房間級風牆(Fanwall)機組 ×2 + 預留擴充位 ×2，掛於新圖層
            // 'fanwall'。座標引用 VR_LAYOUT.fanwall（唯一真值），與 CDU 端(x=-5.0)相對佈置
            // 在 +x 端。機體尺寸 0.90(x)×2.20(y)×2.40(z) 本身即為軸對齊(無需旋轉群組)，
            // 迎風面(局部 -x 面)朝機櫃模組方向，故轉子繞局部 X 軸旋轉即等於世界 X 軸。
            // ============================================================================
            buildFanWalls() {
                // 由獨立檔案 fanwall.js 實作，以利精緻化
            },
            onMouseMove(e) {
                this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.interactables);
                
                const tooltip = document.getElementById('hover-tooltip');
                if (intersects.length > 0) {
                    document.body.style.cursor = 'pointer';
                    tooltip.style.opacity = 1;
                    tooltip.innerText = intersects[0].object.userData.name;
                    
                    tooltip.style.left = e.clientX + 'px';
                    const yOffset = e.clientY < 60 ? 20 : -150; 
                    tooltip.style.transform = `translate(-50%, ${yOffset}%)`;
                    tooltip.style.top = e.clientY + 'px';
                } else {
                    document.body.style.cursor = 'grab';
                    tooltip.style.opacity = 0;
                }
            },

            onClick(e) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.interactables);
                if (intersects.length > 0) {
                    const data = intersects[0].object.userData;
                    this.showDetail(data); // 僅保留顯示右側詳細資訊面板
                    
                    // 註解掉鏡頭移動的邏輯，避免誤觸導致鏡頭亂跑
                    /*
                    const targetPos = intersects[0].object.parent.position.clone();
                    
                    if(data.type === 'Rack') {
                        const isRowA = targetPos.z < 0; 
                        const frontZ = isRowA ? targetPos.z + 0.7 : targetPos.z - 0.7;
                        this.tweenCamera(
                            new THREE.Vector3(targetPos.x + 0.25, 1.05, frontZ),
                            new THREE.Vector3(targetPos.x, 1.0, targetPos.z)
                        );
                    } else if(data.type === 'CDU') {
                        this.tweenCamera(
                            new THREE.Vector3(targetPos.x + 1.2, 1.2, targetPos.z + 1.5),
                            new THREE.Vector3(targetPos.x, 0.9, targetPos.z)
                        );
                    }
                    */
                }
            },

            showDetail(data) {
                document.getElementById('hud-detail').classList.add('active');
                document.getElementById('detail-title').innerText = data.name;
                
                document.getElementById('detail-content-rack').style.display = data.type === 'Rack' ? 'block' : 'none';
                document.getElementById('detail-content-cdu').style.display = data.type === 'CDU' ? 'block' : 'none';
                
                if(data.type === 'Rack') {
                    // Rev F Phase F2：詳情面板依 rackType 顯示對應資訊與額定功率，內容來源為 userData
                    const RACK_TYPE_DESC = {
                        compute: 'VR200 COMPUTE ‧ 額定 240 kW ‧ 液冷(TCS)+ 輔助風冷',
                        switch:  'NVLINK SWITCH ‧ 光纖上行 ‧ 風冷',
                        power:   'POWER SIDECAR ‧ 直流母排饋電 ‧ 風冷',
                    };
                    document.getElementById('detail-subtitle').innerText = RACK_TYPE_DESC[data.rackType] || 'Vera Rubin NVL72 RACK';

                    const powerEl = document.querySelector('#detail-content-rack .live-val');
                    if (powerEl && data.ratedPower != null) {
                        powerEl.setAttribute('data-base', data.ratedPower.toFixed(1));
                        powerEl.innerText = data.ratedPower.toFixed(1);
                    }
                }
                if(data.type === 'CDU') document.getElementById('detail-subtitle').innerText = 'IN-ROW CDU 800kW';

                if (window.innerWidth <= 768 && this.leftHudVisible) {
                    this.leftHudVisible = false;
                    this.updateHudState();
                }
            },

            closeDetail() {
                document.getElementById('hud-detail').classList.remove('active');
            },

            setCamera(preset) {
                document.querySelectorAll('.btn-tool').forEach(b => {
                    if(b.id !== 'btn_toggle_pipes' && b.id !== 'btn_toggle_doors' && b.id !== 'btn_toggle_explode') {
                        b.classList.remove('active');
                    }
                });
                if(document.getElementById('cam_' + preset)) document.getElementById('cam_' + preset).classList.add('active');
                
                let cp, ct;
                if(preset === 'overview')    { cp = new THREE.Vector3(5, 4, 6);     ct = new THREE.Vector3(0, 1, 0); }
                else if(preset === 'aisle')  { cp = new THREE.Vector3(-9.2, 2.4, 4.8); ct = new THREE.Vector3(0.5, 1.1, -0.2); }
                else if(preset === 'hot_aisle') { cp = new THREE.Vector3(-3.2, 1.2, 0); ct = new THREE.Vector3(2.0, 1.2, 0); }
                else if(preset === 'rack_close') { 
                    cp = new THREE.Vector3(0.0, 1.1, 5.2);
                    ct = new THREE.Vector3(0.0, 1.1, 1.5);
                    if (!this.doorsOpen) {
                        this.toggleDoors();
                    }
                }
                else if(preset === 'cdu_close') { 
                    cp = new THREE.Vector3(-8.5, 1.4, 0.0);
                    ct = new THREE.Vector3(-4.5, 1.0, 0.0);
                }
                else if(preset === 'piping') { 
                    cp = new THREE.Vector3(-8.2, 3.5, 0.0);
                    ct = new THREE.Vector3(0.5, 1.8, 0.0);
                }
                else if(preset === 'fanwall_close') { 
                    cp = new THREE.Vector3(3.2, 1.8, 6.6);
                    ct = new THREE.Vector3(6.5, 1.0, 3.8);
                }
                
                if(cp && ct) this.tweenCamera(cp, ct);
            },

            tweenCamera(pos, target) {
                if(window.TWEEN) {
                    const dist = this.camera.position.distanceTo(pos);
                    const duration = Math.max(1500, Math.min(3000, dist * 150)); 
                    new TWEEN.Tween(this.camera.position).to({x: pos.x, y: pos.y, z: pos.z}, duration).easing(TWEEN.Easing.Cubic.InOut).start();
                    new TWEEN.Tween(this.controls.target).to({x: target.x, y: target.y, z: target.z}, duration).easing(TWEEN.Easing.Cubic.InOut).start();
                } else {
                    this.camera.position.copy(pos); this.controls.target.copy(target);
                }
            },

            togglePipes() {
                const btn = document.getElementById('btn_toggle_pipes');
                this.pipeGroup.visible = !this.pipeGroup.visible;
                if (this.layers.tcs) this.layers.tcs.visible = this.pipeGroup.visible;
                if(this.pipeGroup.visible) btn.classList.add('active');
                else btn.classList.remove('active');
            },

            toggleDoors() {
                this.doorsOpen = !this.doorsOpen;
                const btn = document.getElementById('btn_toggle_doors');
                
                if (this.doorsOpen) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="ph ph-door"></i> 關閉機門';
                } else {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="ph ph-door-open"></i> 機櫃開門';
                }
                
                const targetRot = this.doorsOpen ? (110 * Math.PI / 180) : 0;
                
                if (this.rackFrontDoors) {
                    this.rackFrontDoors.forEach(door => {
                        if (window.TWEEN) {
                            new TWEEN.Tween(door.rotation)
                                .to({ y: targetRot }, 1000)
                                .easing(TWEEN.Easing.Quadratic.InOut)
                                .start();
                        } else {
                            door.rotation.y = targetRot;
                        }
                    });
                }
            },

            // =====================================
            // 爆炸拆解 (Exploded View) 控制邏輯
            // =====================================
            // Rev F Phase F3（CLAUDE.md 第 5 條例外四授權）：重寫為模組級分層拆解 ——
            // 除了原本的 explodeShells/explodeInstancedMeshes 機櫃內部拆解，新增
            // updateExplodedView() 內的圖層垂直分層邏輯，兩套機制由同一個 progress 聯動。
            toggleExplode() {
                if (this._explodeAnimating) return; // 動畫進行中忽略重複觸發，避免 tween 疊加衝突
                this.isExploded = !this.isExploded;
                const btn = document.getElementById('btn_toggle_explode');

                if (this.isExploded) {
                    btn.classList.add('active');
                    if (!this.doorsOpen) this.toggleDoors();
                } else {
                    btn.classList.remove('active');
                }

                const targetVal = this.isExploded ? 1 : 0;

                if (window.TWEEN) {
                    this._explodeAnimating = true;
                    new TWEEN.Tween(this.explodeProgress)
                        .to({ val: targetVal }, 800)
                        .easing(TWEEN.Easing.Cubic.InOut)
                        .onUpdate(() => {
                            this.updateExplodedView();
                        })
                        .onComplete(() => {
                            this._explodeAnimating = false;
                        })
                        .start();
                }
            },

            updateExplodedView() {
                const progress = this.explodeProgress.val;
                
                // 1. 推開外殼與機櫃背部垂直管路
                if (this.explodeShells) {
                    this.explodeShells.forEach(shell => {
                        shell.position.copy(shell.userData.origPos).addScaledVector(shell.userData.explodeDir, progress);
                    });
                }
                
                // 2. 垂直分層展開托盤 (Instanced Meshes)
                if (this.explodeInstancedMeshes) {
                    this.explodeInstancedMeshes.forEach(mesh => {
                        if (!mesh.userData.isTrayComponent) return;
                        
                        const origMats = mesh.userData.originalMatrices;
                        for (let i = 0; i < origMats.length; i++) {
                            const origMat = origMats[i];
                            const yPos = origMat.elements[13]; 
                            const normalizedY = Math.max(0, (yPos + 1.0) / 2.0); 
                            
                            const explodeY = (normalizedY * 2.8) * progress;
                            const transMat = new THREE.Matrix4().makeTranslation(0, explodeY, 0);
                            const newMat = new THREE.Matrix4().multiplyMatrices(transMat, origMat);
                            
                            mesh.setMatrixAt(i, newMat);
                        }
                        mesh.instanceMatrix.needsUpdate = true;
                    });
                }

                // 3. 頂部冷卻主水管保持靜止不動 (依使用者要求：水管全部都不用動)
                if (this.pipeGroup) {
                    this.pipeGroup.children.forEach(pipe => {
                        if (pipe.userData.origPos) {
                            pipe.position.copy(pipe.userData.origPos);
                        }
                    });
                }

                // 4. 頂部母線槽系統 (Busways, Hangers, Conduits, Boxes) 往兩側與上方擴散
                if (this.buswayGroup) {
                    this.buswayGroup.children.forEach(item => {
                        if (!item.userData.origPos) {
                            item.userData.origPos = item.position.clone();

                            let explodeDir;
                            const isRowA = item.userData.row === 'A';
                            const zDir = isRowA ? -1.2 : 1.2;

                            if (item.userData.type === 'racktop') {
                                // Rack top input boxes move upwards with the rack top covers
                                explodeDir = new THREE.Vector3(0, 2.8, 0);
                            } else {
                                // Busways, hangers, tap-off boxes, and flexible conduits move outwards
                                explodeDir = new THREE.Vector3(0, 0, zDir);
                            }
                            item.userData.explodeDir = explodeDir;
                        }
                        item.position.copy(item.userData.origPos).addScaledVector(item.userData.explodeDir, progress);
                    });
                }

                // 5. Rev F Phase F3 新增：模組級分層拆解 —— 各系統圖層垂直升起，重現拆解圖效果。
                // racks（機櫃本體，實際上多數機櫃 mesh 是掛在 scene 根、不在此圖層內）與尚未建立的
                // fanwall 圖層不在下表中，維持 position.y = 0 不動；CDU 同樣是 scene 根物件，不隨任何
                // 圖層升起——riser 已確認掛在 this.layers.tcs（buildTCS 內 tcsGroup === this.layers.tcs）
                // 內，會隨 TCS 一起上升，展開時 riser 下端與靜止的 CDU 頂部之間出現分離空隙，
                // 為預期中的拆解圖表現（同備註 3 所述的可接受情況）。
                const EXPLODE_LAYER_TARGETS = {
                    powerTray: 2.6,
                    copperTray: 2.0,
                    fiberTray: 1.5,
                    containment: 1.0,
                    tcs: 0.5,
                };
                Object.keys(EXPLODE_LAYER_TARGETS).forEach(name => {
                    const layer = this.layers[name];
                    if (layer) layer.position.y = EXPLODE_LAYER_TARGETS[name] * progress;
                });
            },

            _snapshotMaterial(mat) {
                if (!mat) return null;
                const snap = { transparent: mat.transparent, opacity: mat.opacity, wireframe: !!mat.wireframe, emissiveIntensity: mat.emissiveIntensity };
                if (mat.color) snap.color = mat.color.getHex();
                if (mat.emissive) snap.emissive = mat.emissive.getHex();
                if (typeof mat.transmission !== 'undefined') snap.transmission = mat.transmission;
                if (typeof mat.visible !== 'undefined') snap.visible = mat.visible;
                return snap;
            },

            _restoreMaterial(mat, snap) {
                if (!mat || !snap) return;
                mat.transparent = snap.transparent;
                mat.opacity = snap.opacity;
                mat.wireframe = !!snap.wireframe;
                mat.emissiveIntensity = snap.emissiveIntensity;
                if (mat.color && typeof snap.color !== 'undefined') mat.color.setHex(snap.color);
                if (mat.emissive && typeof snap.emissive !== 'undefined') mat.emissive.setHex(snap.emissive);
                if (typeof mat.transmission !== 'undefined' && typeof snap.transmission !== 'undefined') mat.transmission = snap.transmission;
                if (typeof snap.visible !== 'undefined') mat.visible = snap.visible;
                mat.needsUpdate = true;
            },

            toggleCFD() {
                try {
                    this.cfdMode = !this.cfdMode;
                    const btn = document.getElementById('btn_toggle_cfd');
                    if (this.cfdMode) {
                        if (btn) btn.classList.add('active');
                        if (this.scene && this.scene.background && typeof this.scene.background.setHex === 'function') {
                            this.scene.background.setHex(0x020612);
                        }
                        if (this.scene && this.scene.fog && this.scene.fog.color && typeof this.scene.fog.color.setHex === 'function') {
                            this.scene.fog.color.setHex(0x020612);
                        }
                        
                        // Dim standard lights
                        if (this.scene && typeof this.scene.traverse === 'function') {
                            this.scene.traverse(child => {
                                if (child.isAmbientLight) {
                                    child.intensity = 0.5;
                                } else if (child.isDirectionalLight) {
                                    child.intensity = 0.2;
                                } else if (child.isPointLight || child.isSpotLight) {
                                    if (child.userData && !child.userData.isCduLight && !child.userData.isInternalLight) {
                                        child.intensity = 0.1;
                                    }
                                }
                            });
                        }

                        // ─── Snapshot original material states before CFD mode changes ───
                        if (!this._cfdMatSnapshot && this.materials) {
                            this._cfdMatSnapshot = {};
                            const keys = ['rackFrame','glassDoor','meshDoor','containmentFrame','containmentPanel',
                                          'busway','buswayBox','buswayConduit','buswayHanger','blueFeed','redFeed',
                                          'copperDetail','darkMetal','pipeBlueM','pipeRedM'];
                            keys.forEach(k => { if (this.materials[k]) this._cfdMatSnapshot[k] = this._snapshotMaterial(this.materials[k]); });
                        }

                        // Make structural elements semi-transparent wireframe or dark blue lines
                        if (this.materials) {
                            if (this.materials.rackFrame) {
                                this.materials.rackFrame.wireframe = true;
                                if (this.materials.rackFrame.color && typeof this.materials.rackFrame.color.setHex === 'function') {
                                    this.materials.rackFrame.color.setHex(0x0f3670);
                                }
                                if (this.materials.rackFrame.emissive && typeof this.materials.rackFrame.emissive.setHex === 'function') {
                                    this.materials.rackFrame.emissive.setHex(0x051d3b);
                                }
                                this.materials.rackFrame.emissiveIntensity = 0.8;
                                this.materials.rackFrame.needsUpdate = true;
                            }
                            if (this.materials.glassDoor) { this.materials.glassDoor.visible = false; }
                            if (this.materials.meshDoor) { this.materials.meshDoor.visible = false; }

                        // Ensure busway and containment groups are visible during CFD
                        if (this.buswayGroup) this.buswayGroup.visible = true;
                        if (this.containGroup) this.containGroup.visible = true;

                            // Style containment panel and frame for CFD mode
                            // Use BRIGHT OPAQUE glowing cyan — dark+transparent was invisible on dark CFD bg
                            if (this.materials.containmentFrame) {
                                this.materials.containmentFrame.wireframe = false;
                                this.materials.containmentFrame.transparent = false;
                                this.materials.containmentFrame.opacity = 1.0;
                                if (this.materials.containmentFrame.color && typeof this.materials.containmentFrame.color.setHex === 'function') {
                                    this.materials.containmentFrame.color.setHex(0x0369a1); // medium blue
                                }
                                if (this.materials.containmentFrame.emissive && typeof this.materials.containmentFrame.emissive.setHex === 'function') {
                                    this.materials.containmentFrame.emissive.setHex(0x0ea5e9); // bright cyan glow
                                }
                                this.materials.containmentFrame.emissiveIntensity = 1.8;
                                this.materials.containmentFrame.needsUpdate = true;
                            }
                            if (this.materials.containmentPanel) {
                                this.materials.containmentPanel.transmission = 0.0;
                                this.materials.containmentPanel.transparent = true;
                                this.materials.containmentPanel.opacity = 0.55;
                                if (this.materials.containmentPanel.color && typeof this.materials.containmentPanel.color.setHex === 'function') {
                                    this.materials.containmentPanel.color.setHex(0x38bdf8); // bright sky blue
                                }
                                if (this.materials.containmentPanel.emissive && typeof this.materials.containmentPanel.emissive.setHex === 'function') {
                                    this.materials.containmentPanel.emissive.setHex(0x0ea5e9); // bright cyan glow
                                }
                                this.materials.containmentPanel.emissiveIntensity = 1.2;
                                this.materials.containmentPanel.needsUpdate = true;
                            }

                            // Style busways for CFD mode — BRIGHT OPAQUE so they're visible on dark bg
                            if (this.materials.busway) {
                                this.materials.busway.wireframe = false;
                                this.materials.busway.transparent = false;
                                this.materials.busway.opacity = 1.0;
                                if (this.materials.busway.color && typeof this.materials.busway.color.setHex === 'function') {
                                    this.materials.busway.color.setHex(0x075985); // dark teal-blue base
                                }
                                if (this.materials.busway.emissive && typeof this.materials.busway.emissive.setHex === 'function') {
                                    this.materials.busway.emissive.setHex(0x0ea5e9); // bright sky-blue glow
                                }
                                this.materials.busway.emissiveIntensity = 2.0;
                                this.materials.busway.needsUpdate = true;
                            }
                            if (this.materials.buswayBox) {
                                this.materials.buswayBox.wireframe = false;
                                this.materials.buswayBox.transparent = false;
                                this.materials.buswayBox.opacity = 1.0;
                                if (this.materials.buswayBox.color && typeof this.materials.buswayBox.color.setHex === 'function') {
                                    this.materials.buswayBox.color.setHex(0x0c4a6e); // deep blue
                                }
                                if (this.materials.buswayBox.emissive && typeof this.materials.buswayBox.emissive.setHex === 'function') {
                                    this.materials.buswayBox.emissive.setHex(0x38bdf8); // light cyan glow
                                }
                                this.materials.buswayBox.emissiveIntensity = 1.8;
                                this.materials.buswayBox.needsUpdate = true;
                            }
                            if (this.materials.buswayConduit) {
                                this.materials.buswayConduit.wireframe = false;
                                this.materials.buswayConduit.transparent = false;
                                this.materials.buswayConduit.opacity = 1.0;
                                if (this.materials.buswayConduit.color && typeof this.materials.buswayConduit.color.setHex === 'function') {
                                    this.materials.buswayConduit.color.setHex(0x0369a1); // medium teal-blue
                                }
                                if (this.materials.buswayConduit.emissive && typeof this.materials.buswayConduit.emissive.setHex === 'function') {
                                    this.materials.buswayConduit.emissive.setHex(0x0ea5e9);
                                }
                                this.materials.buswayConduit.emissiveIntensity = 1.8;
                                this.materials.buswayConduit.needsUpdate = true;
                            }
                            if (this.materials.buswayHanger) {
                                this.materials.buswayHanger.wireframe = false;
                                this.materials.buswayHanger.transparent = false;
                                this.materials.buswayHanger.opacity = 1.0;
                                if (this.materials.buswayHanger.color && typeof this.materials.buswayHanger.color.setHex === 'function') {
                                    this.materials.buswayHanger.color.setHex(0x0284c7); // bright blue
                                }
                                if (this.materials.buswayHanger.emissive && typeof this.materials.buswayHanger.emissive.setHex === 'function') {
                                    this.materials.buswayHanger.emissive.setHex(0x7dd3fc); // pale blue glow
                                }
                                this.materials.buswayHanger.emissiveIntensity = 1.2;
                                this.materials.buswayHanger.needsUpdate = true;
                            }
                            if (this.materials.blueFeed) {
                                if (this.materials.blueFeed.emissive && typeof this.materials.blueFeed.emissive.setHex === 'function') {
                                    this.materials.blueFeed.emissive.setHex(0x0055bb);
                                }
                                this.materials.blueFeed.emissiveIntensity = 1.2;
                                this.materials.blueFeed.needsUpdate = true;
                            }
                            if (this.materials.redFeed) {
                                if (this.materials.redFeed.emissive && typeof this.materials.redFeed.emissive.setHex === 'function') {
                                    this.materials.redFeed.emissive.setHex(0xcc2200);
                                }
                                this.materials.redFeed.emissiveIntensity = 1.2;
                                this.materials.redFeed.needsUpdate = true;
                            }
                        }

                        // Color code compute trays inside the Compute Racks (and other racks)
                        const tempColor = new THREE.Color();
                        if (this.explodeInstancedMeshes) {
                            this.explodeInstancedMeshes.forEach(mesh => {
                                if (mesh.userData && mesh.userData.isTrayComponent && typeof mesh.setColorAt === 'function') {
                                    for (let i = 0; i < mesh.count; i++) {
                                        const mat = new THREE.Matrix4();
                                        mesh.getMatrixAt(i, mat);
                                        if (mat.elements) {
                                            const yPos = mat.elements[13]; 
                                            const t = Math.max(0, Math.min(1.0, (yPos + 0.8) / 1.6));
                                            // Interpolate blue (t=0) -> green (t=0.3) -> yellow (t=0.6) -> red (t=1.0)
                                            let hue;
                                            if (t < 0.5) {
                                                hue = 0.65 - (t * 2.0) * 0.45; // linear transition from 0.65 (blue) to 0.2 (yellow)
                                            } else {
                                                hue = 0.2 - ((t - 0.5) * 2.0) * 0.2; // linear transition from 0.2 (yellow) to 0.0 (red)
                                            }
                                            tempColor.setHSL(hue, 1.0, 0.5);
                                            mesh.setColorAt(i, tempColor);
                                        }
                                    }
                                    if (mesh.instanceColor) {
                                        mesh.instanceColor.needsUpdate = true;
                                    }
                                }
                            });
                        }

                        // Make materials emissive
                        if (this.materials) {
                            if (this.materials.copperDetail) {
                                if (this.materials.copperDetail.color && typeof this.materials.copperDetail.color.setHex === 'function') {
                                    this.materials.copperDetail.color.setHex(0xffffff);
                                }
                                if (this.materials.copperDetail.emissive && typeof this.materials.copperDetail.emissive.setHex === 'function') {
                                    this.materials.copperDetail.emissive.setHex(0xaaaaaa);
                                }
                                this.materials.copperDetail.emissiveIntensity = 0.8;
                                this.materials.copperDetail.needsUpdate = true;
                            }
                            if (this.materials.darkMetal) {
                                if (this.materials.darkMetal.color && typeof this.materials.darkMetal.color.setHex === 'function') {
                                    this.materials.darkMetal.color.setHex(0x0b1a3a);
                                }
                                this.materials.darkMetal.wireframe = true;
                                if (this.materials.darkMetal.emissive && typeof this.materials.darkMetal.emissive.setHex === 'function') {
                                    this.materials.darkMetal.emissive.setHex(0x051d3b);
                                }
                                this.materials.darkMetal.emissiveIntensity = 0.8;
                                this.materials.darkMetal.needsUpdate = true;
                            }
                        }

                        if (this.cfdParticles) {
                            this.cfdParticles.visible = true;
                        } else {
                            this.createCfdParticles();
                        }
                        // Show liquid cold plate CFD visualization
                        if (this.coldPlateCfdGroups) {
                            this.coldPlateCfdGroups.forEach(g => { if (g) g.visible = true; });
                        }
                        // Boost spine manifold pipe glow in CFD mode
                        if (this.materials) {
                            if (this.materials.pipeBlueM) {
                                this.materials.pipeBlueM.emissiveIntensity = 1.8;
                                this.materials.pipeBlueM.needsUpdate = true;
                            }
                            if (this.materials.pipeRedM) {
                                this.materials.pipeRedM.emissiveIntensity = 1.6;
                                this.materials.pipeRedM.needsUpdate = true;
                            }
                        }
                    } else {
                        // 取消模擬時直接 reload 頁面，確保 100% 還原所有狀態
                        window.location.reload();
                    }
                } catch (e) {
                    console.error('[toggleCFD Error]', e);
                }
            },

            createCfdParticles() {
                try {
                    const particleCount = 500;
                    const geometry = new THREE.BufferGeometry();
                    const positions = new Float32Array(particleCount * 3);
                    const colors = new Float32Array(particleCount * 3);
                    const velocities = [];
                    const types = []; // 0 = cold, 1 = hot

                    const colorCold = new THREE.Color(0x00d2ff);
                    const colorHot = new THREE.Color(0xff3300);

                    for (let i = 0; i < particleCount; i++) {
                        const isHot = Math.random() > 0.45;
                        types.push(isHot ? 1 : 0);

                        if (isHot) {
                            // Rising in the hot aisle (center Z = 0)
                            const x = (Math.random() - 0.5) * 3.2;
                            const y = Math.random() * 3.8;
                            const z = (Math.random() - 0.5) * 1.2; // hot aisle width = 1.2m
                            positions[i * 3] = x;
                            positions[i * 3 + 1] = y;
                            positions[i * 3 + 2] = z;

                            velocities.push(new THREE.Vector3(
                                (Math.random() - 0.5) * 0.08,
                                0.3 + Math.random() * 0.4, // rising
                                (Math.random() - 0.5) * 0.08
                            ));

                            colors[i * 3] = colorHot.r;
                            colors[i * 3 + 1] = colorHot.g;
                            colors[i * 3 + 2] = colorHot.b;
                        } else {
                            // Inflow from cold aisles (Z = -1.8 or Z = 1.8)
                            const side = Math.random() > 0.5 ? 1.0 : -1.0;
                            const x = (Math.random() - 0.5) * 3.2;
                            const y = Math.random() * 1.9;
                            const z = side * (1.8 + Math.random() * 0.8);
                            positions[i * 3] = x;
                            positions[i * 3 + 1] = y;
                            positions[i * 3 + 2] = z;

                            velocities.push(new THREE.Vector3(
                                (Math.random() - 0.5) * 0.05,
                                (Math.random() - 0.5) * 0.05,
                                -side * (0.2 + Math.random() * 0.35) // flow inward to racks
                            ));

                            colors[i * 3] = colorCold.r;
                            colors[i * 3 + 1] = colorCold.g;
                            colors[i * 3 + 2] = colorCold.b;
                        }
                    }

                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

                    const pMaterial = new THREE.PointsMaterial({
                        size: 0.07,
                        vertexColors: true,
                        transparent: true,
                        opacity: 0.8,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });

                    this.cfdParticles = new THREE.Points(geometry, pMaterial);
                    this.cfdParticles.userData = { velocities, types };
                    this.scene.add(this.cfdParticles);
                } catch (e) {
                    console.error('[createCfdParticles Error]', e);
                }
            },

            updateCfdParticles(dt) {
                try {
                    if (!this.cfdParticles || !this.cfdMode) return;

                    const posAttr = this.cfdParticles.geometry ? this.cfdParticles.geometry.attributes.position : null;
                    if (!posAttr) return;
                    const positions = posAttr.array;
                    const userData = this.cfdParticles.userData || {};
                    const velocities = userData.velocities || [];
                    const types = userData.types || [];
                    const count = posAttr.count;

                    for (let i = 0; i < count; i++) {
                        if (!velocities[i]) continue;
                        positions[i * 3] += velocities[i].x * dt * 2.0;
                        positions[i * 3 + 1] += velocities[i].y * dt * 2.0;
                        positions[i * 3 + 2] += velocities[i].z * dt * 2.0;

                        const isHot = types[i] === 1;
                        if (isHot) {
                            // Reset if reaches top
                            if (positions[i * 3 + 1] > 3.9) {
                                positions[i * 3] = (Math.random() - 0.5) * 3.2;
                                positions[i * 3 + 1] = 0.1;
                                positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
                            }
                        } else {
                            // Reset if reaches rack area
                            if (Math.abs(positions[i * 3 + 2]) < 1.2) {
                                const side = Math.random() > 0.5 ? 1.0 : -1.0;
                                positions[i * 3] = (Math.random() - 0.5) * 3.2;
                                positions[i * 3 + 1] = Math.random() * 1.9;
                                positions[i * 3 + 2] = side * (1.8 + Math.random() * 0.8);
                            }
                        }
                    }
                    posAttr.needsUpdate = true;
                } catch (e) {
                    console.error('[updateCfdParticles Error]', e);
                }
            },

            toggleLeakAlarm() {
                this.leakAlarm = !this.leakAlarm;
                const btn = document.getElementById('btn_toggle_leak');
                const banner = document.getElementById('leak-alert-banner');
                
                if (this.leakAlarm) {
                    if (btn) btn.classList.add('active');
                    if (banner) banner.classList.remove('hidden');
                } else {
                    if (btn) btn.classList.remove('active');
                    if (banner) banner.classList.add('hidden');
                }
                
                this.updateCduScreen();
            },

            updateCduScreen() {
                if (!this.textures.cduScreen) return;
                const canvas = this.textures.cduScreen.image;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#020617'; ctx.fillRect(0,0,512,256);
                
                if (this.leakAlarm) {
                    ctx.fillStyle = '#ef4444'; ctx.fillRect(0,0,512,30);
                    ctx.fillStyle = '#000'; ctx.font = 'bold 18px monospace'; ctx.fillText('CDU CONTROL PANEL - ERROR', 10, 22);
                    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 36px monospace'; ctx.fillText('⚠️ LEAK ALARM', 20, 95);
                    ctx.fillStyle = '#fff'; ctx.font = '18px monospace'; ctx.fillText('ZONE: Row A Aisle Rear', 20, 150);
                    ctx.fillText('ACTION: Check floor sensors', 20, 180);
                    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 18px monospace'; ctx.fillText('● WATER DETECTED IN AISLE', 20, 230);
                } else {
                    ctx.fillStyle = '#76b900'; ctx.fillRect(0,0,512,30);
                    ctx.fillStyle = '#000'; ctx.font = 'bold 18px monospace'; ctx.fillText('CDU CONTROL PANEL v3.2', 10, 22);
                    ctx.fillStyle = '#0ea5e9'; ctx.font = 'bold 28px monospace'; ctx.fillText('SUPPLY: 45.0°C', 20, 80);
                    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 28px monospace'; ctx.fillText('RETURN: 55.0°C', 20, 120);
                    ctx.fillStyle = '#fff'; ctx.font = '20px monospace'; ctx.fillText('FLOW: 320.0 L/min', 20, 165);
                    ctx.fillText('PRESS: 2.45 Bar', 20, 200);
                    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 16px monospace'; ctx.fillText('● ALL SYSTEMS NOMINAL', 20, 240);
                }
                this.textures.cduScreen.needsUpdate = true;
            },

            animate() {
                requestAnimationFrame(() => this.animate());
                if(window.TWEEN) TWEEN.update();
                
                const time = this.clock.getElapsedTime();
                const dt = Math.min(this.clock.getDelta(), 0.1);
                
                this.controls.update();

                // Animating Fluid Flow
                if (this.textures) {
                    if (this.textures.flowBlue) this.textures.flowBlue.offset.y -= 0.015;
                    if (this.textures.flowRed) this.textures.flowRed.offset.y -= 0.015;
                }

                // Update CFD particles
                if (this.cfdMode) {
                    this.updateCfdParticles(dt);
                }

                // Update Leak Sensor colors
                if (this.materials && this.materials.leakSensor) {
                    if (this.leakAlarm) {
                        const pulse = (Math.sin(time * 8.0) * 0.5 + 0.5);
                        this.materials.leakSensor.color.setRGB(1.0, pulse * 0.25, pulse * 0.25);
                        this.materials.leakSensor.emissive.setRGB(1.0, 0.0, 0.0);
                        this.materials.leakSensor.emissiveIntensity = pulse * 1.5;
                    } else {
                        this.materials.leakSensor.color.setHex(0x22d3ee);
                        this.materials.leakSensor.emissive.setHex(0x000000);
                        this.materials.leakSensor.emissiveIntensity = 0.0;
                    }
                }

                // Update CDU Indicators
                if (this.cduIndicators) {
                    this.cduIndicators.forEach(ind => {
                        if (this.leakAlarm) {
                            const pulse = (Math.sin(time * 8.0) * 0.5 + 0.5) > 0.5;
                            ind.green.material.color.setHex(0x0a220a); // dark green
                            ind.red.material.color.setHex(pulse ? 0xef4444 : 0x3b0712); // flashing red
                            ind.yellow.material.color.setHex(0x3b2e0a); // dark yellow
                        } else {
                            ind.green.material.color.setHex(0x22c55e);
                            ind.red.material.color.setHex(0x3b0712);
                            ind.yellow.material.color.setHex(0x3b2e0a);
                        }
                    });
                }

                this.scene.traverse((child) => {
                    if(child.userData && child.userData.isLed) {
                        const intensity = (Math.sin(time * 3 + child.userData.offset) * 0.5 + 0.5) * 0.8 + 0.2;
                        child.material.color.setHex(child.userData.offset > 1 ? 0xfbbf24 : 0x76b900);
                        child.material.color.multiplyScalar(intensity);
                    }
                });

                // Rev F Phase F4：風牆風機轉子持續自旋（面朝 -x，繞局部/世界 X 軸旋轉）
                if (this.fanRotors) {
                    this.fanRotors.forEach(rotor => { rotor.rotation.x += 0.15; });
                }

                try {
                    this.renderer.render(this.scene, this.camera);
                } catch (e) {
                    console.error('[Render Error]', e);
                }
            }
        };

        window.onload = () => DTC.init();

        // Listen to coupling message from portal
        window.addEventListener('message', (event) => {
            if (event.source !== window.parent) return;
            const msg = event.data;
            if (msg.type === 'coupled_data') {
                DTC.applyCoupledData(msg.data);
            }
        });