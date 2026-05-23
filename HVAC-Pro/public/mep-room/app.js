const APP = {
            scene: null, camera: null, renderer: null, controls: null,
            clock: new THREE.Clock(), raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
            interactables: [], materials: {}, textures: {}, leftHudVisible: window.innerWidth > 768, simPanelOpen: false,
            flowMeshes: [], currentScenario: 'normal', selectedEquipment: null, chillerPower: 137,
            scenarios: {
                normal: {
                    name: '正常供電',
                    note: '市電雙路供應至 MSB，UPS 在線雙轉換供電，電池維持浮充，發電機待命。',
                    source: 'UTILITY A/B ONLINE', icon: 'ph-check-circle', accent: '#22c55e',
                    gridKW: 1450, upsKW: 1250, batterySOC: 100,
                    generatorStatus: 'Standby', upsStatus: 'Online Double Conversion', batteryStatus: 'Float Charge',
                    pduStatus: 'Utility Normal', flow: { utility: 1, upsOutput: 1, generator: 0.08, bypass: 0.1 }
                },
                utilityFail: {
                    name: '市電中斷',
                    note: '市電進線失壓，UPS 立即由電池維持 IT 負載；ATS 發出發電機啟動命令。',
                    source: 'UPS ON BATTERY', icon: 'ph-warning', accent: '#ef4444',
                    gridKW: 0, upsKW: 1250, batterySOC: 87,
                    generatorStatus: 'Cranking', upsStatus: 'Battery Discharge', batteryStatus: 'Discharging',
                    pduStatus: 'Utility Loss / UPS Holding', flow: { utility: 0.02, upsOutput: 1, generator: 0.45, bypass: 0.05 }
                },
                generator: {
                    name: '發電機供電',
                    note: 'EDG 達額定電壓與頻率後 ATS 切換，MSB 改由發電機側供應，UPS 回復整流與充電。',
                    source: 'GENERATOR SOURCE ACTIVE', icon: 'ph-engine', accent: '#f97316',
                    gridKW: 0, upsKW: 1250, batterySOC: 92,
                    generatorStatus: 'Running / Supplying', upsStatus: 'Rectifier on Generator', batteryStatus: 'Recharge',
                    pduStatus: 'Generator Source', flow: { utility: 0.02, upsOutput: 0.95, generator: 1, bypass: 0.08 }
                },
                bypass: {
                    name: '維修旁路',
                    note: 'UPS 模組隔離檢修，負載經維修旁路供應；此模式需受控操作並降低冗餘容錯。',
                    source: 'MAINTENANCE BYPASS CLOSED', icon: 'ph-wrench', accent: '#f59e0b',
                    gridKW: 1380, upsKW: 0, batterySOC: 100,
                    generatorStatus: 'Standby', upsStatus: 'Maintenance Bypass', batteryStatus: 'Isolated / Float',
                    pduStatus: 'Bypass Feeder Closed', flow: { utility: 1, upsOutput: 0.06, generator: 0.05, bypass: 1 }
                }
            },

            init() {
                const con = document.getElementById('canvas-container');
                this.scene = new THREE.Scene();
                this.scene.background = new THREE.Color(0x080c14); 
                this.scene.fog = new THREE.FogExp2(0x080c14, 0.012);

                this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.camera.position.set(15, 12, 18);

                this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 1.1;
                con.appendChild(this.renderer.domElement);

                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true; this.controls.dampingFactor = 0.05;
                this.controls.maxPolarAngle = Math.PI / 2 - 0.01;

                this.createMaterials();
                this.setupLighting();
                this.buildEnvironment();
                this.buildGreySpace();

                window.addEventListener('resize', () => this.resize());
                con.addEventListener('mousemove', (e) => this.onMouseMove(e));
                con.addEventListener('click', (e) => this.onClick(e));

                this.animate();
                setInterval(this.updateLiveValues, 1500);
                this.calculateBattery();
                this.setScenario('normal');
                this.updateHudState();
            },

            createMaterials() {
                this.materials.floor = new THREE.MeshStandardMaterial({ color: 0x020408, metalness: 0.3, roughness: 0.7 });
                this.materials.cabinet = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 });
                this.materials.darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.35 });
                this.materials.greenLed = new THREE.MeshBasicMaterial({ color: 0x22c55e });
                this.materials.yellowLed = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
                this.materials.redLed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
                this.materials.tray = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
                this.materials.copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.95, roughness: 0.15 });
                this.materials.aluminum = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.75, roughness: 0.35 });
                this.materials.yellowGreen = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.8 });
                this.materials.generatorYellow = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6, roughness: 0.3 });
                this.materials.exhaustPipe = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.5 });
                this.materials.rubber = new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.85 });
                this.materials.phaseR = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.55, roughness: 0.25 });
                this.materials.phaseS = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.55, roughness: 0.25 });
                this.materials.phaseT = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.55, roughness: 0.25 });
                this.materials.neutral = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.35, roughness: 0.4 });
                this.materials.warning = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });

                // 高精度 UPS LCD 螢幕貼圖
                const c = document.createElement('canvas'); c.width = 512; c.height = 256;
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#010c1a'; ctx.fillRect(0,0,512,256);
                // 標題列
                ctx.fillStyle = '#1e293b'; ctx.fillRect(0,0,512,40);
                ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 20px monospace'; ctx.fillText('● UPS ONLINE — DOUBLE CONVERSION', 14, 27);
                // 數據
                ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 32px monospace'; ctx.fillText('LOAD: 62.5 %', 20, 90);
                ctx.fillStyle = '#38bdf8'; ctx.fillText('BATT: 100 %  SOH: 98%', 20, 135);
                ctx.fillStyle = '#e2e8f0'; ctx.font = '20px monospace'; ctx.fillText('OUT: 380V  60.01Hz', 20, 180);
                ctx.fillStyle = '#22c55e'; ctx.font = 'bold 18px monospace'; ctx.fillText('● ALL SYSTEMS NOMINAL', 20, 225);
                this.textures.upsScreen = new THREE.CanvasTexture(c);
            },

            createLabelTexture(lines, opts = {}) {
                const c = document.createElement('canvas');
                c.width = opts.width || 512;
                c.height = opts.height || 160;
                const ctx = c.getContext('2d');
                const textLines = Array.isArray(lines) ? lines : String(lines).split('\n');
                ctx.fillStyle = opts.bg || 'rgba(8,12,20,0.92)';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.strokeStyle = opts.border || '#94a3b8';
                ctx.lineWidth = opts.borderWidth || 6;
                ctx.strokeRect(4, 4, c.width - 8, c.height - 8);
                ctx.fillStyle = opts.color || '#e2e8f0';
                ctx.font = opts.font || 'bold 38px "Segoe UI", sans-serif';
                ctx.textAlign = opts.align || 'center';
                ctx.textBaseline = 'middle';
                const lineHeight = opts.lineHeight || 44;
                const startY = c.height / 2 - ((textLines.length - 1) * lineHeight) / 2;
                textLines.forEach((line, idx) => {
                    ctx.fillText(line, c.width / 2, startY + idx * lineHeight);
                });
                const tex = new THREE.CanvasTexture(c);
                tex.anisotropy = 4;
                return tex;
            },

            addLabelPlane(parent, lines, width, height, position, opts = {}) {
                const label = new THREE.Mesh(
                    new THREE.PlaneGeometry(width, height),
                    new THREE.MeshBasicMaterial({
                        map: this.createLabelTexture(lines, opts),
                        transparent: true,
                        side: THREE.DoubleSide
                    })
                );
                label.position.set(position.x, position.y, position.z);
                if (opts.rotation) label.rotation.set(opts.rotation.x || 0, opts.rotation.y || 0, opts.rotation.z || 0);
                parent.add(label);
                return label;
            },

            addDoorFrame(parent, width, height, z, centerY = 1.14, opts = {}) {
                const mat = opts.material || this.materials.darkMetal;
                const t = opts.thickness || 0.018;
                const d = opts.depth || 0.018;
                const yTop = centerY + height / 2;
                const yBottom = centerY - height / 2;
                const xLeft = -width / 2;
                const xRight = width / 2;
                [
                    { size: [t, height, d], pos: [xLeft, centerY, z] },
                    { size: [t, height, d], pos: [xRight, centerY, z] },
                    { size: [width, t, d], pos: [0, yTop, z] },
                    { size: [width, t, d], pos: [0, yBottom, z] },
                    { size: [t, height * 0.92, d], pos: [0, centerY, z] }
                ].forEach(part => {
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...part.size), mat);
                    mesh.position.set(...part.pos);
                    parent.add(mesh);
                });
            },

            addCabinetHardware(parent, frontZ, side = 1) {
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.035), this.materials.aluminum);
                handle.position.set(0.28 * side, 1.17, frontZ);
                parent.add(handle);
                [0.52, 1.18, 1.84].forEach(y => {
                    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.026), this.materials.aluminum);
                    hinge.position.set(-0.37 * side, y, frontZ);
                    parent.add(hinge);
                });
            },

            makeEquipmentData(type, name, tag, rating, role, upstream, downstream, maintenance, extras = {}) {
                return { type, name, tag, rating, role, upstream, downstream, maintenance, ...extras };
            },

            getScenarioStatus(data) {
                const scenario = this.scenarios[this.currentScenario] || this.scenarios.normal;
                if (data.type === 'UPS') return scenario.upsStatus;
                if (data.type === 'Battery') return scenario.batteryStatus;
                if (data.type === 'Generator') return scenario.generatorStatus;
                if (data.type === 'PDU') return scenario.pduStatus;
                return 'Normal';
            },

            getScenarioNote(data) {
                const scenario = this.scenarios[this.currentScenario] || this.scenarios.normal;
                return `${scenario.name}：${scenario.note}`;
            },

            setupLighting() {
                // 環境基礎光（壓暗，對齊白區風格）
                this.scene.add(new THREE.AmbientLight(0x4a5568, 2.0));

                // 主方向光
                const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
                mainLight.position.set(4, 10, 5); mainLight.castShadow = true;
                mainLight.shadow.mapSize.set(2048, 2048);
                mainLight.shadow.camera.left = -14; mainLight.shadow.camera.right = 14;
                mainLight.shadow.camera.top = 14; mainLight.shadow.camera.bottom = -14;
                mainLight.shadow.bias = -0.001;
                this.scene.add(mainLight);

                // 補光
                const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
                fillLight.position.set(-6, 8, -4); this.scene.add(fillLight);

                // SpotLight — 照 UPS A 排
                const spot1 = new THREE.SpotLight(0xffffff, 2.0, 18, 0.55, 0.5, 1.2);
                spot1.position.set(-3.5, 5, 2); spot1.target.position.set(-3.5, 1, 0);
                this.scene.add(spot1); this.scene.add(spot1.target);

                // SpotLight — 照 UPS B 排
                const spot2 = new THREE.SpotLight(0xffffff, 2.0, 18, 0.55, 0.5, 1.2);
                spot2.position.set(3.5, 5, 2); spot2.target.position.set(3.5, 1, 0);
                this.scene.add(spot2); this.scene.add(spot2.target);

                // SpotLight — 照配電盤區
                const spot3 = new THREE.SpotLight(0xffd700, 1.2, 12, 0.5, 0.6, 1.5);
                spot3.position.set(0, 5, -3); spot3.target.position.set(0, 1, -5);
                this.scene.add(spot3); this.scene.add(spot3.target);

                // UPS 面板黃金色發光輝光
                const upsGlowA = new THREE.PointLight(0xf59e0b, 0.8, 4);
                upsGlowA.position.set(-3.5, 1.8, 0.6); this.scene.add(upsGlowA);
                const upsGlowB = new THREE.PointLight(0xf59e0b, 0.8, 4);
                upsGlowB.position.set(3.5, 1.8, 0.6); this.scene.add(upsGlowB);
            },

            buildEnvironment() {
                // 深色環氧地板（對齊白區）
                const floor = new THREE.Mesh(
                    new THREE.PlaneGeometry(34, 26),
                    new THREE.MeshStandardMaterial({ color: 0x020408, metalness: 0.3, roughness: 0.7 })
                );
                floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
                this.scene.add(floor);

                // 地面電力分區標線：降低存在感，避免與電纜線路混在一起。
                const lineMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.22 });
                [[-4.8, 0.012, 0], [4.8, 0.012, 0]].forEach(p => {
                    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 9.5), lineMat);
                    line.rotation.x = -Math.PI / 2;
                    line.position.set(p[0], p[1], p[2]);
                    this.scene.add(line);
                });

                // 天花板
                const ceil = new THREE.Mesh(
                    new THREE.PlaneGeometry(34, 26),
                    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
                );
                ceil.rotation.x = Math.PI / 2; ceil.position.y = 5.5; this.scene.add(ceil);

                // 自發光天花板燈管 Mesh（對齊白區的 emissive fixture）
                const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 });
                [[-4, 5.45, 0], [0, 5.45, 0], [4, 5.45, 0], [0, 5.45, -4]].forEach(p => {
                    const fx = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.18), fixtureMat);
                    fx.position.set(p[0], p[1], p[2]); this.scene.add(fx);
                    const pt = new THREE.PointLight(0xffffff, 1.0, 8);
                    pt.position.set(p[0], p[1] - 0.1, p[2]); this.scene.add(pt);
                });

                // 結構柱
                const colGeo = new THREE.BoxGeometry(0.4, 5.5, 0.4);
                const colMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
                [[-7, 2.75, 6], [7, 2.75, 6], [-7, 2.75, -7], [7, 2.75, -7]].forEach(p => {
                    const col = new THREE.Mesh(colGeo, colMat);
                    col.position.set(p[0], p[1], p[2]); this.scene.add(col);
                });

                // 右側牆面（x=9.5，室內外分界）
                const rightWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(14, 5.5),
                    new THREE.MeshStandardMaterial({ 
                        color: 0x1e293b, roughness: 0.8, 
                        transparent: true, opacity: 0.55,
                        side: THREE.DoubleSide
                    })
                );
                rightWall.rotation.y = -Math.PI / 2;
                rightWall.position.set(9.5, 2.75, -1.0);
                this.scene.add(rightWall);

                // 穿牆開口框架
                const openingFrame = new THREE.Mesh(
                    new THREE.BoxGeometry(0.12, 0.4, 0.8),
                    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 })
                );
                openingFrame.position.set(9.5, 1.5, -5.0);
                this.scene.add(openingFrame);

                // 接地排（銅排 + 黃綠斑馬紋）
                const earthBar = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.18), this.materials.copper);
                earthBar.position.set(0, 0.03, -4.5); this.scene.add(earthBar);
                for(let i = 0; i < 20; i++) {
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.19), this.materials.yellowGreen);
                    stripe.position.set(-4.8 + i * 0.5, 0.03, -4.5); this.scene.add(stripe);
                }
            },

            buildGreySpace() {
                // 建立 UPS 與 電池櫃 (2N 架構：左排 A-Feed, 右排 B-Feed)
                const createUPSGroup = (xOffset, labelPrefix) => {
                    for(let i=0; i<2; i++) {
                        const zPos = -1.5 + i * 3.5;
                        
                        // UPS 主機
                        const ups = new THREE.Group();
                        
                        // 主體加一點基座厚度
                        const upsBase = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 1.02), this.materials.darkMetal);
                        upsBase.position.y = 0.04; upsBase.castShadow = true;
                        ups.add(upsBase);

                        const upsBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.12, 1.0), this.materials.cabinet);
                        upsBody.position.y = 1.14; upsBody.castShadow = true;
                        ups.add(upsBody);
                        this.addDoorFrame(ups, 0.74, 1.98, 0.514, 1.14);
                        this.addCabinetHardware(ups, 0.528, 1);
                        
                        // 前控制面板框
                        const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.02), this.materials.darkMetal);
                        screenFrame.position.set(0, 1.6, 0.5);
                        ups.add(screenFrame);

                        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.24), new THREE.MeshBasicMaterial({ map: this.textures.upsScreen }));
                        screen.position.set(0, 1.6, 0.512);
                        ups.add(screen);

                        const led = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.02), this.materials.greenLed);
                        led.position.set(0, 1.8, 0.512);
                        ups.add(led);

                        this.addLabelPlane(
                            ups,
                            [`${labelPrefix} UPS-${i+1}`, '500 kVA / N+1'],
                            0.44,
                            0.15,
                            { x: 0, y: 2.0, z: 0.516 },
                            { width: 512, height: 160, border: '#f59e0b', color: '#fbbf24', font: 'bold 36px "Segoe UI", sans-serif', lineHeight: 42 }
                        );

                        // 模組化 UPS 功率抽屜、旁路與 EPO，讓正面更接近真實機櫃。
                        for(let m=0; m<4; m++) {
                            const y = 0.64 + m * 0.18;
                            const moduleDoor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.13, 0.018), this.materials.darkMetal);
                            moduleDoor.position.set(0, y, 0.518);
                            ups.add(moduleDoor);
                            const moduleHandle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.02), this.materials.aluminum);
                            moduleHandle.position.set(0.16, y, 0.532);
                            ups.add(moduleHandle);
                            const moduleLed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), this.materials.greenLed);
                            moduleLed.position.set(-0.24, y, 0.532);
                            ups.add(moduleLed);
                        }

                        const epo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20), this.materials.redLed);
                        epo.rotation.x = Math.PI / 2;
                        epo.position.set(-0.28, 1.42, 0.536);
                        ups.add(epo);

                        const bypassSwitch = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.025, 16), this.materials.aluminum);
                        bypassSwitch.rotation.x = Math.PI / 2;
                        bypassSwitch.position.set(0.28, 1.42, 0.536);
                        ups.add(bypassSwitch);

                        const glandPlate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.018), this.materials.rubber);
                        glandPlate.position.set(0, 0.18, 0.52);
                        ups.add(glandPlate);
                        [-0.18, 0, 0.18].forEach(x => {
                            const cableGland = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 16), this.materials.aluminum);
                            cableGland.rotation.x = Math.PI / 2;
                            cableGland.position.set(x, 0.18, 0.535);
                            ups.add(cableGland);
                        });

                        // 細緻通風散熱孔（雙側金屬網格質感）
                        for(let j=0; j<12; j++) {
                            const vent = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.015, 0.01), this.materials.darkMetal);
                            vent.position.set(0, 0.3 + j*0.05, 0.502);
                            ups.add(vent);
                        }

                        for(let j=0; j<8; j++) {
                            [-1, 1].forEach(side => {
                                const sideVent = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.48), this.materials.darkMetal);
                                sideVent.position.set(side * 0.406, 0.55 + j * 0.08, 0);
                                ups.add(sideVent);
                            });
                        }

                        // 頂部排氣風扇口 (圓柱片模擬風扇)
                        const fanGrate = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16), this.materials.darkMetal);
                        fanGrate.position.set(0, 2.21, 0);
                        ups.add(fanGrate);

                        ups.position.set(xOffset, 0, zPos);
                        
                        const upsHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 1.0), new THREE.MeshBasicMaterial({visible:false}));
                        upsHit.position.y = 1.1;
                        upsHit.userData = this.makeEquipmentData(
                            'UPS',
                            `${labelPrefix} UPS Module ${i+1}`,
                            `${labelPrefix === 'Feed-A' ? 'UPS-A' : 'UPS-B'}-${i+1}`,
                            '500 kVA / 450 kW',
                            '在線雙轉換 UPS，提供 IT critical load 穩壓與短時間後備',
                            `${labelPrefix === 'Feed-A' ? 'MSB-A' : 'MSB-B'} 4000A Bus`,
                            `${labelPrefix} UPS Output Bus → Critical PDU`,
                            '前方 1.2 m、後方 1.0 m；可熱插拔功率模組，維修旁路需 SOP 核准'
                        );
                        ups.add(upsHit);
                        this.interactables.push(upsHit);
                        this.scene.add(ups);

                        // 電池櫃 (每台 UPS 配 2 台) - 視覺細節化
                        for(let b=0; b<2; b++) {
                            const batt = new THREE.Group();
                            const bBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.02), this.materials.darkMetal);
                            bBase.position.y = 0.04; bBase.castShadow = true;
                            batt.add(bBase);

                            const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.12, 1.0), this.materials.cabinet);
                            bBody.position.y = 1.14; bBody.castShadow = true;
                            batt.add(bBody);
                            this.addDoorFrame(batt, 0.54, 1.98, 0.514, 1.14);
                            this.addCabinetHardware(batt, 0.528, 1);

                            this.addLabelPlane(
                                batt,
                                [`BAT-${i+1}-${b+1}`, '480 VDC STRING'],
                                0.36,
                                0.13,
                                { x: 0, y: 2.0, z: 0.516 },
                                { width: 512, height: 160, border: '#38bdf8', color: '#e0f2fe', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 40 }
                            );

                            // 電池抽屜與內部發亮接頭與銅排
                            for(let draw=0; draw<6; draw++) {
                                const yPos = 0.35 + draw*0.28;
                                const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.02), this.materials.darkMetal);
                                drawer.position.set(0, yPos, 0.501);
                                batt.add(drawer);

                                // 模擬電池把手與小 LED 指示燈
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.02), this.materials.aluminum);
                                handle.position.set(0, yPos, 0.512);
                                batt.add(handle);

                                const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), this.materials.greenLed);
                                indicator.position.set(-0.2, yPos, 0.512);
                                batt.add(indicator);
                            }

                            // DC 隔離開關、熔絲座與正負極母排，讓電池櫃的電氣角色更清楚。
                            const dcBreaker = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.035), this.materials.rubber);
                            dcBreaker.position.set(0.15, 1.78, 0.528);
                            batt.add(dcBreaker);
                            const breakerLever = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.15, 0.035), this.materials.redLed);
                            breakerLever.rotation.x = -0.35;
                            breakerLever.position.set(0.15, 1.78, 0.555);
                            batt.add(breakerLever);

                            [
                                { x: -0.18, mat: this.materials.phaseR, label: '+' },
                                { x: -0.06, mat: this.materials.rubber, label: '-' }
                            ].forEach(bus => {
                                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.025), bus.mat);
                                bar.position.set(bus.x, 1.56, 0.535);
                                batt.add(bar);
                                this.addLabelPlane(
                                    batt,
                                    bus.label,
                                    0.07,
                                    0.07,
                                    { x: bus.x, y: 1.25, z: 0.552 },
                                    { width: 128, height: 128, bg: 'rgba(2,6,23,0.95)', border: bus.label === '+' ? '#ef4444' : '#e5e7eb', color: '#ffffff', font: 'bold 70px "Segoe UI", sans-serif' }
                                );
                            });

                            this.addLabelPlane(
                                batt,
                                ['DANGER', 'HIGH DC VOLTAGE'],
                                0.34,
                                0.16,
                                { x: 0, y: 0.18, z: 0.538 },
                                { width: 512, height: 180, bg: '#f59e0b', border: '#111827', color: '#111827', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 42 }
                            );

                            const bX = xOffset > 0 ? xOffset + 0.85 + b*0.7 : xOffset - 0.85 - b*0.7;
                            batt.position.set(bX, 0, zPos);

                            const battHit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 1.0), new THREE.MeshBasicMaterial({visible:false}));
                            battHit.position.y = 1.1;
                            battHit.userData = this.makeEquipmentData(
                                'Battery',
                                `${labelPrefix} Battery String ${i+1}-${b+1}`,
                                `${labelPrefix === 'Feed-A' ? 'BAT-A' : 'BAT-B'}-${i+1}${b+1}`,
                                '480 VDC / 100 Ah String',
                                'UPS DC source，市電中斷時維持逆變器輸出',
                                `${labelPrefix} DC Battery Breaker`,
                                `${labelPrefix} UPS-${i+1} DC Link`,
                                '需保留抽屜拉出空間；檢查端子扭力、內阻、溫度與浮充電壓'
                            );
                            batt.add(battHit);
                            this.interactables.push(battHit);
                            this.scene.add(batt);
                        }
                    }
                };

                createUPSGroup(-3.5, 'Feed-A');
                createUPSGroup(3.5, 'Feed-B');

                // 建立主配電盤 (PDU / MSB) - 放在後方，增加細緻開關與發光警示燈
                const createPDU = (xPos, label) => {
                    const pdu = new THREE.Group();
                    
                    const pBase = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.82), this.materials.darkMetal);
                    pBase.position.y = 0.04; pdu.add(pBase);

                    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.12, 0.8), this.materials.cabinet);
                    body.position.y = 1.14; body.castShadow = true;
                    pdu.add(body);
                    this.addDoorFrame(pdu, 1.12, 1.98, 0.416, 1.14, { thickness: 0.022 });
                    this.addCabinetHardware(pdu, 0.432, 1);

                    this.addLabelPlane(
                        pdu,
                        [label, '4000A 3P4W'],
                        0.78,
                        0.16,
                        { x: 0, y: 2.0, z: 0.418 },
                        { width: 640, height: 160, border: '#60a5fa', color: '#dbeafe', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 42 }
                    );

                    const meterWindow = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 0.028), this.materials.rubber);
                    meterWindow.position.set(0, 1.86, 0.428);
                    pdu.add(meterWindow);
                    this.addLabelPlane(
                        pdu,
                        ['V  380.4', 'A  1850  PF .98'],
                        0.72,
                        0.22,
                        { x: 0, y: 1.86, z: 0.446 },
                        { width: 640, height: 220, bg: '#03111f', border: '#38bdf8', color: '#7dd3fc', font: 'bold 36px "JetBrains Mono", monospace', lineHeight: 48 }
                    );

                    [
                        { x: -0.32, mat: this.materials.phaseR, text: 'R' },
                        { x: -0.16, mat: this.materials.phaseS, text: 'S' },
                        { x: 0, mat: this.materials.phaseT, text: 'T' },
                        { x: 0.16, mat: this.materials.neutral, text: 'N' },
                        { x: 0.32, mat: this.materials.yellowGreen, text: 'PE' }
                    ].forEach(bus => {
                        const busBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.035), bus.mat);
                        busBar.position.set(bus.x, 1.28, 0.438);
                        pdu.add(busBar);
                        this.addLabelPlane(
                            pdu,
                            bus.text,
                            0.08,
                            0.06,
                            { x: bus.x, y: 1.08, z: 0.458 },
                            { width: 128, height: 96, bg: 'rgba(2,6,23,0.95)', border: '#475569', color: '#ffffff', font: 'bold 46px "Segoe UI", sans-serif' }
                        );
                    });

                    // 斷路器開關排 (Breakers)
                    for(let r=0; r<4; r++) {
                        for(let c=0; c<3; c++) {
                            const xVal = -0.36 + c*0.36;
                            const yVal = 0.98 - r*0.16;
                            const breaker = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.04), this.materials.darkMetal);
                            breaker.position.set(xVal, yVal, 0.402);
                            pdu.add(breaker);
                            
                            // 紅/綠雙色切換手柄
                            const toggleColor = (r % 2 === 0) ? 0xef4444 : 0x22c55e;
                            const toggleMat = new THREE.MeshStandardMaterial({color: toggleColor, roughness: 0.3});
                            const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.04), toggleMat);
                            toggle.position.set(xVal, yVal + 0.02, 0.43);
                            toggle.rotation.x = (r % 2 === 0) ? -0.4 : 0.4;
                            pdu.add(toggle);
                            
                            // 小指示燈
                            const pduLed = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), (r % 2 === 0) ? this.materials.redLed : this.materials.greenLed);
                            pduLed.position.set(xVal - 0.07, yVal + 0.07, 0.42);
                            pdu.add(pduLed);
                        }
                    }

                    const acb = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.34, 0.05), this.materials.rubber);
                    acb.position.set(0, 0.34, 0.438);
                    pdu.add(acb);
                    const acbHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.045), this.materials.aluminum);
                    acbHandle.rotation.x = 0.45;
                    acbHandle.position.set(0.18, 0.34, 0.475);
                    pdu.add(acbHandle);
                    this.addLabelPlane(
                        pdu,
                        label.includes('Tie') ? ['TIE', 'INTERLOCKED'] : ['MAIN ACB', 'LSIG RELAY'],
                        0.44,
                        0.13,
                        { x: -0.02, y: 0.34, z: 0.482 },
                        { width: 512, height: 160, bg: 'rgba(15,23,42,0.96)', border: '#fbbf24', color: '#fde68a', font: 'bold 32px "Segoe UI", sans-serif', lineHeight: 38 }
                    );

                    this.addLabelPlane(
                        pdu,
                        ['ARC FLASH', 'PPE REQUIRED'],
                        0.34,
                        0.16,
                        { x: -0.36, y: 0.72, z: 0.452 },
                        { width: 512, height: 180, bg: '#f59e0b', border: '#111827', color: '#111827', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 42 }
                    );

                    pdu.position.set(xPos, 0, -5);
                    const pduHit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.8), new THREE.MeshBasicMaterial({visible:false}));
                    pduHit.position.y = 1.1;
                    pduHit.userData = this.makeEquipmentData(
                        'PDU',
                        label,
                        label.includes('Tie') ? 'TIE-01' : (label.includes('MSB-A') ? 'MSB-A' : 'MSB-B'),
                        label.includes('Tie') ? '4000A Tie Breaker' : '4000A Main Switch Board',
                        label.includes('Tie') ? 'A/B 母排連絡與受控切換' : '接收上游市電/發電機電源並分配至 UPS 輸入',
                        label.includes('MSB-A') ? 'Utility-A / ATS-A' : (label.includes('MSB-B') ? 'Utility-B / ATS-B' : 'MSB-A + MSB-B Bus'),
                        label.includes('Tie') ? 'A/B Bus Coupler' : 'UPS Rectifier Input + Mechanical Loads',
                        '前方 1.5 m 操作空間；主 ACB、保護電驛、母排溫升與 Arc Flash 標示需定期確認'
                    );
                    pdu.add(pduHit);
                    this.interactables.push(pduHit);
                    this.scene.add(pdu);
                };

                createPDU(-3, 'MSB-A (Main Switch Board)');
                createPDU(0, 'Tie Panel');
                createPDU(3, 'MSB-B (Main Switch Board)');

                // 電纜橋架 (Cable Tray) - 懸空
                const createTraySegment = (w, l, x, y, z, rotY) => {
                    const tray = new THREE.Group();
                    // 側邊
                    const side1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, l), this.materials.tray);
                    side1.position.set(-w/2, 0, 0); tray.add(side1);
                    const side2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, l), this.materials.tray);
                    side2.position.set(w/2, 0, 0); tray.add(side2);
                    // 橫向梯階
                    for(let i=0; i<l/0.3; i++) {
                        const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, 0.05), this.materials.tray);
                        step.position.set(0, -0.04, -l/2 + i*0.3 + 0.15);
                        tray.add(step);
                    }
                    for(let zPos = -l/2 + 0.8; zPos <= l/2 - 0.8; zPos += 2.0) {
                        [-w/2, w/2].forEach(xPos => {
                            const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.65, 8), this.materials.aluminum);
                            hanger.position.set(xPos, 0.82, zPos);
                            tray.add(hanger);
                        });
                        const upperStrut = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.035, 0.06), this.materials.aluminum);
                        upperStrut.position.set(0, 1.64, zPos);
                        tray.add(upperStrut);
                    }
                    tray.position.set(x, y, z);
                    tray.rotation.y = rotY;
                    this.scene.add(tray);
                };

                // PDU 上方的橫向橋架
                createTraySegment(0.8, 10, 0, 3.5, -5, Math.PI/2);
                // 連接到 UPS 的縱向橋架
                // 修正後：長度從 6 改為 9，中心從 z=-1 移至 z=-1，使橋架覆蓋 z=[-5.5, 3.5]
                createTraySegment(0.6, 9, -3.5, 3.5, -1, 0);
                createTraySegment(0.6, 9, 3.5, 3.5, -1, 0);
                
                // 垂直落線架
                const dropA = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.1), this.materials.tray);
                dropA.position.set(-3.0, 2.85, -5); this.scene.add(dropA);
                const dropB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.1), this.materials.tray);
                dropB.position.set(3.0, 2.85, -5); this.scene.add(dropB);

                // ============================================================================
                // [NEW] Fix 05 - 電纜線束可視化 (TubeGeometry)
                // 沿著電纜架鋪設三色動力粗電纜 (紅/黃/藍/綠) 與 輸出電纜
                // ============================================================================
                const createPowerCables = (points, offsetArray, customColors, flowType = 'utility') => {
                    const defaultColors = [0xef4444, 0xfbbf24, 0x3b82f6, 0x22c55e]; // 紅 黃 藍 綠
                    const colors = customColors || defaultColors;
                    offsetArray.forEach((offset, idx) => {
                        const shiftedPoints = points.map(p => new THREE.Vector3(p.x + offset.x, p.y + offset.y, p.z + offset.z));
                        const curve = new THREE.CatmullRomCurve3(shiftedPoints, false, 'centripetal', 0.12);
                        const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.016, 8, false);
                        const color = colors[idx % colors.length];
                        const tubeMat = new THREE.MeshStandardMaterial({
                            color: color,
                            metalness: 0.45,
                            roughness: 0.5,
                            emissive: color,
                            emissiveIntensity: 0.025 // 保留辨識度，但避免像霓虹線條漂浮。
                        });
                        const tube = new THREE.Mesh(tubeGeo, tubeMat);
                        tube.userData.flowType = flowType;
                        this.flowMeshes.push(tube);
                        this.scene.add(tube);
                    });
                };

                // 微調 4 條電纜的間距，使其排排站
                const offsets = [
                    { x: -0.075, y: -0.045, z: 0 },
                    { x: -0.025, y: -0.045, z: 0 },
                    { x: 0.025, y: -0.045, z: 0 },
                    { x: 0.075, y: -0.045, z: 0 }
                ];

                // A/B 排輸入電纜只顯示在 tray 內的直線段，盤體到橋架由封閉落線架表示，避免曲線外拋超出 tray。
                const pathAPoints = [
                    new THREE.Vector3(-3.5, 3.425, -5.05),
                    new THREE.Vector3(-3.5, 3.425, 2.8)
                ];
                createPowerCables(pathAPoints, offsets, null, 'utility');

                const pathBPoints = [
                    new THREE.Vector3(3.5, 3.425, -5.05),
                    new THREE.Vector3(3.5, 3.425, 2.8)
                ];
                createPowerCables(pathBPoints, offsets, null, 'utility');

                // UPS 輸出改為低矮封閉式地坪線槽，不再用裸露 Tube 線在地面亂繞。
                const createFloorDuct = (x, z, length, axis = 'z', color = 0x1e3a8a, flowType = 'upsOutput') => {
                    const ductMat = this.materials.darkMetal.clone();
                    const size = axis === 'z' ? [0.42, 0.09, length] : [length, 0.09, 0.42];
                    const duct = new THREE.Mesh(new THREE.BoxGeometry(...size), ductMat);
                    duct.position.set(x, 0.065, z);
                    this.scene.add(duct);

                    const coverMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.04, roughness: 0.55 });
                    const coverSize = axis === 'z' ? [0.08, 0.012, length * 0.92] : [length * 0.92, 0.012, 0.08];
                    const cover = new THREE.Mesh(new THREE.BoxGeometry(...coverSize), coverMat);
                    cover.position.set(x, 0.118, z);
                    this.scene.add(cover);
                };

                const createDuctTap = (x, z, label, color) => {
                    const capMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, roughness: 0.45 });
                    const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 18), this.materials.aluminum);
                    gland.rotation.x = Math.PI / 2;
                    gland.position.set(x, 0.13, z);
                    this.scene.add(gland);
                    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.07), capMat);
                    cap.position.set(x, 0.165, z);
                    this.scene.add(cap);
                };

                const createBuswayRun = (x, y, z, length, axis = 'x', label = 'BUSWAY', color = 0xfbbf24, flowType = 'upsOutput') => {
                    const busMat = this.materials.tray.clone();
                    const size = axis === 'x' ? [length, 0.22, 0.28] : [0.28, 0.22, length];
                    const bus = new THREE.Mesh(new THREE.BoxGeometry(...size), busMat);
                    bus.position.set(x, y, z);
                    bus.userData.flowType = flowType;
                    this.flowMeshes.push(bus);
                    this.scene.add(bus);

                    const stripeMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.05 });
                    const stripeSize = axis === 'x' ? [length * 0.9, 0.018, 0.045] : [0.045, 0.018, length * 0.9];
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(...stripeSize), stripeMat);
                    stripe.position.set(x, y + 0.125, z);
                    stripe.userData.flowType = flowType;
                    this.flowMeshes.push(stripe);
                    this.scene.add(stripe);

                    for(let pos = -length / 2 + 0.7; pos <= length / 2 - 0.7; pos += 1.4) {
                        const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 8), this.materials.aluminum);
                        hanger.position.set(axis === 'x' ? x + pos : x, y + 0.62, axis === 'x' ? z : z + pos);
                        this.scene.add(hanger);
                        const clevis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.045), this.materials.aluminum);
                        clevis.position.set(axis === 'x' ? x + pos : x, y + 0.1, axis === 'x' ? z : z + pos);
                        clevis.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
                        this.scene.add(clevis);
                    }

                    [-0.32, 0.32].forEach(offset => {
                        const tap = new THREE.Mesh(
                            new THREE.BoxGeometry(axis === 'x' ? 0.28 : 0.38, 0.32, axis === 'x' ? 0.38 : 0.28),
                            this.materials.darkMetal
                        );
                        tap.position.set(axis === 'x' ? x + offset * length : x, y - 0.29, axis === 'x' ? z : z + offset * length);
                        this.scene.add(tap);
                    });

                    this.addLabelPlane(
                        this.scene,
                        label,
                        1.18,
                        0.18,
                        { x: axis === 'x' ? x : x + 0.16, y: y + 0.02, z: axis === 'x' ? z + 0.155 : z },
                        { rotation: { y: axis === 'x' ? 0 : Math.PI / 2 }, width: 512, height: 128, bg: 'rgba(8,12,20,0.88)', border: '#fbbf24', color: '#fde68a', font: 'bold 28px "Segoe UI", sans-serif' }
                    );
                };

                createFloorDuct(-3.5, -1.0, 7.3, 'z', 0x1e40af, 'upsOutput');
                createFloorDuct(-3.25, -4.65, 0.5, 'x', 0x1e40af, 'upsOutput');
                createDuctTap(-3.5, -1.5, 'UPS-A1 OUT', 0x1e40af);
                createDuctTap(-3.5, 2.0, 'UPS-A2 OUT', 0x1e40af);

                createFloorDuct(3.5, -1.0, 7.3, 'z', 0x047857, 'upsOutput');
                createFloorDuct(3.25, -4.65, 0.5, 'x', 0x047857, 'upsOutput');
                createDuctTap(3.5, -1.5, 'UPS-B1 OUT', 0x047857);
                createDuctTap(3.5, 2.0, 'UPS-B2 OUT', 0x047857);

                // 灰區可見的高位封閉式 busway：
                // 1) EDG/ATS 到 MSB-B 的 emergency source busway。
                // 2) UPS A/B output busway 沿 UPS line-up 上方走，再匯入 critical load header。
                createBuswayRun(5.35, 3.05, -5.0, 3.7, 'x', 'GENERATOR SOURCE BUSWAY', 0xf97316, 'generator');
                createBuswayRun(-2.45, 3.18, 0.55, 4.8, 'z', 'UPS-A OUTPUT BUSWAY', 0x38bdf8, 'upsOutput');
                createBuswayRun(2.45, 3.18, 0.55, 4.8, 'z', 'UPS-B OUTPUT BUSWAY', 0x22c55e, 'upsOutput');
                createBuswayRun(0, 3.18, 2.95, 5.3, 'x', 'CRITICAL LOAD HEADER', 0xfbbf24, 'upsOutput');
                createBuswayRun(0, 2.72, -2.85, 4.4, 'x', 'MAINTENANCE BYPASS BUSWAY', 0xf59e0b, 'bypass');

                // ============================================================================
                // [NEW] Fix 06 - 柴油緊急發電機組 (Diesel Generator) - 霸氣硬核工業設備
                // 放置在右後方空地 [7.5, 0, -4.5] -> 戶外發電機主體 (位於 x=11.5，在牆外)
                // ============================================================================
                const genGroup = new THREE.Group();

                // ── 室內 ATS 面板 (Automatic Transfer Switch)：與後方 MSB 列對齊，縮短緊急電源進線路徑 ──
                const atsPanel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.4), this.materials.cabinet);
                atsPanel.position.set(7.2, 0.9, -5.0);
                genGroup.add(atsPanel);

                const atsLabel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.02), this.materials.darkMetal);
                atsLabel.position.set(7.2, 1.5, -4.79);
                genGroup.add(atsLabel);

                const atsGreen = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), this.materials.greenLed);
                atsGreen.position.set(7.2, 1.3, -4.79);
                genGroup.add(atsGreen);

                // ── 戶外發電機主體（位於 x=12.5，在牆外，與 ATS / MSB 後方軸線對齊） ──
                const genX = 12.5, genZ = -5.0;

                // ── 穿牆銅排組 (3條，排在 z=-0.8 ~ z=-1.2) ──
                // 動態計算銅排長度與位置，使其完美連接室內 ATS 面板 (x=7.2) 與戶外發電機接線箱面 (x=genX-2.0)
                const barLength = (genX - 2.0) - 7.2;
                const barX = (7.2 + (genX - 2.0)) / 2;
                [genZ + 0.15, genZ, genZ - 0.15].forEach(zOff => {
                    const genBusMat = this.materials.copper.clone();
                    genBusMat.transparent = true;
                    genBusMat.opacity = 1;
                    const bar = new THREE.Mesh(new THREE.BoxGeometry(barLength, 0.05, 0.04), genBusMat);
                    bar.position.set(barX, 1.5, zOff);
                    bar.userData.flowType = 'generator';
                    this.flowMeshes.push(bar);
                    genGroup.add(bar);
                });

                // ATS 輸出到 MSB-B / Emergency Source 的短母排，補齊發電機供電路徑。
                const atsOutLength = 7.2 - 3.65;
                const atsOutX = (7.2 + 3.65) / 2;
                [genZ + 0.28, genZ + 0.12, genZ - 0.04].forEach(zOff => {
                    const atsBusMat = this.materials.copper.clone();
                    atsBusMat.transparent = true;
                    atsBusMat.opacity = 1;
                    const atsBus = new THREE.Mesh(new THREE.BoxGeometry(atsOutLength, 0.045, 0.035), atsBusMat);
                    atsBus.position.set(atsOutX, 1.72, zOff);
                    atsBus.userData.flowType = 'generator';
                    this.flowMeshes.push(atsBus);
                    genGroup.add(atsBus);
                });

                // 主機殼（工業黃色隔音外殼）
                const genBody = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.8, 1.6), this.materials.generatorYellow);
                genBody.position.set(genX, 0.9, genZ);
                genGroup.add(genBody);

                // 底盤基座
                const genBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.15, 1.8), this.materials.darkMetal);
                genBase.position.set(genX, 0.075, genZ);
                genGroup.add(genBase);

                // 彈簧避震腳與基礎螺栓
                [[-1.65, -0.65], [-1.65, 0.65], [1.65, -0.65], [1.65, 0.65]].forEach(([dx, dz]) => {
                    const isolator = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 16), this.materials.rubber);
                    isolator.position.set(genX + dx, 0.16, genZ + dz);
                    genGroup.add(isolator);
                    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), this.materials.aluminum);
                    bolt.position.set(genX + dx, 0.25, genZ + dz);
                    genGroup.add(bolt);
                });

                // 側邊散熱百葉窗（前後各一側）
                [[-0.8, 1], [0.8, 1]].forEach(([zDir]) => {
                    for(let i=0; i<6; i++) {
                        const louver = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.02), this.materials.darkMetal);
                        louver.position.set(genX, 0.5 + i * 0.2, genZ + zDir * 0.8);
                        genGroup.add(louver);
                    }
                });

                // 控制面板門（左端，面向 -x 側）
                const ctrlPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 0.9), this.materials.darkMetal);
                ctrlPanel.position.set(genX - 2.0, 0.8, genZ);
                genGroup.add(ctrlPanel);

                this.addLabelPlane(
                    genGroup,
                    ['GEN CTRL', 'AUTO  READY'],
                    0.52,
                    0.26,
                    { x: genX - 2.026, y: 1.18, z: genZ },
                    { rotation: { y: -Math.PI / 2 }, width: 512, height: 220, bg: '#03111f', border: '#22c55e', color: '#86efac', font: 'bold 34px "JetBrains Mono", monospace', lineHeight: 46 }
                );

                const genEpo = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 20), this.materials.redLed);
                genEpo.rotation.z = Math.PI / 2;
                genEpo.position.set(genX - 2.04, 0.55, genZ + 0.32);
                genGroup.add(genEpo);

                // 控制面板儀表
                [[0, 1.3], [0.2, 1.1], [-0.2, 1.1]].forEach(([dz, dy]) => {
                    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), this.materials.aluminum);
                    dial.rotation.z = Math.PI/2;
                    dial.position.set(genX - 2.02, dy, genZ + dz);
                    genGroup.add(dial);
                });

                // 排氣煙囪（頂部，垂直）
                const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 12), this.materials.exhaustPipe);
                exhaust.position.set(genX + 1.2, 1.8 + 0.9, genZ);
                genGroup.add(exhaust);

                const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 16), this.materials.exhaustPipe);
                muffler.rotation.z = Math.PI / 2;
                muffler.position.set(genX + 1.2, 2.05, genZ);
                genGroup.add(muffler);

                // 煙囪頂部風帽
                const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.15, 12), this.materials.darkMetal);
                cap.position.set(genX + 1.2, 1.8 + 1.9, genZ);
                genGroup.add(cap);

                // 散熱水箱百葉（右端，面向 +x）
                const radiatorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.38, 1.38), this.materials.rubber);
                radiatorFrame.position.set(genX + 2.03, 0.9, genZ);
                genGroup.add(radiatorFrame);
                for(let i=0; i<5; i++) {
                    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 1.2), this.materials.aluminum);
                    fin.position.set(genX + 2.0, 0.8, genZ - 0.4 + i * 0.2);
                    genGroup.add(fin);
                }
                for(let i=0; i<8; i++) {
                    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 1.28), this.materials.aluminum);
                    grille.position.set(genX + 2.055, 0.34 + i * 0.15, genZ);
                    genGroup.add(grille);
                }

                // 油箱（機殼下方可見）
                const fuelTank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.2), new THREE.MeshStandardMaterial({color: 0x1c1c1c, metalness:0.7, roughness:0.4}));
                fuelTank.position.set(genX - 0.8, 0.22, genZ);
                genGroup.add(fuelTank);

                // 機身警示斑馬紋（黃黑斜線條）
                const stripeMatY = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 });
                const stripeMatB = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 });
                for(let i=0; i<8; i++) {
                    const col = (i % 2 === 0) ? stripeMatY : stripeMatB;
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.82, 0.01), col);
                    stripe.position.set(genX - 1.7 + i * 0.28, 0.91, genZ + 0.805);
                    genGroup.add(stripe);
                }

                // 互動透明框
                const genHit = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.8, 1.6), new THREE.MeshBasicMaterial({visible:false}));
                genHit.position.set(genX, 0.9, genZ);
                genHit.userData = this.makeEquipmentData(
                    'Generator',
                    'Emergency Diesel Generator (2.5MW)',
                    'EDG-01',
                    '2,500 kW Standby / 480V',
                    '市電失壓時經 ATS 供應灰區主盤與 UPS 整流器',
                    'Diesel Day Tank + Starting Battery',
                    'ATS-01 → MSB Emergency Source',
                    '保留散熱進排風距離；檢查油量、冷卻水、電瓶、排煙管支撐與每月試車紀錄'
                );
                genGroup.add(genHit);
                this.interactables.push(genHit);

                 // 戶外地坪（統一深色，與機房深色地板完美對齊）
                 const outdoorFloor = new THREE.Mesh(
                     new THREE.PlaneGeometry(8, 10),
                     new THREE.MeshStandardMaterial({ color: 0x020408, roughness: 0.8, metalness: 0.3 })
                 );
                 outdoorFloor.rotation.x = -Math.PI/2;
                 outdoorFloor.position.set(genX, 0.01, genZ);
                 genGroup.add(outdoorFloor);

                // 發電機實體銘牌，貼在隔音外殼上，不再用漂浮 billboard。
                this.addLabelPlane(
                    genGroup,
                    ['EDG-01', 'DIESEL GENERATOR 2,500 kW'],
                    1.45,
                    0.34,
                    { x: genX, y: 1.62, z: genZ + 0.812 },
                    { width: 768, height: 220, bg: 'rgba(8,12,20,0.92)', border: '#f59e0b', color: '#fbbf24', font: 'bold 42px "Segoe UI", sans-serif', lineHeight: 54 }
                );

                this.scene.add(genGroup);
            },

            
            updateLiveValues() {
                document.querySelectorAll('.live-val').forEach(el => {
                    let base = parseFloat(el.getAttribute('data-base'));
                    let variance = parseFloat(el.getAttribute('data-var'));
                    let val = base + (Math.random() * variance * 2 - variance);
                    let decimals = variance === 0 ? 0 : (base > 1000 ? 0 : (base > 100 ? 1 : 2));
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
                        module: 'mep-room',
                        data: {
                            grid: getVal('hud_val_grid'),
                            ups: getVal('hud_val_ups'),
                            soc: getVal('hud_val_soc'),
                            scenario: APP.currentScenario
                        }
                    }, '*');
                }
            },


            calculateBattery() {
                const loadKW = parseFloat(document.getElementById('calc_load').value) || 500;
                const eff = (parseFloat(document.getElementById('calc_eff').value) || 96) / 100;
                const ah = parseFloat(document.getElementById('calc_ah').value) || 100;
                const series = parseFloat(document.getElementById('calc_series').value) || 40;
                const parallel = parseFloat(document.getElementById('calc_parallel').value) || 4;
                
                // 假設單體電池 12V
                const cellV = 12;
                const totalV = series * cellV; // 480V
                
                // 總儲能 kWh
                const totalKWh = (totalV * ah * parallel) / 1000;
                
                // 逆變器端需要的直流功率 (W)
                const dcPowerReq = (loadKW * 1000) / eff;
                
                // 直流放電電流 (A)
                const dischargeCurrent = dcPowerReq / totalV;
                
                // 簡化版 Peukert 效應估算後備時間 (非線性放電)
                // 假設 1C 放電率下容量剩餘 60%
                const cRate = dischargeCurrent / (ah * parallel);
                let efficiencyFactor = 1.0;
                if (cRate > 1) efficiencyFactor = 0.5;
                else if (cRate > 0.5) efficiencyFactor = 0.7;
                else efficiencyFactor = 0.9; // 淺放電
                
                const backupTimeHours = (totalKWh * efficiencyFactor) / loadKW;
                const backupTimeMins = backupTimeHours * 60;

                document.getElementById('res_time').innerText = backupTimeMins.toFixed(1);
                document.getElementById('res_current').innerText = dischargeCurrent.toFixed(0);
                document.getElementById('res_kwh').innerText = totalKWh.toFixed(0);
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
                    this.showDetail(intersects[0].object.userData);
                }
            },

            showDetail(data) {
                this.selectedEquipment = data;
                document.getElementById('hud-detail').classList.add('active');
                document.getElementById('detail-title').innerText = data.name;
                document.getElementById('detail-tag').innerText = data.tag || '--';
                document.getElementById('detail-status').innerText = this.getScenarioStatus(data);
                document.getElementById('detail-rating').innerText = data.rating || '--';
                document.getElementById('detail-role').innerText = data.role || '--';
                document.getElementById('detail-upstream').innerText = data.upstream || '--';
                document.getElementById('detail-downstream').innerText = data.downstream || '--';
                document.getElementById('detail-maintenance').innerText = data.maintenance || '--';
                document.getElementById('detail-scenario-note').innerText = this.getScenarioNote(data);
                
                document.getElementById('detail-content-ups').style.display = data.type === 'UPS' ? 'block' : 'none';
                document.getElementById('detail-content-batt').style.display = data.type === 'Battery' ? 'block' : 'none';
                document.getElementById('detail-content-pdu').style.display = data.type === 'PDU' ? 'block' : 'none';
                document.getElementById('detail-content-generator').style.display = data.type === 'Generator' ? 'block' : 'none';
                
                if(data.type === 'UPS') document.getElementById('detail-subtitle').innerText = '500kVA MODULAR UPS';
                if(data.type === 'Battery') document.getElementById('detail-subtitle').innerText = 'VRLA 12V 100Ah STRING';
                if(data.type === 'PDU') document.getElementById('detail-subtitle').innerText = '4000A MAIN SWITCH BOARD';
                if(data.type === 'Generator') document.getElementById('detail-subtitle').innerText = 'STANDBY DIESEL GENERATOR';
            },

            closeDetail() {
                this.selectedEquipment = null;
                document.getElementById('hud-detail').classList.remove('active');
            },

            toggleLeftHud() {
                this.leftHudVisible = !this.leftHudVisible;
                this.updateHudState();
            },

            updateHudState() {
                const hud = document.getElementById('hud-left');
                const btn = document.getElementById('btn_toggle_hud');
                if (hud) hud.classList.toggle('active', this.leftHudVisible);
                if (btn) btn.classList.toggle('active', this.leftHudVisible);
            },

            applyCoupledData(data) {
                const wsLoad = data.whitespaceLoad || 1200;
                
                // Bind UPS base loads to Whitespace's actual IT load
                this.scenarios.normal.upsKW = wsLoad;
                this.scenarios.utilityFail.upsKW = wsLoad;
                this.scenarios.generator.upsKW = wsLoad;
                
                // Store chiller power consumption to add to total grid power
                this.chillerPower = data.chillerPower || 137;
                
                // Dynamically calculate grid power base for normal scenario
                // Grid load = UPS load / UPS efficiency (0.96) + aux loads (50 kW) + chiller plant power
                this.scenarios.normal.gridKW = Math.round(wsLoad / 0.96 + 50 + this.chillerPower);
                this.scenarios.bypass.gridKW = Math.round(wsLoad + 50 + this.chillerPower);
                
                // Refresh display baselines for active scenario
                const activeScenario = this.scenarios[this.currentScenario];
                if (activeScenario) {
                    const gridEl = document.getElementById('hud_val_grid');
                    const upsEl = document.getElementById('hud_val_ups');
                    if (gridEl) gridEl.setAttribute('data-base', activeScenario.gridKW);
                    if (upsEl) upsEl.setAttribute('data-base', activeScenario.upsKW);
                }

                // Dynamic UPS Sizing Upgrade Linkage
                if (data.upsUpgraded) {
                    this.interactables.forEach(obj => {
                        if (obj.userData && obj.userData.type === 'UPS') {
                            obj.userData.rating = '3 * 500 kVA / 1350 kW (Feed Secured)';
                            obj.userData.role = '在線雙轉換 UPS 模組，已擴容至 3台 500kVA，具備 N+1 冗餘，可完全安全承載 1.2 MW IT 滿載。';
                        }
                    });
                }
            },

            toggleSimPanel() {
                this.simPanelOpen = !this.simPanelOpen;
                document.getElementById('sim-modal-overlay').classList.toggle('active', this.simPanelOpen);
            },

            setScenario(key) {
                const scenario = this.scenarios[key] || this.scenarios.normal;
                this.currentScenario = key;
                document.querySelectorAll('.scenario-btn').forEach(btn => btn.classList.remove('active'));
                const activeBtn = document.getElementById('scenario_' + key);
                if (activeBtn) activeBtn.classList.add('active');

                const banner = document.getElementById('scenario-banner');
                const bannerIcon = document.getElementById('scenario-icon');
                const bannerTitle = document.getElementById('scenario-title');
                const bannerSource = document.getElementById('scenario-source');
                const bannerNote = document.getElementById('scenario-note');
                if (banner) {
                    banner.style.borderLeftColor = scenario.accent;
                    banner.style.boxShadow = `0 18px 45px -28px rgba(0,0,0,0.9), 0 0 24px -14px ${scenario.accent}`;
                }
                if (bannerIcon) {
                    bannerIcon.className = `ph ${scenario.icon}`;
                    bannerIcon.style.color = scenario.accent;
                }
                if (bannerTitle) bannerTitle.innerText = scenario.name;
                if (bannerSource) {
                    bannerSource.innerText = scenario.source;
                    bannerSource.style.color = scenario.accent;
                }
                if (bannerNote) bannerNote.innerText = scenario.note;

                const gridEl = document.getElementById('hud_val_grid');
                const upsEl = document.getElementById('hud_val_ups');
                const socEl = document.getElementById('hud_val_soc');
                if (gridEl) gridEl.setAttribute('data-base', scenario.gridKW);
                if (upsEl) upsEl.setAttribute('data-base', scenario.upsKW);
                if (socEl) socEl.setAttribute('data-base', scenario.batterySOC);
                if (gridEl) gridEl.setAttribute('data-var', scenario.gridKW === 0 ? 0 : 15);
                if (upsEl) upsEl.setAttribute('data-var', scenario.upsKW === 0 ? 0 : 10);
                if (socEl) socEl.setAttribute('data-var', 0);

                const upsMode = document.getElementById('ups-mode-label');
                const batteryMode = document.getElementById('battery-mode-label');
                const pduMode = document.getElementById('pdu-mode-label');
                const generatorMode = document.getElementById('generator-mode-label');
                if (upsMode) upsMode.innerText = scenario.upsStatus;
                if (batteryMode) batteryMode.innerText = scenario.batteryStatus;
                if (pduMode) pduMode.innerText = scenario.pduStatus;
                if (generatorMode) generatorMode.innerText = scenario.generatorStatus;

                this.flowMeshes.forEach(mesh => {
                    const level = scenario.flow[mesh.userData.flowType] ?? 0.3;
                    if (mesh.material) {
                        if ('opacity' in mesh.material) {
                            mesh.material.transparent = level < 0.98;
                            mesh.material.opacity = 0.18 + level * 0.82;
                        }
                        mesh.material.emissiveIntensity = 0.01 + level * 0.38;
                        mesh.material.needsUpdate = true;
                    }
                });

                if (this.selectedEquipment) this.showDetail(this.selectedEquipment);
                this.updateLiveValues();
            },

            setCamera(preset) {
                document.querySelectorAll('[id^="cam_"]').forEach(b => b.classList.remove('active'));
                if(document.getElementById('cam_' + preset)) document.getElementById('cam_' + preset).classList.add('active');
                
                let cp, ct;
                if(preset === 'overview')    { cp = new THREE.Vector3(12, 10, 15); ct = new THREE.Vector3(0, 1, 0); }
                else if(preset === 'ups')    { cp = new THREE.Vector3(-3.5, 1.5, 4); ct = new THREE.Vector3(-3.5, 1.5, -1.5); }
                else if(preset === 'battery'){ cp = new THREE.Vector3(-7, 1.5, 1); ct = new THREE.Vector3(-4.8, 1.0, -1.5); }
                else if(preset === 'pdu')    { cp = new THREE.Vector3(0, 1.5, -1); ct = new THREE.Vector3(0, 1.5, -5); }
                else if(preset === 'tray')   { cp = new THREE.Vector3(0, 6, 2); ct = new THREE.Vector3(0, 3.5, -3); }
                else if(preset === 'generator') { cp = new THREE.Vector3(10, 4, -0.5); ct = new THREE.Vector3(12.5, 1.0, -5.0); }
                
                if(cp && ct) this.tweenCamera(cp, ct);
            },

            tweenCamera(pos, target) {
                if(window.TWEEN) {
                    new TWEEN.Tween(this.camera.position).to(pos, 1500).easing(TWEEN.Easing.Cubic.InOut).start();
                    new TWEEN.Tween(this.controls.target).to(target, 1500).easing(TWEEN.Easing.Cubic.InOut).start();
                } else {
                    this.camera.position.copy(pos); this.controls.target.copy(target);
                }
            },

            resize() {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            },

            animate() {
                requestAnimationFrame(() => this.animate());
                if(window.TWEEN) TWEEN.update();
                this.controls.update();
                this.renderer.render(this.scene, this.camera);
            }
        };

        window.onload = () => APP.init();

        // Listen to coupling message from portal
        window.addEventListener('message', (event) => {
            if (event.source !== window.parent) return;
            const msg = event.data;
            if (msg.type === 'coupled_data') {
                APP.applyCoupledData(msg.data);
            }
        });