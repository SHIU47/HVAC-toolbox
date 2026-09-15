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

                        // ── UPS 主機 ──────────────────────────────
                        const ups = new THREE.Group();

                        // 基座
                        const upsBase = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 1.02), this.materials.darkMetal);
                        upsBase.position.y = 0.04; upsBase.castShadow = true;
                        ups.add(upsBase);

                        // 主體
                        const upsBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.12, 1.0), this.materials.cabinet);
                        upsBody.position.y = 1.14; upsBody.castShadow = true;
                        ups.add(upsBody);
                        this.addDoorFrame(ups, 0.74, 1.98, 0.514, 1.14);
                        this.addCabinetHardware(ups, 0.528, 1);

                        // 底部輸入區分區面板
                        const inputSection = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.52, 0.012), this.materials.darkMetal);
                        inputSection.position.set(0, 0.38, 0.508);
                        ups.add(inputSection);

                        // AC 輸入端子排（R/S/T/N/PE 五相）
                        [-0.28, -0.14, 0, 0.14, 0.28].forEach((x, idx) => {
                            const termMat = [this.materials.phaseR, this.materials.phaseS, this.materials.phaseT, this.materials.neutral, this.materials.yellowGreen][idx];
                            const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.038, 8), termMat);
                            terminal.rotation.x = Math.PI / 2;
                            terminal.position.set(x, 0.2, 0.534);
                            ups.add(terminal);
                            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.018, 6), this.materials.aluminum);
                            bolt.rotation.x = Math.PI / 2;
                            bolt.position.set(x, 0.2, 0.547);
                            ups.add(bolt);
                        });

                        // Cable gland plate（4 個線管入口）
                        const glandPlate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.018), this.materials.rubber);
                        glandPlate.position.set(0, 0.6, 0.52);
                        ups.add(glandPlate);
                        [-0.2, -0.067, 0.067, 0.2].forEach(x => {
                            const cableGland = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.022, 14), this.materials.aluminum);
                            cableGland.rotation.x = Math.PI / 2;
                            cableGland.position.set(x, 0.6, 0.535);
                            ups.add(cableGland);
                        });

                        // 中段功率模組分區面板
                        const moduleSection = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.92, 0.012), this.materials.darkMetal);
                        moduleSection.position.set(0, 1.08, 0.508);
                        ups.add(moduleSection);

                        // 功率模組抽屜（4 個，帶雙 LED + 通風槽）
                        for(let m=0; m<4; m++) {
                            const y = 0.74 + m * 0.21;
                            const moduleDoor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.018), this.materials.cabinet);
                            moduleDoor.position.set(0, y, 0.518);
                            ups.add(moduleDoor);
                            const moduleHandle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.022), this.materials.aluminum);
                            moduleHandle.position.set(0.08, y, 0.533);
                            ups.add(moduleHandle);
                            // 雙色 LED（正常綠 + 告警黃）
                            const ledG = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), this.materials.greenLed);
                            ledG.position.set(-0.25, y + 0.04, 0.533);
                            ups.add(ledG);
                            const ledY = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), this.materials.yellowLed);
                            ledY.position.set(-0.25, y - 0.04, 0.533);
                            ups.add(ledY);
                            // 抽屜散熱通風槽（5條）
                            for(let v=0; v<5; v++) {
                                const slot = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.007, 0.004), this.materials.darkMetal);
                                slot.position.set(-0.03, y - 0.055 + v * 0.022, 0.53);
                                ups.add(slot);
                            }
                        }

                        // 控制面板：螢幕框 + LCD
                        const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.022), this.materials.darkMetal);
                        screenFrame.position.set(-0.04, 1.64, 0.5);
                        ups.add(screenFrame);
                        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), new THREE.MeshBasicMaterial({ map: this.textures.upsScreen }));
                        screen.position.set(-0.04, 1.64, 0.513);
                        ups.add(screen);

                        // 螢幕右側操作按鍵（4顆）
                        [1.56, 1.62, 1.68, 1.74].forEach(y => {
                            const btn = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.018), this.materials.darkMetal);
                            btn.position.set(0.24, y, 0.518);
                            ups.add(btn);
                        });

                        // 狀態 LED 列（5個：AC IN / BATT / BYPASS / FAULT / AC OUT）
                        [this.materials.greenLed, this.materials.greenLed, this.materials.yellowLed, this.materials.redLed, this.materials.greenLed].forEach((mat, idx) => {
                            const statusLed = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), mat);
                            statusLed.position.set(-0.24 + idx * 0.12, 1.9, 0.515);
                            ups.add(statusLed);
                        });

                        // EPO 按鈕（含保護蓋框）
                        const epoGuard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), this.materials.darkMetal);
                        epoGuard.position.set(-0.3, 1.46, 0.527);
                        ups.add(epoGuard);
                        const epo = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 20), this.materials.redLed);
                        epo.rotation.x = Math.PI / 2;
                        epo.position.set(-0.3, 1.46, 0.545);
                        ups.add(epo);

                        // 維修旁路旋轉開關（帶鑰匙孔）
                        const bypassSwitch = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.025, 16), this.materials.aluminum);
                        bypassSwitch.rotation.x = Math.PI / 2;
                        bypassSwitch.position.set(0.28, 1.46, 0.535);
                        ups.add(bypassSwitch);
                        const bypassKey = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.028, 0.014), this.materials.darkMetal);
                        bypassKey.rotation.x = Math.PI / 2;
                        bypassKey.position.set(0.28, 1.46, 0.552);
                        ups.add(bypassKey);

                        // 標牌
                        this.addLabelPlane(ups, [`${labelPrefix} UPS-${i+1}`, '500 kVA / N+1'], 0.44, 0.15,
                            { x: 0, y: 2.04, z: 0.516 },
                            { width: 512, height: 160, border: '#f59e0b', color: '#fbbf24', font: 'bold 36px "Segoe UI", sans-serif', lineHeight: 42 });

                        // 側板角度百葉窗（真實葉片傾斜幾何）
                        for(let j=0; j<12; j++) {
                            [-1, 1].forEach(side => {
                                const louver = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.5), this.materials.darkMetal);
                                louver.rotation.z = side * 0.32;
                                louver.position.set(side * 0.404, 0.38 + j * 0.085, 0);
                                ups.add(louver);
                            });
                        }

                        // 後板散熱鰭片
                        for(let j=0; j<10; j++) {
                            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.016, 0.012), this.materials.darkMetal);
                            fin.position.set(0, 0.32 + j * 0.065, -0.502);
                            ups.add(fin);
                        }

                        // 頂部 2×2 風扇陣列
                        [[-0.18, -0.2], [0.18, -0.2], [-0.18, 0.2], [0.18, 0.2]].forEach(([fx, fz]) => {
                            const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.026, 16), this.materials.darkMetal);
                            shroud.position.set(fx, 2.216, fz);
                            ups.add(shroud);
                            // 葉片十字
                            [true, false].forEach(isX => {
                                const blade = new THREE.Mesh(new THREE.BoxGeometry(isX ? 0.17 : 0.01, 0.008, isX ? 0.01 : 0.17), this.materials.aluminum);
                                blade.position.set(fx, 2.226, fz);
                                ups.add(blade);
                            });
                        });

                        // 頂板 + 四角提吊耳
                        const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.024, 1.0), this.materials.darkMetal);
                        topPlate.position.set(0, 2.216, 0);
                        ups.add(topPlate);
                        [[-0.32, -0.42], [0.32, -0.42], [-0.32, 0.42], [0.32, 0.42]].forEach(([lx, lz]) => {
                            const lug = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.058, 0.024), this.materials.aluminum);
                            lug.position.set(lx, 2.242, lz);
                            ups.add(lug);
                        });

                        ups.position.set(xOffset, 0, zPos);

                        const upsHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 1.0), new THREE.MeshBasicMaterial({visible:false}));
                        upsHit.position.y = 1.1;
                        upsHit.userData = this.makeEquipmentData(
                            'UPS', `${labelPrefix} UPS Module ${i+1}`,
                            `${labelPrefix === 'Feed-A' ? 'UPS-A' : 'UPS-B'}-${i+1}`,
                            '500 kVA / 450 kW', '在線雙轉換 UPS，提供 IT critical load 穩壓與短時間後備',
                            `${labelPrefix === 'Feed-A' ? 'MSB-A' : 'MSB-B'} 4000A Bus`,
                            `${labelPrefix} UPS Output Bus → Critical PDU`,
                            '前方 1.2 m、後方 1.0 m；可熱插拔功率模組，維修旁路需 SOP 核准'
                        );
                        ups.add(upsHit);
                        this.interactables.push(upsHit);
                        this.scene.add(ups);

                        // ── 電池櫃（每台 UPS 配 2 台）──────────────
                        for(let b=0; b<2; b++) {
                            const batt = new THREE.Group();

                            // 基座
                            const bBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.02), this.materials.darkMetal);
                            bBase.position.y = 0.04; bBase.castShadow = true;
                            batt.add(bBase);

                            // 主體
                            const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.12, 1.0), this.materials.cabinet);
                            bBody.position.y = 1.14; bBody.castShadow = true;
                            batt.add(bBody);
                            this.addDoorFrame(batt, 0.54, 1.98, 0.514, 1.14);
                            this.addCabinetHardware(batt, 0.528, 1);

                            // 標牌
                            this.addLabelPlane(batt, [`BAT-${i+1}-${b+1}`, '480 VDC STRING'], 0.36, 0.13,
                                { x: 0, y: 2.04, z: 0.516 },
                                { width: 512, height: 160, border: '#38bdf8', color: '#e0f2fe', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 40 });

                            // BMS 顯示面板
                            const bmsFrame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.02), this.materials.darkMetal);
                            bmsFrame.position.set(0, 1.85, 0.508);
                            batt.add(bmsFrame);
                            const bmsCanvas = document.createElement('canvas');
                            bmsCanvas.width = 256; bmsCanvas.height = 128;
                            const bmsCtx = bmsCanvas.getContext('2d');
                            bmsCtx.fillStyle = '#010c10'; bmsCtx.fillRect(0,0,256,128);
                            bmsCtx.fillStyle = '#22d3ee'; bmsCtx.font = 'bold 16px monospace'; bmsCtx.fillText('BMS  FLOAT', 10, 24);
                            bmsCtx.fillStyle = '#4ade80'; bmsCtx.font = 'bold 22px monospace'; bmsCtx.fillText('SOC: 100%', 10, 58);
                            bmsCtx.fillStyle = '#94a3b8'; bmsCtx.font = '13px monospace'; bmsCtx.fillText('V: 481.6  T: 25°C', 10, 88);
                            bmsCtx.fillStyle = '#22c55e'; bmsCtx.font = '12px monospace'; bmsCtx.fillText('ALL NORMAL', 10, 115);
                            const bmsScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.14),
                                new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bmsCanvas) }));
                            bmsScreen.position.set(0, 1.85, 0.52);
                            batt.add(bmsScreen);

                            // 電池抽屜（6 層，帶格柵分隔條 + 通風孔）
                            for(let draw=0; draw<6; draw++) {
                                const yPos = 0.32 + draw * 0.25;
                                const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.21, 0.02), this.materials.darkMetal);
                                drawer.position.set(0, yPos, 0.501);
                                batt.add(drawer);
                                // 把手
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.02), this.materials.aluminum);
                                handle.position.set(0.1, yPos, 0.514);
                                batt.add(handle);
                                // LED 狀態燈
                                const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), this.materials.greenLed);
                                indicator.position.set(-0.2, yPos, 0.514);
                                batt.add(indicator);
                                // 電池格分隔線（模擬 12V 電池組）
                                for(let cell=0; cell<3; cell++) {
                                    const div = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.18, 0.005), this.materials.aluminum);
                                    div.position.set(-0.14 + cell * 0.1, yPos, 0.508);
                                    batt.add(div);
                                }
                                // 散熱通風孔
                                for(let v=0; v<4; v++) {
                                    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.007, 0.003), this.materials.rubber);
                                    slot.position.set(0, yPos - 0.072 + v * 0.036, 0.513);
                                    batt.add(slot);
                                }
                            }

                            // DC 隔離開關（帶 lever + 標籤）
                            const dcBreaker = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.035), this.materials.rubber);
                            dcBreaker.position.set(0.1, 1.55, 0.528);
                            batt.add(dcBreaker);
                            const breakerLever = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.035), this.materials.redLed);
                            breakerLever.rotation.x = -0.35;
                            breakerLever.position.set(0.1, 1.55, 0.555);
                            batt.add(breakerLever);
                            this.addLabelPlane(batt, ['DC ISO', 'ON'], 0.13, 0.09, { x: -0.1, y: 1.55, z: 0.535 },
                                { width: 192, height: 128, border: '#ef4444', color: '#ef4444', font: 'bold 26px monospace' });

                            // 正/負極 DC 母排（含絕緣靴 + 連接螺絲）
                            [
                                { x: -0.2, mat: this.materials.phaseR, label: '+', insulColor: 0xdc2626 },
                                { x: -0.06, mat: this.materials.rubber, label: '-', insulColor: 0x1e293b }
                            ].forEach(bus => {
                                // 絕緣靴
                                const insul = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.55, 0.034),
                                    new THREE.MeshStandardMaterial({ color: bus.insulColor, roughness: 0.65 }));
                                insul.position.set(bus.x, 1.25, 0.529);
                                batt.add(insul);
                                // 銅排本體
                                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.025), bus.mat);
                                bar.position.set(bus.x, 1.25, 0.535);
                                batt.add(bar);
                                // 端子螺絲（上中下）
                                [1.05, 1.25, 1.45].forEach(sy => {
                                    const sbolt = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.015, 6), this.materials.aluminum);
                                    sbolt.rotation.x = Math.PI / 2;
                                    sbolt.position.set(bus.x, sy, 0.548);
                                    batt.add(sbolt);
                                });
                                // 極性標籤
                                this.addLabelPlane(batt, bus.label, 0.07, 0.07, { x: bus.x, y: 0.97, z: 0.552 },
                                    { width: 128, height: 128, bg: 'rgba(2,6,23,0.95)', border: bus.label === '+' ? '#ef4444' : '#e5e7eb', color: '#ffffff', font: 'bold 70px "Segoe UI", sans-serif' });
                            });

                            // DANGER 警告標籤
                            this.addLabelPlane(batt, ['DANGER', 'HIGH DC VOLTAGE'], 0.34, 0.16, { x: 0, y: 0.16, z: 0.538 },
                                { width: 512, height: 180, bg: '#f59e0b', border: '#111827', color: '#111827', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 42 });

                            const bX = xOffset > 0 ? xOffset + 0.85 + b*0.7 : xOffset - 0.85 - b*0.7;
                            batt.position.set(bX, 0, zPos);

                            const battHit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 1.0), new THREE.MeshBasicMaterial({visible:false}));
                            battHit.position.y = 1.1;
                            battHit.userData = this.makeEquipmentData(
                                'Battery', `${labelPrefix} Battery String ${i+1}-${b+1}`,
                                `${labelPrefix === 'Feed-A' ? 'BAT-A' : 'BAT-B'}-${i+1}${b+1}`,
                                '480 VDC / 100 Ah String', 'UPS DC source，市電中斷時維持逆變器輸出',
                                `${labelPrefix} DC Battery Breaker`, `${labelPrefix} UPS-${i+1} DC Link`,
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

                // 建立主配電盤 (PDU / MSB)
                const createPDU = (xPos, label) => {
                    const pdu = new THREE.Group();
                    const isTie = label.includes('Tie');

                    // 基座
                    const pBase = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.82), this.materials.darkMetal);
                    pBase.position.y = 0.04; pdu.add(pBase);

                    // 主體
                    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.12, 0.8), this.materials.cabinet);
                    body.position.y = 1.14; body.castShadow = true;
                    pdu.add(body);
                    this.addDoorFrame(pdu, 1.12, 1.98, 0.416, 1.14, { thickness: 0.022 });
                    this.addCabinetHardware(pdu, 0.432, 1);

                    // 標牌
                    this.addLabelPlane(pdu, [label, '4000A 3P4W'], 0.78, 0.16, { x: 0, y: 2.04, z: 0.418 },
                        { width: 640, height: 160, border: '#60a5fa', color: '#dbeafe', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 42 });

                    // ── 多功能電力錶（Canvas LCD）
                    const meterFrame = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.3, 0.026), this.materials.darkMetal);
                    meterFrame.position.set(0, 1.86, 0.426);
                    pdu.add(meterFrame);
                    const mCanvas = document.createElement('canvas');
                    mCanvas.width = 512; mCanvas.height = 180;
                    const mCtx = mCanvas.getContext('2d');
                    mCtx.fillStyle = '#020b12'; mCtx.fillRect(0,0,512,180);
                    mCtx.fillStyle = '#0f2c40'; mCtx.fillRect(0,0,512,28);
                    mCtx.fillStyle = '#38bdf8'; mCtx.font = 'bold 16px monospace';
                    mCtx.fillText(isTie ? '● TIE PANEL STATUS' : '● POWER METER PM-800', 8, 20);
                    if(isTie) {
                        mCtx.fillStyle = '#fbbf24'; mCtx.font = 'bold 20px monospace'; mCtx.fillText('BUS COUPLER: OPEN', 8, 58);
                        mCtx.fillStyle = '#4ade80'; mCtx.font = '17px monospace'; mCtx.fillText('SYNCHRO CHECK: A=B OK', 8, 90);
                        mCtx.fillStyle = '#94a3b8'; mCtx.font = '14px monospace'; mCtx.fillText('INTERLOCK: ACTIVE', 8, 120);
                        mCtx.fillStyle = '#22c55e'; mCtx.font = '13px monospace'; mCtx.fillText('STANDBY - NO FAULT', 8, 160);
                    } else {
                        [['Vab','380.4V','Ia','1843A'],['Vbc','380.1V','Ib','1851A'],
                         ['kW', '1247 kW','PF','0.989'],['Hz', '60.01Hz','kWh','487,234']].forEach((row, ri) => {
                            const y = 46 + ri * 34;
                            mCtx.fillStyle = '#64748b'; mCtx.font = '14px monospace';
                            mCtx.fillText(row[0]+':', 8, y); mCtx.fillText(row[2]+':', 265, y);
                            mCtx.fillStyle = '#7dd3fc'; mCtx.font = 'bold 15px monospace';
                            mCtx.fillText(row[1], 68, y); mCtx.fillText(row[3], 325, y);
                        });
                        mCtx.fillStyle = '#064e3b'; mCtx.fillRect(0, 162, 512, 18);
                        mCtx.fillStyle = '#4ade80'; mCtx.font = '12px monospace';
                        mCtx.fillText('UTILITY NORMAL  CT: 4000/5A  RELAY: OK', 8, 175);
                    }
                    const meterMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.26),
                        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mCanvas) }));
                    meterMesh.position.set(0, 1.86, 0.44);
                    pdu.add(meterMesh);

                    // 進線 Pilot lamps（3顆：進線 / 母排 / 出線）
                    [this.materials.greenLed, this.materials.greenLed,
                     isTie ? this.materials.yellowLed : this.materials.greenLed].forEach((mat, idx) => {
                        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.028, 14), mat);
                        lamp.rotation.x = Math.PI / 2;
                        lamp.position.set(0.5 - idx * 0.065, 1.72, 0.44);
                        pdu.add(lamp);
                    });

                    // ── AC 母排（R/S/T/N/PE）+ 絕緣子 + 隔相板
                    [
                        { x: -0.38, mat: this.materials.phaseR,     text: 'R' },
                        { x: -0.19, mat: this.materials.phaseS,     text: 'S' },
                        { x: 0,     mat: this.materials.phaseT,     text: 'T' },
                        { x: 0.19,  mat: this.materials.neutral,    text: 'N' },
                        { x: 0.38,  mat: this.materials.yellowGreen,text: 'PE' }
                    ].forEach(bus => {
                        const busBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.028), bus.mat);
                        busBar.position.set(bus.x, 1.28, 0.435);
                        pdu.add(busBar);
                        // 上下絕緣子
                        [1.45, 1.11].forEach(iy => {
                            const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.038, 8), this.materials.rubber);
                            insulator.rotation.x = Math.PI / 2;
                            insulator.position.set(bus.x, iy, 0.455);
                            pdu.add(insulator);
                        });
                        this.addLabelPlane(pdu, bus.text, 0.07, 0.055, { x: bus.x, y: 1.07, z: 0.455 },
                            { width: 128, height: 96, bg: 'rgba(2,6,23,0.95)', border: '#475569', color: '#ffffff', font: 'bold 46px "Segoe UI", sans-serif' });
                    });
                    // 隔相板（4片）
                    for(let s=0; s<4; s++) {
                        const sep = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.36, 0.042), this.materials.rubber);
                        sep.position.set(-0.285 + s * 0.19, 1.28, 0.442);
                        pdu.add(sep);
                    }

                    if(isTie) {
                        // ── Tie Panel：母排聯絡開關
                        const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.4, 0.056), this.materials.rubber);
                        coupler.position.set(0, 0.72, 0.432);
                        pdu.add(coupler);
                        const couplerHandle = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.26, 0.05), this.materials.aluminum);
                        couplerHandle.rotation.x = 0.4;
                        couplerHandle.position.set(0.22, 0.72, 0.476);
                        pdu.add(couplerHandle);
                        // 弧室蓋
                        for(let ac=0; ac<4; ac++) {
                            const arcC = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.026, 0.03), this.materials.darkMetal);
                            arcC.position.set(-0.21 + ac * 0.14, 0.91, 0.445);
                            pdu.add(arcC);
                        }
                        // 聯絡狀態燈（黃/綠）
                        [this.materials.yellowLed, this.materials.greenLed].forEach((mat, idx) => {
                            const l = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), mat);
                            l.position.set(-0.22 + idx * 0.44, 0.72, 0.475);
                            pdu.add(l);
                        });
                        this.addLabelPlane(pdu, ['TIE', 'INTERLOCKED'], 0.44, 0.13, { x: -0.06, y: 0.72, z: 0.49 },
                            { width: 512, height: 160, bg: 'rgba(15,23,42,0.96)', border: '#fbbf24', color: '#fde68a', font: 'bold 32px "Segoe UI", sans-serif', lineHeight: 38 });
                        // 互鎖警示條
                        const interlockBar = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.055, 0.028), this.materials.warning);
                        interlockBar.position.set(0, 0.5, 0.44);
                        pdu.add(interlockBar);
                    } else {
                        // ── MSB：主 ACB + 分路 MCCB

                        // 主 ACB 本體
                        const acb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 0.054), this.materials.rubber);
                        acb.position.set(0, 0.34, 0.435);
                        pdu.add(acb);
                        const acbHandle = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.24, 0.048), this.materials.aluminum);
                        acbHandle.rotation.x = 0.45;
                        acbHandle.position.set(0.18, 0.34, 0.472);
                        pdu.add(acbHandle);
                        // 弧室蓋（5條）
                        for(let ac=0; ac<5; ac++) {
                            const arcChute = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.032), this.materials.darkMetal);
                            arcChute.position.set(-0.26 + ac * 0.13, 0.52, 0.448);
                            pdu.add(arcChute);
                        }
                        // LSIG 保護電驛 LCD
                        const relayFrame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.022), this.materials.darkMetal);
                        relayFrame.position.set(-0.22, 0.34, 0.448);
                        pdu.add(relayFrame);
                        const rCanvas = document.createElement('canvas');
                        rCanvas.width = 256; rCanvas.height = 160;
                        const rCtx = rCanvas.getContext('2d');
                        rCtx.fillStyle = '#010c0a'; rCtx.fillRect(0,0,256,160);
                        rCtx.fillStyle = '#22d3ee'; rCtx.font = 'bold 14px monospace'; rCtx.fillText('LSIG RELAY', 8, 22);
                        rCtx.fillStyle = '#4ade80'; rCtx.font = '14px monospace';
                        rCtx.fillText('TRIP: NONE', 8, 50); rCtx.fillText('CT: 4000/5A', 8, 75); rCtx.fillText('Ir: 100%', 8, 100);
                        rCtx.fillStyle = '#22c55e'; rCtx.font = '12px monospace'; rCtx.fillText('ONLINE / OK', 8, 140);
                        const relayScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.14),
                            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rCanvas) }));
                        relayScreen.position.set(-0.22, 0.34, 0.461);
                        pdu.add(relayScreen);
                        this.addLabelPlane(pdu, ['MAIN ACB', '4000A LSIG'], 0.36, 0.12, { x: 0.12, y: 0.34, z: 0.478 },
                            { width: 512, height: 160, bg: 'rgba(15,23,42,0.96)', border: '#fbbf24', color: '#fde68a', font: 'bold 30px "Segoe UI", sans-serif', lineHeight: 38 });

                        // 分路 MCCB（4×3，帶弧室 + 端子螺絲）
                        for(let r=0; r<4; r++) {
                            for(let c=0; c<3; c++) {
                                const xVal = -0.38 + c * 0.38;
                                const yVal = 0.98 - r * 0.16;
                                // MCCB 主體
                                const breaker = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.046), this.materials.darkMetal);
                                breaker.position.set(xVal, yVal, 0.402);
                                pdu.add(breaker);
                                // 弧室隆起
                                const arc = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.026, 0.03), this.materials.rubber);
                                arc.position.set(xVal, yVal + 0.068, 0.41);
                                pdu.add(arc);
                                // 操作手柄（紅/綠交替）
                                const toggleColor = (r + c) % 2 === 0 ? 0xef4444 : 0x22c55e;
                                const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.072, 0.042),
                                    new THREE.MeshStandardMaterial({ color: toggleColor, roughness: 0.3 }));
                                toggle.rotation.x = (r + c) % 2 === 0 ? -0.4 : 0.4;
                                toggle.position.set(xVal + 0.06, yVal + 0.018, 0.428);
                                pdu.add(toggle);
                                // 指示燈
                                const pduLed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8),
                                    (r + c) % 2 === 0 ? this.materials.redLed : this.materials.greenLed);
                                pduLed.position.set(xVal - 0.08, yVal + 0.055, 0.42);
                                pdu.add(pduLed);
                                // 上下接線端子螺絲
                                [yVal + 0.072, yVal - 0.072].forEach(ty => {
                                    const term = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.013, 6), this.materials.aluminum);
                                    term.rotation.x = Math.PI / 2;
                                    term.position.set(xVal, ty, 0.418);
                                    pdu.add(term);
                                });
                            }
                        }
                    }

                    // Arc Flash 警告標籤
                    this.addLabelPlane(pdu, ['ARC FLASH', 'PPE REQUIRED'], 0.34, 0.16,
                        { x: isTie ? 0 : -0.36, y: isTie ? 1.22 : 0.72, z: 0.452 },
                        { width: 512, height: 180, bg: '#f59e0b', border: '#111827', color: '#111827', font: 'bold 34px "Segoe UI", sans-serif', lineHeight: 42 });

                    // 側板百葉窗
                    for(let j=0; j<14; j++) {
                        [-1, 1].forEach(side => {
                            const louver = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.018, 0.62), this.materials.darkMetal);
                            louver.rotation.z = side * 0.28;
                            louver.position.set(side * 0.604, 0.32 + j * 0.1, 0);
                            pdu.add(louver);
                        });
                    }

                    // 底部接地銅排（黃綠斑馬紋）
                    const earthBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.042, 0.048), this.materials.copper);
                    earthBar.position.set(0, 0.1, 0.38);
                    pdu.add(earthBar);
                    for(let e=0; e<9; e++) {
                        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.05), this.materials.yellowGreen);
                        stripe.position.set(-0.38 + e * 0.095, 0.1, 0.38);
                        pdu.add(stripe);
                    }

                    pdu.position.set(xPos, 0, -5);
                    const pduHit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.8), new THREE.MeshBasicMaterial({visible:false}));
                    pduHit.position.y = 1.1;
                    pduHit.userData = this.makeEquipmentData(
                        'PDU', label,
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

                // 電纜橋架 (Cable Tray) - C型槽鋼截面、精緻懸吊系統
                const createTraySegment = (w, l, x, y, z, rotY) => {
                    const tray = new THREE.Group();

                    // ── 側板：C型槽鋼（腹板 + 上下翼緣）
                    [-1, 1].forEach(side => {
                        const sx = side * w / 2;
                        const inward = -side;
                        // 腹板
                        const web = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.1, l), this.materials.tray);
                        web.position.set(sx, 0, 0);
                        tray.add(web);
                        // 上翼緣（向內折）
                        const topF = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.009, l), this.materials.tray);
                        topF.position.set(sx + inward * 0.018, 0.045, 0);
                        tray.add(topF);
                        // 下翼緣（向內折）
                        const btmF = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.009, l), this.materials.tray);
                        btmF.position.set(sx + inward * 0.018, -0.045, 0);
                        tray.add(btmF);
                    });

                    // ── 梯級橫桿（每 300mm）
                    const rungCount = Math.floor(l / 0.3);
                    for(let i = 0; i < rungCount; i++) {
                        const rung = new THREE.Mesh(new THREE.BoxGeometry(w - 0.014, 0.022, 0.048), this.materials.tray);
                        rung.position.set(0, -0.039, -l/2 + i * 0.3 + 0.15);
                        tray.add(rung);
                    }

                    // ── 懸吊系統（每 2m：Unistrut C槽 + 吊桿 + 防振墊 + 夾板）
                    for(let zPos = -l/2 + 0.8; zPos <= l/2 - 0.8; zPos += 2.0) {
                        const strutW = w + 0.26;
                        // Unistrut C型橫撐本體
                        const strut = new THREE.Mesh(new THREE.BoxGeometry(strutW, 0.04, 0.052), this.materials.aluminum);
                        strut.position.set(0, 1.64, zPos);
                        tray.add(strut);
                        // Unistrut 下唇（C型開口邊緣）
                        const lip = new THREE.Mesh(new THREE.BoxGeometry(strutW, 0.01, 0.014), this.materials.aluminum);
                        lip.position.set(0, 1.619, zPos);
                        tray.add(lip);

                        // 兩側吊桿 + 固定件
                        [-w/2 - 0.02, w/2 + 0.02].forEach(xPos => {
                            // 螺紋吊桿
                            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.66, 8), this.materials.aluminum);
                            rod.position.set(xPos, 0.82, zPos);
                            tray.add(rod);
                            // 頂部防振橡膠墊
                            const vib = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.016, 0.026), this.materials.rubber);
                            vib.position.set(xPos, 1.647, zPos);
                            tray.add(vib);
                            // 固定螺帽（六角片）
                            const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 6), this.materials.aluminum);
                            nut.position.set(xPos, 1.661, zPos);
                            tray.add(nut);
                            // 底部橋架夾板
                            const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.018, 0.042), this.materials.aluminum);
                            clamp.position.set(xPos, -0.062, zPos);
                            tray.add(clamp);
                            // 夾板螺栓
                            const cbolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.022, 6), this.materials.aluminum);
                            cbolt.rotation.x = Math.PI / 2;
                            cbolt.position.set(xPos, -0.062, zPos);
                            tray.add(cbolt);
                        });
                    }

                    // 端蓋（兩端封板）
                    [-l/2 + 0.006, l/2 - 0.006].forEach(ez => {
                        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.1, 0.01), this.materials.tray);
                        cap.position.set(0, 0, ez);
                        tray.add(cap);
                    });

                    tray.position.set(x, y, z);
                    tray.rotation.y = rotY;
                    this.scene.add(tray);
                };

                // PDU 上方的橫向橋架
                createTraySegment(0.8, 10, 0, 3.5, -5, Math.PI/2);
                // 連接到 UPS 的縱向橋架
                createTraySegment(0.6, 9, -3.5, 3.5, -1, 0);
                createTraySegment(0.6, 9, 3.5, 3.5, -1, 0);

                // 垂直落線架（改為有結構感的 C 槽垂直段）
                [-3.0, 3.0].forEach(dx => {
                    const drop = new THREE.Group();
                    // 左右兩條垂直 C 槽
                    [-0.28, 0.28].forEach(sx => {
                        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1.3, 0.1), this.materials.tray);
                        rail.position.set(sx, 0, 0);
                        drop.add(rail);
                        // 翼緣
                        [-0.048, 0.048].forEach(dy => {
                            const flange = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.009, 0.1), this.materials.tray);
                            flange.position.set(sx + (sx > 0 ? -0.018 : 0.018), dy * (1.3 / 0.096), 0);
                            drop.add(flange);
                        });
                    });
                    // 水平橫桿（每 250mm，共 5 條）
                    for(let rr = 0; rr < 5; rr++) {
                        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.56 - 0.014, 0.022, 0.048), this.materials.tray);
                        rung.position.set(0, -0.5 + rr * 0.25, 0.026);
                        drop.add(rung);
                    }
                    drop.position.set(dx, 2.85, -5);
                    this.scene.add(drop);
                });

                // 電纜線束可視化（5心 XLPE 動力電纜：R/S/T/N/PE + 束線帶）
                const createPowerCables = (points, offsetArray, customColors, flowType = 'utility') => {
                    // 5 心標準色：R=紅 S=黃 T=藍 N=灰 PE=黃綠
                    const defaultColors = [0xef4444, 0xfbbf24, 0x3b82f6, 0x6b7280, 0x84cc16];
                    const colors = customColors || defaultColors;

                    // ── 個別導體（XLPE 橡膠外皮質感）
                    offsetArray.forEach((offset, idx) => {
                        const shiftedPoints = points.map(p => new THREE.Vector3(p.x + offset.x, p.y + offset.y, p.z + offset.z));
                        const curve = new THREE.CatmullRomCurve3(shiftedPoints, false, 'centripetal', 0.12);
                        const tubeGeo = new THREE.TubeGeometry(curve, 56, 0.022, 10, false);
                        const color = colors[idx % colors.length];
                        const tubeMat = new THREE.MeshStandardMaterial({
                            color: color,
                            metalness: 0.0,
                            roughness: 0.78,
                            emissive: color,
                            emissiveIntensity: 0.018
                        });
                        const tube = new THREE.Mesh(tubeGeo, tubeMat);
                        tube.userData.flowType = flowType;
                        this.flowMeshes.push(tube);
                        this.scene.add(tube);
                    });

                    // ── 束線帶（每 500mm 一道深色環套）
                    const avgX = offsetArray.reduce((s, o) => s + o.x, 0) / offsetArray.length;
                    const avgY = offsetArray.reduce((s, o) => s + o.y, 0) / offsetArray.length;
                    const bundleCurve = new THREE.CatmullRomCurve3(
                        points.map(p => new THREE.Vector3(p.x + avgX, p.y + avgY, p.z)), false, 'centripetal', 0.12
                    );
                    const tieCount = Math.max(2, Math.floor(bundleCurve.getLength() / 0.5));
                    const tieMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.7 });
                    const up = new THREE.Vector3(0, 1, 0);
                    for(let t = 1; t < tieCount; t++) {
                        const u = t / tieCount;
                        const pt = bundleCurve.getPoint(u);
                        const tangent = bundleCurve.getTangent(u).normalize();
                        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.011, 8, 20), tieMat);
                        tie.position.copy(pt);
                        if(Math.abs(tangent.dot(up)) < 0.999) {
                            tie.quaternion.setFromUnitVectors(up, tangent);
                        } else {
                            tie.rotation.x = tangent.y < 0 ? Math.PI : 0;
                        }
                        this.scene.add(tie);
                    }
                };

                // 5 心電纜排列間距（R / S / T / N / PE）
                const offsets = [
                    { x: -0.088, y: -0.045, z: 0 },
                    { x: -0.044, y: -0.045, z: 0 },
                    { x:  0.000, y: -0.045, z: 0 },
                    { x:  0.044, y: -0.045, z: 0 },
                    { x:  0.088, y: -0.045, z: 0 }
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

                // ============================================================================
                // 高精度發電機組
                // ============================================================================
                function createDetailedGenerator() {
                    const genset = new THREE.Group();

                    // 1. 工業 PBR 材質定義
                    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 }); // 黑鋼/鑄鐵
                    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.4, roughness: 0.5 }); // CAT 工程黃
                    const darkPanelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.6 }); // 暗色金屬烤漆
                    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.3 }); // 鍍鋅排氣管
                    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }); // 橡膠防水條
                    const dangerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }); // 警示紅
                    const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x10b981, emissiveIntensity: 0.6 }); // LED 螢幕

                    // 2. 鋼構底座與堆高機插槽 (Skid Base with Forklift Pockets)
                    const baseGeo = new THREE.BoxGeometry(5.4, 0.4, 2.2);
                    const base = new THREE.Mesh(baseGeo, frameMat);
                    base.position.y = 0.2;
                    genset.add(base);

                    // 利用黑色凹槽模擬堆高機孔
                    const pocketGeo = new THREE.BoxGeometry(0.8, 0.15, 2.25);
                    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x000000 }); // 純黑製造深度感
                    const pocket1 = new THREE.Mesh(pocketGeo, pocketMat);
                    pocket1.position.set(-1.0, 0.2, 0);
                    const pocket2 = new THREE.Mesh(pocketGeo, pocketMat);
                    pocket2.position.set(1.0, 0.2, 0);
                    genset.add(pocket1, pocket2);

                    // 3. 主機防音外殼 (Canopy)
                    const canopyGeo = new THREE.BoxGeometry(4.8, 1.8, 1.8);
                    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
                    canopy.position.set(0, 1.3, 0);
                    genset.add(canopy);

                    // 4. 高細節檢修門生成器 (帶橡膠條、把手、絞鏈)
                    const createDoor = (x, z, rotationY) => {
                        const doorGroup = new THREE.Group();
                        // 底部橡膠防水墊
                        const seal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.02), rubberMat);
                        // 金屬門板
                        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.35, 0.04), darkPanelMat);
                        panel.position.z = 0.02;
                        // 把手
                        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.06), pipeMat);
                        handle.position.set(0.45, 0, 0.04);
                        // 絞鏈 (Hinges)
                        const hinge1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1), frameMat);
                        hinge1.position.set(-0.58, 0.4, 0.02);
                        const hinge2 = hinge1.clone();
                        hinge2.position.set(-0.58, -0.4, 0.02);
                        
                        doorGroup.add(seal, panel, handle, hinge1, hinge2);
                        doorGroup.position.set(x, 1.3, z);
                        doorGroup.rotation.y = rotationY;
                        return doorGroup;
                    };

                    // 兩側共部署 6 扇檢修門
                    genset.add(createDoor(-1.4, 0.9, 0));
                    genset.add(createDoor(0, 0.9, 0));
                    genset.add(createDoor(1.4, 0.9, 0));
                    genset.add(createDoor(-1.4, -0.9, Math.PI));
                    genset.add(createDoor(0, -0.9, Math.PI));
                    genset.add(createDoor(1.4, -0.9, Math.PI));

                    // 5. 前端高密度散熱水箱百葉 (Radiator Louvers)
                    const grilleGroup = new THREE.Group();
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.6), frameMat);
                    grilleGroup.add(frame);
                    for(let i=0; i<12; i++) {
                        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 1.5), darkPanelMat);
                        louver.position.set(0.02, 0.65 - (i * 0.12), 0);
                        louver.rotation.z = Math.PI / 6; // 傾斜百葉
                        grilleGroup.add(louver);
                    }
                    grilleGroup.position.set(-2.4, 1.3, 0);
                    genset.add(grilleGroup);

                    // 6. 數位控制面板與緊急停止按鈕 (HMI & E-Stop)
                    const hmiGroup = new THREE.Group();
                    const cBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.7), darkPanelMat);
                    hmiGroup.add(cBox);
                    // 螢幕與邊框
                    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.5), rubberMat);
                    bezel.position.set(0.21, 0.2, 0);
                    hmiGroup.add(bezel);
                    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), screenMat);
                    lcd.position.set(0.225, 0.2, 0);
                    lcd.rotation.y = Math.PI / 2;
                    hmiGroup.add(lcd);
                    // E-Stop 紅色香菇頭按鈕與黃色底座
                    const eStopBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02), new THREE.MeshStandardMaterial({color: 0xeab308}));
                    eStopBase.rotation.z = Math.PI/2;
                    eStopBase.position.set(0.21, -0.15, 0.15);
                    const eStopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05), dangerMat);
                    eStopBtn.rotation.z = Math.PI/2;
                    eStopBtn.position.set(0.23, -0.15, 0.15);
                    hmiGroup.add(eStopBase, eStopBtn);
                    // 狀態指示燈
                    for(let i=0; i<2; i++){
                        const light = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02), new THREE.MeshStandardMaterial({color: i===0?0x10b981:0xef4444, emissive: i===0?0x10b981:0xef4444, emissiveIntensity: 0.5}));
                        light.rotation.z = Math.PI/2;
                        light.position.set(0.21, -0.15, -0.15 + (i*0.08));
                        hmiGroup.add(light);
                    }
                    hmiGroup.position.set(2.4, 1.3, 0);
                    genset.add(hmiGroup);

                    // 7. 屋頂排氣消音系統 (Exhaust Silencer with Brackets)
                    const mufflerGroup = new THREE.Group();
                    // 橫置主消音鼓
                    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 32), pipeMat);
                    drum.rotation.z = Math.PI / 2;
                    mufflerGroup.add(drum);
                    // 固定支架 (Flanges/Brackets)
                    const bracketGeo = new THREE.BoxGeometry(0.1, 0.2, 0.6);
                    const bracket1 = new THREE.Mesh(bracketGeo, frameMat);
                    bracket1.position.set(-0.6, -0.3, 0);
                    const bracket2 = new THREE.Mesh(bracketGeo, frameMat);
                    bracket2.position.set(0.6, -0.3, 0);
                    mufflerGroup.add(bracket1, bracket2);
                    // 垂直排氣管 (連接引擎)
                    const vPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), darkPanelMat);
                    vPipe.position.set(0.8, -0.5, 0);
                    mufflerGroup.add(vPipe);
                    // 防燙隔熱金屬網 (Heat Shield) 
                    const cageMat = new THREE.MeshStandardMaterial({color: 0xaaaaaa, wireframe: true});
                    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12), cageMat);
                    cage.position.set(0.8, -0.5, 0);
                    mufflerGroup.add(cage);
                    // 尾段排氣管與防雨帽 (Rain Cap)
                    const outPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 16), pipeMat);
                    outPipe.position.set(-0.9, 0.5, 0);
                    mufflerGroup.add(outPipe);
                    const rainCap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), frameMat);
                    rainCap.position.set(-0.9, 0.8, 0.04);
                    rainCap.rotation.x = -Math.PI / 5;
                    mufflerGroup.add(rainCap);
                    
                    mufflerGroup.position.set(0, 2.6, 0);
                    genset.add(mufflerGroup);

                    // 8. 警示標語 (Danger Decals)
                    const dangerLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), dangerMat);
                    dangerLabel.position.set(0.6, 1.8, 0.93);
                    genset.add(dangerLabel);

                    // 陰影設定
                    genset.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    return genset;
                }

                const detailedGenerator = createDetailedGenerator();
                detailedGenerator.position.set(genX, 0, genZ);
                genGroup.add(detailedGenerator);

                // 互動透明框
                const genHit = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.6, 2.2), new THREE.MeshBasicMaterial({visible:false}));
                genHit.position.set(genX, 1.3, genZ);
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