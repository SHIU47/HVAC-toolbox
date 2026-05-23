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
            simPanelOpen: false,
            doorsOpen: false, rackFrontDoors: [],
            chillerDown: false,
            supplyTempOffset: 0,
            
            // 爆炸拆解狀態與儲存容器
            isExploded: false,
            explodeProgress: { val: 0 },
            explodeInstancedMeshes: [],
            explodeShells: [],
            
            iData: { 
                trayBase:[], traySide:[], pcb:[],
                coldPlate:[], cpuColdPlate:[], hoseThick:[], qdc:[], nvLink:[],
                dimm:[], vrm:[], psu:[], 
                cableRed:[], cableBlack:[],
                fp:[], lcd:[], ports:[]
            },
            
            materials: {}, textures: {}, pipeUniforms: { time: { value: 0 } }, pipeGroup: null,

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
                this.buildHotAisleContainment(); 
                this.buildDataCenter(); 
                this.buildPiping();
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

            toggleSimPanel() {
                this.simPanelOpen = !this.simPanelOpen;
                const overlay = document.getElementById('sim-modal-overlay');
                const btn = document.getElementById('btn_sim');
                
                if(this.simPanelOpen) {
                    overlay.classList.add('active');
                    btn.classList.add('active');
                    this.closeDetail(); 
                } else {
                    overlay.classList.remove('active');
                    btn.classList.remove('active');
                }
            },

            // ============================================================================
            // 核心模擬計算邏輯 v2.0 - 工程級精緻版
            // 重點修正：
            //   - 二次側供回水 45/55°C，一次側 40/50°C → 適合 Free Cooling
            //   - LMTD 法熱交換器驗算
            //   - 部分自然冷卻 (Partial Free Cooling) 邏輯
            //   - 詳細管路壓損拆解 (直管 + 局部損失)
            //   - 冰機部分負載效率曲線 (IPLV)
            //   - N+1 冗餘設計驗算
            //   - 完整 PUE 拆解
            // ============================================================================
            runSimulation() {
                // ================================================================
                // 0. 讀取 UI 輸入參數
                // ================================================================
                const rackKW            = parseFloat(document.getElementById('sim_rack_kw').value)       || 120;
                const rackCountPerRow   = parseInt(document.getElementById('sim_rack_count').value)       || 5;
                const rowCount          = parseInt(document.getElementById('sim_row_count').value)        || 2;
                const totalRacks        = rackCountPerRow * rowCount;

                const cduCount          = parseInt(document.getElementById('sim_cdu_count').value)        || 2;
                const cduCapacity       = parseFloat(document.getElementById('sim_cdu_capacity').value)   || 800;  // kW/台
                const infraKW           = parseFloat(document.getElementById('sim_infra_kw').value)       || 50;

                // 二次側 (TCS - Technology Cooling System)
                const T2_supply         = parseFloat(document.getElementById('sim_supply_temp').value)    || 45;   // ★ 提高至 45°C
                const T2_return         = parseFloat(document.getElementById('sim_return_temp').value)    || 55;   // ★ 提高至 55°C
                const liquidRatioInput  = parseFloat(document.getElementById('sim_liquid_ratio').value)   || 80;
                const liquidCoolingRatio = liquidRatioInput / 100;
                const coolantType       = document.getElementById('sim_coolant_type').value               || 'pg25';

                // 一次側 (FCS - Facility Cooling System)
                const T1_supply         = parseFloat(document.getElementById('sim_t1_supply')?.value)     || 40;   // ★ 提高至 40°C
                const T1_return         = parseFloat(document.getElementById('sim_t1_return')?.value)     || 50;   // ★ 提高至 50°C

                // 環境與冷卻塔條件
                const ambientDB         = parseFloat(document.getElementById('sim_ambient_db')?.value)    || 28;   // 室外乾球溫度
                const ambientWB         = parseFloat(document.getElementById('sim_ambient_wb')?.value)    || 24;   // 室外濕球溫度
                const altitude          = parseFloat(document.getElementById('sim_altitude')?.value)      || 0;    // 海拔 (m)

                // 管路設計參數
                const pipeMainDia       = parseFloat(document.getElementById('sim_pipe_dia')?.value)      || 200;  // 主管管徑 mm
                const pipeBranchDia     = parseFloat(document.getElementById('sim_branch_dia')?.value)    || 50;   // 分支管管徑 mm
                const pipeLength        = parseFloat(document.getElementById('sim_pipe_length')?.value)   || 100;  // 等效管路長度 m

                // ================================================================
                // 1. 冷卻液物性計算 (Temperature-Dependent Properties)
                // ================================================================
                const calcCoolantProps = (type, T_avg) => {
                    let rho, cp, mu, k;  // 密度, 比熱, 動力黏度, 熱傳導率
                    switch (type) {
                        case 'water':
                            rho = 1000.6 - 0.0128 * T_avg * T_avg;                    // kg/m³ (IAPWS 近似)
                            cp  = 4.2174 - 0.00137 * T_avg + 0.0000178 * T_avg * T_avg; // kJ/(kg·K)
                            mu  = 2.414e-5 * Math.pow(10, 247.8 / (T_avg + 273.15 - 140)); // Pa·s (Dorsey 方程, IAPWS, 誤差<2% @ 0~100°C)
                            k   = 0.569 + 0.0019 * T_avg - 0.0000078 * T_avg * T_avg; // W/(m·K)
                            break;
                        case 'pg25': // 25% Propylene Glycol
                            rho = 1038.5 - 0.38 * T_avg - 0.0018 * T_avg * T_avg;
                            cp  = 3.74 + 0.0048 * T_avg;
                            mu  = 0.001 * Math.exp(-0.028 * T_avg + 2.1);
                            k   = 0.44 + 0.0008 * T_avg;
                            break;
                        case 'pg30': // 30% Propylene Glycol
                            rho = 1044.2 - 0.42 * T_avg - 0.002 * T_avg * T_avg;
                            cp  = 3.66 + 0.0045 * T_avg;
                            mu  = 0.001 * Math.exp(-0.026 * T_avg + 2.35);
                            k   = 0.42 + 0.0007 * T_avg;
                            break;
                        case 'eg25': // 25% Ethylene Glycol
                            rho = 1042.0 - 0.44 * T_avg - 0.002 * T_avg * T_avg;
                            cp  = 3.72 + 0.0042 * T_avg;
                            mu  = 0.001 * Math.exp(-0.03 * T_avg + 2.0);
                            k   = 0.46 + 0.0009 * T_avg;
                            break;
                        default:     // 預設 = pg25
                            rho = 1038.5 - 0.38 * T_avg - 0.0018 * T_avg * T_avg;
                            cp  = 3.74 + 0.0048 * T_avg;
                            mu  = 0.001 * Math.exp(-0.028 * T_avg + 2.1);
                            k   = 0.44 + 0.0008 * T_avg;
                    }
                    return { rho, cp, mu, k };
                };

                const T2_avg = (T2_supply + T2_return) / 2;
                const T1_avg = (T1_supply + T1_return) / 2;
                const props2 = calcCoolantProps(coolantType, T2_avg);
                const props1 = calcCoolantProps('water', T1_avg);

                // ================================================================
                // 2. IT 負載拆解
                // ================================================================
                const Q_total   = rackKW * totalRacks;                      // 總 IT 負載 (kW)
                const Q_liquid  = Q_total * liquidCoolingRatio;             // 液冷散熱需求 (kW)
                const Q_air     = Q_total * (1 - liquidCoolingRatio);       // 空冷散熱需求 (kW)
                const Q_per_rack_liquid = totalRacks > 0 ? Q_liquid / totalRacks : 0;

                // ================================================================
                // 3. 二次側 (TCS) 流體力學
                // ================================================================
                const deltaT2 = T2_return - T2_supply;
                let flow2_m3h = 0, flow2_lpm = 0, flow2_kg_s = 0;
                let pump2_power = 0, dp2_total = 0;

                if (deltaT2 > 0) {
                    // 質量流量: m = Q / (cp × ΔT)
                    flow2_kg_s = Q_liquid / (props2.cp * deltaT2);
                    // 體積流量
                    flow2_m3h = (flow2_kg_s / props2.rho) * 3600;
                    flow2_lpm = flow2_m3h * 1000 / 60;

                    // ===== 管路壓損分項計算 =====
                    // (a) 直管摩擦損失 (Darcy-Weisbach)
                    const D_main  = pipeMainDia / 1000;   // m
                    const A_main  = Math.PI * D_main * D_main / 4;
                    const v_main  = (flow2_kg_s / props2.rho) / A_main; // 主管流速 m/s
                    const Re_main = (props2.rho * v_main * D_main) / props2.mu;

                    // Swamee-Jain 顯式摩擦係數 (適用 Re > 4000 之紊流)
                    const epsilon = 0.000045;  // 不鏽鋼管壁粗度 m
                    const f_main  = Re_main > 2300 ?
                        0.25 / Math.pow(Math.log10(epsilon / (3.7 * D_main) + 5.74 / Math.pow(Re_main, 0.9)), 2)
                        : 64 / Math.max(Re_main, 100); // 層流

                    const dp_straight = f_main * (pipeLength / D_main) * 0.5 * props2.rho * v_main * v_main; // Pa

                    // (b) 局部阻力損失 (K 值法)
                    //     - 90° 彎頭 × 20 個 (K=0.9)
                    //     - T 型三通 × 10 個 (K=1.8, 分流)
                    //     - 球閥 × 6 個 (K=0.1, 全開)
                    //     - Y 型濾器 × 2 個 (K=3.0)
                    //     - 板式熱交換器 × 1 (K=15.0, 含流道)
                    //     - QDC 盲插接頭 × (totalRacks * 2) (K=2.5 per pair)
                    //     - 縮放管 × 4 (K=0.5)
                    const K_total = (20 * 0.9)   // 90° 彎頭
                                  + (10 * 1.8)   // T 型三通
                                  + (6  * 0.1)   // 球閥
                                  + (2  * 3.0)   // Y 型濾器
                                  + (1  * 15.0)  // PHX (板式熱交換器)
                                  + (totalRacks * 2 * 2.5)  // QDC 盲插接頭
                                  + (4  * 0.5);  // 縮放管
                    const dp_fittings = K_total * 0.5 * props2.rho * v_main * v_main;

                    // (c) 高差壓頭 (假設機櫃高度 2m, 靜壓在循環管路中抵銷, 但泵浦需克服啟動靜揚程)
                    const dp_static = 0; // 閉式系統，靜壓自平衡

                    // (d) 安全裕度 15%
                    dp2_total = (dp_straight + dp_fittings + dp_static) * 1.15;

                    // 二次側泵浦功耗
                    const pump2_eff  = 0.72;  // 泵浦效率 (含馬達)
                    const vfd_factor = 0.97;  // VFD 變頻損失
                    const flow2_m3s  = flow2_kg_s / props2.rho;
                    pump2_power = (flow2_m3s * dp2_total) / (pump2_eff * vfd_factor) / 1000; // kW

                    // 二次側泵浦 N+1 冗餘 (每台 CDU 含雙泵)
                    // 若單泵故障，備援泵接手 → 不額外增加總功耗，但設計流量需滿足
                }

                // 流速驗算
                const D_main_m = pipeMainDia / 1000;
                const A_main_m = Math.PI * D_main_m * D_main_m / 4;
                const v_main_actual = flow2_kg_s > 0 ? (flow2_kg_s / props2.rho) / A_main_m : 0;
                const Re_check = (props2.rho * v_main_actual * D_main_m) / props2.mu;

                // 分支管流速
                const D_branch_m = pipeBranchDia / 1000;
                const A_branch_m = Math.PI * D_branch_m * D_branch_m / 4;
                const flow_per_rack_m3s = totalRacks > 0 ? (flow2_kg_s / props2.rho) / totalRacks : 0;
                const v_branch_actual = A_branch_m > 0 ? flow_per_rack_m3s / A_branch_m : 0;

                // ================================================================
                // 4. 板式熱交換器 (PHX) 驗算 - LMTD 法
                // ================================================================
                // 逆流配置: 二次側熱水(T2_return) → PHX → 二次側冷水(T2_supply)
                //           一次側冷水(T1_supply) → PHX → 一次側熱水(T1_return)
                const dT_hot  = T2_return - T1_return;    // 熱端溫差
                const dT_cold = T2_supply - T1_supply;    // 冷端溫差
                const deltaT1 = T1_return - T1_supply;    // ★ 移至此處：確保 deltaT1 提前宣告供後續使用

                let LMTD = 0;
                if (dT_hot > 0 && dT_cold > 0) {
                    if (Math.abs(dT_hot - dT_cold) < 0.01) {
                        LMTD = dT_hot; // 當溫差幾乎相等時避免除以零
                    } else {
                        LMTD = (dT_hot - dT_cold) / Math.log(dT_hot / dT_cold);
                    }
                }

                // 換熱器有效性 (ε-NTU 交叉驗算)
                const C2 = flow2_kg_s * props2.cp;  // 二次側熱容流量 kW/K
                const flow1_kg_s_calc = (deltaT2 > 0 && deltaT1 > 0) ? Q_liquid / (props1.cp * deltaT1) : 0;
                const C1 = flow1_kg_s_calc * props1.cp;
                const C_min = Math.min(C1, C2);
                const C_max = Math.max(C1, C2);
                const C_ratio = C_max > 0 ? C_min / C_max : 0;
                const hx_effectiveness = C_min > 0 ? Q_liquid / (C_min * (T2_return - T1_supply)) : 0;

                // PHX 所需面積估算 (U 值範圍: 3000~6000 W/m²K for BPHE)
                const U_hx = 4500; // W/(m²·K) 典型焊接板式
                const A_hx_required = LMTD > 0 ? (Q_liquid * 1000) / (U_hx * LMTD) : 0; // m²

                // Fouling Factor 考量 (AHRI 污垢係數)
                const R_fouling = 0.000044; // m²K/W (清潔循環系統)
                const U_hx_fouled = 1 / (1 / U_hx + R_fouling);
                const A_hx_fouled = LMTD > 0 ? (Q_liquid * 1000) / (U_hx_fouled * LMTD) : 0;

                // 單台 CDU 內的 PHX 面積 (典型 BPHE 40~80 plates, 約 2~8 m²)
                const A_hx_per_cdu = cduCount > 0 ? A_hx_fouled / cduCount : A_hx_fouled;

                // ================================================================
                // 5. 一次側 (FCS) 流體力學
                // ================================================================
                let flow1_m3h = 0, flow1_lpm = 0;

                // 一次側需帶走的總熱量 = 液冷 + 泵浦廢熱
                const Q_primary = Q_liquid + pump2_power * 0.85; // 85% 泵浦廢熱進入水路

                if (deltaT1 > 0) {
                    const flow1_kg_s = Q_primary / (props1.cp * deltaT1);
                    flow1_m3h = (flow1_kg_s / props1.rho) * 3600;
                    flow1_lpm = flow1_m3h * 1000 / 60;
                }

                // 一次側泵浦功耗 (估算: 較長管路 + 冷卻塔盤管阻力)
                const dp1_estimated = 250000; // 250 kPa (含冷卻塔、管路、閥件)
                const flow1_m3s = flow1_m3h / 3600;
                const pump1_eff = 0.75;
                const pump1_power = flow1_m3s > 0 ? (flow1_m3s * dp1_estimated) / pump1_eff / 1000 : 0; // kW

                // ================================================================
                // 6. Free Cooling 分析 (部分自然冷卻)
                // ================================================================
                // 冷卻塔出水溫度 = 濕球溫度 + 趨近溫度 (Approach)
                const ct_approach   = 3.5;   // 冷卻塔趨近溫度 °C (高效填料塔)
                const ct_range      = deltaT1; // 冷卻塔溫差 = 一次側 ΔT
                const T_ct_supply   = ambientWB + ct_approach; // 冷卻塔可提供的最低水溫

                // Free Cooling 判定邏輯 (三種模式)
                let freeCoolingMode = 'NONE';
                let freeCoolingFraction = 0; // 自然冷卻佔比 (0~1)
                let T_blend_supply = T1_supply; // 混合後的實際供水溫度

                if (T_ct_supply <= T1_supply) {
                    // Case A: 全自然冷卻 - 冷卻塔出水已低於需求供水溫
                    freeCoolingMode = 'FULL';
                    freeCoolingFraction = 1.0;
                    T_blend_supply = T_ct_supply;
                } else if (T_ct_supply <= T1_return) {
                    // Case B: 部分自然冷卻 - 冷卻塔出水介於供/回水溫之間
                    // 需透過三通閥混合冷卻塔水與回水，再由冰機補冷
                    freeCoolingMode = 'PARTIAL';
                    // 冷卻塔可消除的溫差佔比
                    freeCoolingFraction = (T1_return - T_ct_supply) / (T1_return - T1_supply);
                    freeCoolingFraction = Math.min(Math.max(freeCoolingFraction, 0), 1);
                    T_blend_supply = T1_return - freeCoolingFraction * deltaT1;
                } else {
                    // Case C: 無自然冷卻 - 冷卻塔出水高於回水溫
                    freeCoolingMode = 'NONE';
                    freeCoolingFraction = 0;
                }

                // ================================================================
                // 7. 冰水主機 (Chiller) 分析
                // ================================================================
                // 總冷負荷供後面顯示等邏輯參考使用
                const Q_chiller_total = Q_primary + Q_air;

                // 液冷冰機 (高溫)
                const Q_chiller_liquid_total = Q_primary;
                const Q_chiller_liquid_actual = Q_primary * (1 - freeCoolingFraction);
                
                // 冰機效率 - 基於部分負載曲線 (ARI 550/590 參考)
                let cop_full_load;
                if (T1_supply >= 25) {
                    cop_full_load = 8.0 + (T1_supply - 25) * 0.3;
                } else if (T1_supply >= 12) {
                    cop_full_load = 5.5 + (T1_supply - 12) * 0.2;
                } else {
                    cop_full_load = 5.0 + (T1_supply - 7) * 0.1;
                }

                const plr = Q_chiller_liquid_total > 0 ? Math.min(Q_chiller_liquid_actual / Q_chiller_liquid_total, 1.0) : 0;
                // PLR 效率曲線：連續分段線性，峰值效率在 PLR≈0.75，符合 ARI 550/590 IPLV 加權分佈
                // cop_full_load 代表額定工況 (設計點 PLR≈0.75) 的 COP
                let cop_actual;
                if (plr >= 0.75) {
                    // PLR 0.75→1.0：全載時有凝結器壓升，效率從峰值下滑至 ×0.85
                    cop_actual = cop_full_load * (1.00 - 0.15 * (plr - 0.75) / 0.25);
                } else if (plr >= 0.50) {
                    // PLR 0.50→0.75：接近峰值效率區，×0.95→×1.00
                    cop_actual = cop_full_load * (0.95 + 0.05 * (plr - 0.50) / 0.25);
                } else if (plr >= 0.25) {
                    // PLR 0.25→0.50：部分負載漸減，×0.85→×0.95
                    cop_actual = cop_full_load * (0.85 + 0.10 * (plr - 0.25) / 0.25);
                } else if (plr > 0) {
                    // PLR 0→0.25：低載區，×0.70→×0.85
                    cop_actual = cop_full_load * (0.70 + 0.15 * plr / 0.25);
                } else {
                    cop_actual = cop_full_load; // 冰機停機，數值不影響 chiller_power (=0)
                }

                const chiller_power_liquid = cop_actual > 0 ? Q_chiller_liquid_actual / cop_actual : 0;

                // 空冷專用冰機 (低溫冰水)
                const crah_cop = 5.5;
                const chiller_power_air = Q_air / crah_cop;
                
                const chiller_power = chiller_power_liquid + chiller_power_air;

                // 更新實際冰機總處理熱量 (給塔與介面使用)
                const Q_chiller_actual = Q_chiller_liquid_actual + Q_air;

                // ================================================================
                // 8. 冷卻塔 (Cooling Tower) 功耗
                // ================================================================
                // 冷卻塔風扇功耗 = 散熱量相關 (典型 0.015~0.025 kW/kW_rejection)
                const Q_ct_rejection = Q_chiller_actual + chiller_power; // 冷卻塔排熱 = 冰機冷負荷 + 壓縮功
                const ct_fan_specific = 0.02; // kW_fan / kW_rejection
                const ct_fan_power = Q_ct_rejection * ct_fan_specific;

                // Free Cooling 模式額外冷卻塔負荷 (直接散熱)
                const Q_fc_rejection = Q_primary * freeCoolingFraction;
                const ct_fc_fan_power = Q_fc_rejection * ct_fan_specific * 1.2; // Free Cooling 需更大風量

                const ct_total_fan = ct_fan_power + ct_fc_fan_power;

                // 冷卻水泵 (Condenser Water Pump)
                const cw_pump_power = Q_ct_rejection > 0 ? Q_ct_rejection * 0.012 : 0; // kW

                // ================================================================
                // 9. 空冷系統 (CRAH / In-Row Cooling)
                // ================================================================
                // CRAH 風機功耗 (EC Fan, 依 Q_air 比例)
                const crah_fan_specific = 0.06; // kW_fan / kW_cooling (EC 風機)
                const crah_fan_power = Q_air * crah_fan_specific;

                // ================================================================
                // 10. CDU 附屬功耗 (CDU Ancillary)
                // ================================================================
                // CDU 內部控制器、感測器、填充泵待機功耗
                const cdu_control_power_each = 0.5; // kW/台
                const cdu_total_control = cduCount * cdu_control_power_each;

                // CDU 風扇 (僅 L2A 型有，L2L 型無)
                const cdu_fan_power_each = 0;  // L2L 型不需風扇, 設 0
                const cdu_total_fan = cduCount * cdu_fan_power_each;

                // ================================================================
                // 11. CDU Sizing & 冗餘驗算
                // ================================================================
                const cdu_load_per_unit       = cduCount > 0 ? Q_liquid / cduCount : Q_liquid;
                const cdu_recommended_cap     = cdu_load_per_unit / 0.75;  // 75% 設計負載率
                const cdu_actual_load_pct     = (cduCount * cduCapacity) > 0 
                                                ? (Q_liquid / (cduCount * cduCapacity)) * 100 : 0;

                // N+1 冗餘: 若少一台 CDU，剩餘機台的負載率
                const cdu_n1_load_pct = cduCount > 1 
                    ? (Q_liquid / ((cduCount - 1) * cduCapacity)) * 100 : 999;

                // 單台 CDU 流量
                const cdu_flow_per_unit = cduCount > 0 ? flow2_m3h / cduCount : flow2_m3h;

                // 單機櫃流量
                const flow_per_rack = totalRacks > 0 ? flow2_m3h / totalRacks : 0;
                const flow_per_rack_lpm = flow_per_rack * 1000 / 60;

                // ================================================================
                // 12. PUE 完整拆解
                // ================================================================
                const power_breakdown = {
                    it_load:        Q_total,
                    pump_secondary: pump2_power,
                    pump_primary:   pump1_power,
                    chiller:        chiller_power,
                    ct_fan:         ct_total_fan,
                    cw_pump:        cw_pump_power,
                    crah_fan:       crah_fan_power,
                    cdu_ancillary:  cdu_total_control + cdu_total_fan,
                    infra:          infraKW,
                    power_loss:     Q_total * 0.04,
                };

                const total_facility_power = Object.values(power_breakdown).reduce((a, b) => a + b, 0);
                const total_cooling_overhead = total_facility_power - Q_total - infraKW;
                const pue = Q_total > 0 ? total_facility_power / Q_total : 0;

                // 分項 PUE 貢獻
                const pue_cooling    = Q_total > 0 ? total_cooling_overhead / Q_total : 0;
                const pue_infra      = Q_total > 0 ? infraKW / Q_total : 0;

                // 冷凍噸
                const RT_primary = Q_primary / 3.517;
                const RT_total   = Q_chiller_total / 3.517;
                const RT_chiller_actual = Q_chiller_actual / 3.517;

                // ================================================================
                // 13. 年度能耗與 Free Cooling 小時數估算
                // ================================================================
                // 台北地區月均濕球溫度 (近似參考值)
                const monthlyWB = [16.5, 16.8, 18.5, 21.2, 24.0, 26.2, 27.5, 27.2, 25.8, 23.0, 20.5, 17.8];
                let fc_full_hours = 0, fc_partial_hours = 0;
                const hoursPerMonth = 730;

                monthlyWB.forEach(wb => {
                    const T_ct_month = wb + ct_approach;
                    if (T_ct_month <= T1_supply) {
                        fc_full_hours += hoursPerMonth;
                    } else if (T_ct_month <= T1_return) {
                        fc_partial_hours += hoursPerMonth;
                    }
                });

                const annual_fc_savings_pct = ((fc_full_hours + fc_partial_hours * 0.5) / 8760) * 100;

                // 年度電費估算 (台灣工業電價 ~3.5 TWD/kWh)
                const electricity_rate = 3.5;
                const annual_kwh_cooling = total_cooling_overhead * 8760;
                const annual_cost_cooling = annual_kwh_cooling * electricity_rate;
                // Free Cooling 節省金額 (粗估)
                const annual_saving = annual_cost_cooling * (annual_fc_savings_pct / 100) * 0.3;

                // ================================================================
                // 14. UI 綁定
                // ================================================================
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = val;
                };

                // 基本結果
                setVal('res_total_load',    Q_total.toFixed(0));
                setVal('res_heat_load',     Q_liquid.toFixed(0));
                setVal('res_delta_t',       deltaT2.toFixed(1));
                setVal('res_flow_rate',     flow2_m3h.toFixed(1));
                setVal('res_flow_lpm',      flow2_lpm.toFixed(0));
                setVal('res_primary_flow',  flow1_m3h.toFixed(1));
                setVal('res_cooling_tons',  RT_primary.toFixed(1));
                setVal('res_cooling_tons_total', RT_total.toFixed(1));
                setVal('res_chiller_req_rt', RT_chiller_actual.toFixed(1));

                // CDU
                setVal('res_cdu_req_cap',   cdu_recommended_cap.toFixed(0));
                setVal('res_cdu_load',      cdu_actual_load_pct.toFixed(1));
                setVal('res_cdu_n1_load',   cdu_n1_load_pct.toFixed(1));
                setVal('res_cdu_flow',      cdu_flow_per_unit.toFixed(1));

                // 空冷
                setVal('res_air_load',      Q_air.toFixed(0));

                // PUE
                setVal('res_pue',           pue.toFixed(3));
                setVal('res_pue_cooling',   pue_cooling.toFixed(3));

                // 管路
                setVal('res_dp_total',      (dp2_total / 1000).toFixed(1));     // kPa
                setVal('res_v_main',        v_main_actual.toFixed(2));           // m/s
                setVal('res_v_branch',      v_branch_actual.toFixed(2));         // m/s

                // 熱交換器
                setVal('res_lmtd',          LMTD.toFixed(2));
                setVal('res_hx_eff',        (hx_effectiveness * 100).toFixed(1));
                setVal('res_hx_area',       A_hx_fouled.toFixed(1));
                setVal('res_hx_area_cdu',   A_hx_per_cdu.toFixed(1));

                // Free Cooling
                setVal('res_fc_mode',       freeCoolingMode);
                setVal('res_fc_fraction',   (freeCoolingFraction * 100).toFixed(1));
                setVal('res_ct_supply',     T_ct_supply.toFixed(1));
                setVal('res_fc_hours',      (fc_full_hours + fc_partial_hours).toString());
                setVal('res_fc_saving_pct', annual_fc_savings_pct.toFixed(1));

                // 冰機
                setVal('res_chiller_cop',   cop_actual.toFixed(2));
                setVal('res_chiller_power', chiller_power.toFixed(1));
                setVal('res_chiller_plr',   (plr * 100).toFixed(1));

                // 功耗拆解
                setVal('res_pw_pump2',      pump2_power.toFixed(1));
                setVal('res_pw_pump1',      pump1_power.toFixed(1));
                setVal('res_pw_chiller',    chiller_power.toFixed(1));
                setVal('res_pw_ct',         ct_total_fan.toFixed(1));
                setVal('res_pw_crah',       crah_fan_power.toFixed(1));
                setVal('res_pw_cdu_aux',    (cdu_total_control + cdu_total_fan).toFixed(1));
                setVal('res_pw_infra',      infraKW.toFixed(1));
                setVal('res_pw_total',      total_facility_power.toFixed(0));

                // 物性
                setVal('res_rho2',          props2.rho.toFixed(1));
                setVal('res_cp2',           props2.cp.toFixed(3));
                setVal('res_mu2',           (props2.mu * 1000).toFixed(2)); // mPa·s
                setVal('res_Re_main',       Re_check ? Re_check.toFixed(0) : '-');

                
                // Send simulation sizing result to portal
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        type: 'sizing_result',
                        module: 'whitespace',
                        data: {
                            pue: pue,
                            pue_cooling: pue_cooling,
                            total_load: Q_total,
                            heat_load: Q_liquid,
                            air_load: Q_air,
                            cooling_tons: RT_primary,
                            cdu_load_pct: cdu_actual_load_pct
                        }
                    }, '*');
                }

                // 展開結果面板
                const resultsEl = document.getElementById('sim-results');
                if (resultsEl) {
                    resultsEl.classList.remove('hidden');
                    resultsEl.classList.add('flex');
                }

                // 同步 HUD
                this.setLiveVal('hud_val_load',   Q_total.toString(), '10');
                this.setLiveVal('hud_val_supply', T2_supply.toFixed(1), '0.2');
                this.setLiveVal('hud_val_return', T2_return.toFixed(1), '0.4');
                this.setLiveVal('hud_val_pue',    pue.toFixed(3), '0.005');
                this.setLiveVal('hud_val_flow',   flow2_m3h.toFixed(0), (flow2_m3h * 0.02).toFixed(0));
                
                // HUD 只有 5 個數字框，這裡先檢查 hud_val_fc 是否存在避免報錯
                const fcEl = document.getElementById('hud_val_fc');
                if(fcEl) {
                    this.setLiveVal('hud_val_fc', freeCoolingMode, '');
                }

                // ================================================================
                // 15. 工程防呆與警告
                // ================================================================
                const warnings = [];

                // --- 致命錯誤 (阻止設計繼續) ---
                if (deltaT2 <= 0)
                    warnings.push('❌ 致命：二次側 ΔT ≤ 0（回水溫必須高於供水溫）');
                if (deltaT1 <= 0)
                    warnings.push('❌ 致命：一次側 ΔT ≤ 0（回水溫必須高於供水溫）');
                if (T2_supply <= T1_supply)
                    warnings.push('❌ 致命：二次側供水溫 ≤ 一次側供水溫，熱交換器無法運作（違反熱力學第二定律）');
                if (dT_hot <= 0 || dT_cold <= 0)
                    warnings.push('❌ 致命：PHX 端溫差出現交叉（Temperature Cross），請調整供回水溫度設定');

                // --- 溫度設計警告 ---
                if (LMTD < 2)
                    warnings.push(`⚠️ PHX 對數平均溫差僅 ${LMTD.toFixed(1)}°C，過低將導致需求面積暴增，建議 LMTD ≥ 3°C`);
                if (T2_return > 65)
                    warnings.push(`⚠️ 二次側回水 ${T2_return}°C > 65°C，需確認快接頭與墊片材質 (建議選用 FKM 或高溫 EPDM)`);
                if (T2_supply < 25)
                    warnings.push(`⚠️ 二次側供水 ${T2_supply}°C < 25°C，需注意機櫃內部可能產生凝結水（露點風險）`);
                if (T1_supply < ambientWB + ct_approach)
                    warnings.push(`⚠️ 一次側供水 ${T1_supply}°C 低於冷卻塔極限出水 ${T_ct_supply.toFixed(1)}°C，Free Cooling 不可行，需依賴冰機`);

                // --- 流體力學警告 ---
                if (v_main_actual > 3.0)
                    warnings.push(`🌊 主管流速 ${v_main_actual.toFixed(2)} m/s > 3.0 m/s，噪音與沖蝕風險，建議放大管徑至 ${(pipeMainDia * 1.2).toFixed(0)} mm`);
                else if (v_main_actual > 2.5)
                    warnings.push(`🌊 主管流速 ${v_main_actual.toFixed(2)} m/s 偏高（建議 ≤ 2.5 m/s），可考慮放大管徑`);
                if (v_main_actual < 0.5 && v_main_actual > 0)
                    warnings.push(`🌊 主管流速 ${v_main_actual.toFixed(2)} m/s < 0.5 m/s，可能導致氣泡積聚與水質問題`);
                if (v_branch_actual > 2.0)
                    warnings.push(`🌊 分支管流速 ${v_branch_actual.toFixed(2)} m/s > 2.0 m/s（QDC 快接頭壓損急增），建議放大分支管或降低單機櫃熱負荷`);

                if (flow2_m3h > 500)
                    warnings.push(`🌊 二次側總流量 ${flow2_m3h.toFixed(0)} m³/h，已達大型商業建築規模，請確認管網可用口徑`);
                if (flow1_m3h > 800)
                    warnings.push(`🌊 一次側總流量 ${flow1_m3h.toFixed(0)} m³/h，需評估冰水主機側管網及冷卻塔容量`);

                if (dp2_total > 500000)
                    warnings.push(`⚠️ 二次側總壓損 ${(dp2_total / 1000).toFixed(0)} kPa > 500 kPa，泵浦揚程偏高，建議優化管路佈局`);

                if (Re_check < 4000 && Re_check > 0)
                    warnings.push(`⚠️ 雷諾數 ${Re_check.toFixed(0)} < 4000（層流/過渡流），熱傳效率不佳，建議提高流速或使用擾流內管`);

                // --- CDU 容量警告 ---
                if (cdu_actual_load_pct > 90)
                    warnings.push(`🔴 CDU 負載率 ${cdu_actual_load_pct.toFixed(1)}% > 90%，已接近極限，強烈建議依 75% 擴容至 ${Math.ceil(Q_liquid / (cduCapacity * 0.75))} 台`);
                else if (cdu_actual_load_pct > 80)
                    warnings.push(`🟡 CDU 負載率 ${cdu_actual_load_pct.toFixed(1)}% > 80%，建議預留裕度`);

                if (cdu_n1_load_pct > 100)
                    warnings.push(`🔴 N+1 冗餘不足：若一台 CDU 故障，剩餘機台負載率達 ${cdu_n1_load_pct.toFixed(1)}%（超載），建議增加至 ${Math.ceil(Q_liquid / (cduCapacity * 0.85)) + 1} 台`);
                else if (cdu_n1_load_pct > 85)
                    warnings.push(`🟡 N+1 冗餘偏緊：若一台 CDU 故障，剩餘負載率 ${cdu_n1_load_pct.toFixed(1)}%`);

                if (cdu_flow_per_unit > 80)
                    warnings.push(`⚠️ 單台 CDU 流量 ${cdu_flow_per_unit.toFixed(1)} m³/h > 80 m³/h，超出一般泵浦能力，建議增加 CDU 數量`);

                if (flow_per_rack > 2.5)
                    warnings.push(`⚠️ 單機櫃需求流量 ${flow_per_rack.toFixed(2)} m³/h (${flow_per_rack_lpm.toFixed(1)} LPM) > 2.5 m³/h，QDC 快接頭面臨高壓損`);

                // --- 熱交換器警告 ---
                if (hx_effectiveness > 0.95)
                    warnings.push(`⚠️ PHX 有效性 ${(hx_effectiveness * 100).toFixed(1)}% > 95%，理論可行但需大面積且成本高，建議確認可行性`);
                if (A_hx_per_cdu > 10)
                    warnings.push(`⚠️ 單台 CDU 內 PHX 需求面積 ${A_hx_per_cdu.toFixed(1)} m²，偏大，可能需要選用更大型號或增加 CDU`);

                // --- 冰機效率警告 ---
                if (plr < 0.3 && plr > 0)
                    warnings.push(`🟡 冰機部分負載率僅 ${(plr * 100).toFixed(1)}%，效率下降明顯，建議採用變頻離心機或模組化冰機`);

                // --- PUE 評級 ---
                if (pue < 1.1)
                    warnings.push(`✅ PUE ${pue.toFixed(3)}：卓越 (State-of-Art)，接近理論極限`);
                else if (pue < 1.2)
                    warnings.push(`✅ PUE ${pue.toFixed(3)}：優良，符合高效數據中心標準`);
                else if (pue < 1.4)
                    warnings.push(`🟡 PUE ${pue.toFixed(3)}：合格，仍有節能優化空間`);
                else
                    warnings.push(`🔴 PUE ${pue.toFixed(3)}：偏高，建議檢視冷卻系統設計`);

                // --- Free Cooling 提示 ---
                if (freeCoolingMode === 'FULL')
                    warnings.push(`✅ 目前外氣條件可達全自然冷卻（冷卻塔出水 ${T_ct_supply.toFixed(1)}°C ≤ 供水 ${T1_supply}°C）`);
                else if (freeCoolingMode === 'PARTIAL')
                    warnings.push(`🟡 目前為部分自然冷卻（${(freeCoolingFraction * 100).toFixed(0)}%），冷卻塔出水 ${T_ct_supply.toFixed(1)}°C`);
                else
                    warnings.push(`🔴 目前無法進行自然冷卻（冷卻塔出水 ${T_ct_supply.toFixed(1)}°C > 回水 ${T1_return}°C），全靠冰機運轉`);

                warnings.push(`📊 年度 Free Cooling 可用時數估算：全冷卻 ${fc_full_hours}h + 部分冷卻 ${fc_partial_hours}h = 潛在節能 ${annual_fc_savings_pct.toFixed(1)}%`);

                // --- 顯示警告 ---
                const warningDiv = document.getElementById('sim-warnings');
                if (warningDiv) {
                    if (warnings.length > 0) {
                        warningDiv.innerHTML = warnings.join('<br><br>');
                        warningDiv.classList.remove('hidden');
                    } else {
                        warningDiv.classList.add('hidden');
                    }
                }

                // ================================================================
                // 16. 回傳完整計算結果物件 (供外部圖表/匯出使用)
                // ================================================================
                return {
                    input: {
                        rackKW, totalRacks, cduCount, cduCapacity,
                        T2_supply, T2_return, T1_supply, T1_return,
                        ambientDB, ambientWB, coolantType,
                        pipeMainDia, pipeBranchDia, pipeLength,
                        liquidCoolingRatio,
                    },
                    thermal: {
                        Q_total, Q_liquid, Q_air, Q_primary, Q_chiller_total, Q_chiller_actual,
                        deltaT2, deltaT1,
                    },
                    hydraulic: {
                        flow2_m3h, flow2_lpm, flow1_m3h, flow1_lpm,
                        flow_per_rack, flow_per_rack_lpm,
                        cdu_flow_per_unit,
                        v_main_actual, v_branch_actual,
                        dp2_total, Re_main: Re_check,
                    },
                    heatExchanger: {
                        LMTD, hx_effectiveness, A_hx_required, A_hx_fouled, A_hx_per_cdu,
                        U_hx, U_hx_fouled,
                    },
                    coolant: {
                        type: coolantType, ...props2,
                    },
                    freeCooling: {
                        mode: freeCoolingMode, fraction: freeCoolingFraction,
                        T_ct_supply, fc_full_hours, fc_partial_hours,
                        annual_fc_savings_pct,
                    },
                    chiller: {
                        cop_full_load, cop_actual, plr, chiller_power,
                        RT_primary, RT_total,
                    },
                    cdu: {
                        cdu_load_per_unit, cdu_recommended_cap,
                        cdu_actual_load_pct, cdu_n1_load_pct,
                    },
                    power: power_breakdown,
                    pue: { pue, pue_cooling, pue_infra },
                    annual: {
                        annual_kwh_cooling, annual_cost_cooling, annual_saving,
                    },
                    warnings,
                };
            },

            setLiveVal(id, newBase, newVar) {
                const el = document.getElementById(id);
                if(el) {
                    el.setAttribute('data-base', newBase);
                    el.setAttribute('data-var', newVar);
                    el.innerText = newBase;
                }
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
                this.materials.pipeBlueM = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness:0.6, roughness:0.3 });
                this.materials.pipeRedM = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness:0.6, roughness:0.3 });
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
                spot1.position.set(0, 3.4, 3); spot1.target.position.set(0, 0, 0);
                this.scene.add(spot1); this.scene.add(spot1.target);

                const spot2 = new THREE.SpotLight(0xffffff, 1.5, 15, 0.6, 0.5, 1);
                spot2.position.set(0, 3.4, -3); spot2.target.position.set(0, 0, 0);
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

                const coldLineGeo = new THREE.PlaneGeometry(3.5, 0.08);
                const coldLineMat = new THREE.MeshBasicMaterial({color: 0x0ea5e9, transparent: true, opacity: 0.4});
                const cl1 = new THREE.Mesh(coldLineGeo, coldLineMat);
                cl1.rotation.x = -Math.PI/2; cl1.position.set(0, 0.01, -1.8);
                this.scene.add(cl1);
                const cl2 = new THREE.Mesh(coldLineGeo, coldLineMat);
                cl2.rotation.x = -Math.PI/2; cl2.position.set(0, 0.01, 1.8);
                this.scene.add(cl2);

                const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({color:0x1e293b, roughness:0.9}));
                ceil.rotation.x = Math.PI/2; ceil.position.y = 4.0; this.scene.add(ceil);

                const colGeo = new THREE.BoxGeometry(0.4, 4.6, 0.4);
                const colMat = new THREE.MeshStandardMaterial({color:0x0f172a, roughness:0.8});
                [ [-5,3.5], [5,3.5], [-5,-3.5], [5,-3.5] ].forEach(pos => {
                    const col = new THREE.Mesh(colGeo, colMat);
                    col.position.set(pos[0], 1.7, pos[1]);
                    this.scene.add(col);
                });

                for(let i=-2; i<=2; i+=2) {
                    const light = new THREE.PointLight(0xffffff, 0.8, 6);
                    light.position.set(0, 3.8, i); 
                    this.scene.add(light);

                    const fixture = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, 0.03, 0.15),
                        new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xffffff, emissiveIntensity:0.8})
                    );
                    fixture.position.set(0, 3.98, i);
                    this.scene.add(fixture);
                }
            },

            buildHotAisleContainment() {
                const containGroup = new THREE.Group();
                const panelMat = new THREE.MeshPhysicalMaterial({
                    color: 0x88ccff, transmission: 0.5, transparent: true, 
                    opacity: 0.45, side: THREE.DoubleSide, roughness: 0.2
                });
                const frameMat = this.materials.aluminum;
                
                const rackTopY = 2.0;      
                const ceilY = 4.0;         
                const frontA = -0.3;       
                const frontB = 0.3;        
                const aisleWidth = frontB - frontA;  
                const aisleCenterZ = 0;              
                const halfW = 1.56;        
                const gapH = ceilY - rackTopY;

                const ceilPanel = new THREE.Mesh(
                    new THREE.BoxGeometry(halfW * 2 + 0.1, 0.03, aisleWidth),
                    panelMat
                );
                ceilPanel.position.set(0, rackTopY + 0.02, aisleCenterZ);
                containGroup.add(ceilPanel);

                const edgeLong = new THREE.BoxGeometry(halfW * 2 + 0.1, 0.04, 0.04);
                const ceF = new THREE.Mesh(edgeLong, frameMat);
                ceF.position.set(0, rackTopY + 0.02, frontA);
                containGroup.add(ceF);
                const ceB = new THREE.Mesh(edgeLong, frameMat);
                ceB.position.set(0, rackTopY + 0.02, frontB);
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
                containGroup.add(flTop);

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
                const hl = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 1.5, 0.3), hlMat);
                hl.rotation.x = -Math.PI/2; 
                hl.position.set(0, 0.02, 0);
                containGroup.add(hl);

                this.scene.add(containGroup);
            },

            buildDataCenter() {
                this.createCDU(-3.0, 0, 1.5, 'CDU-A (Primary)');
                this.createCDU(-3.0, 0, -1.5, 'CDU-B (Redundant)');

                const xs = [-1.24, -0.62, 0, 0.62, 1.24];
                xs.forEach((x, i) => {
                    this.createRack(x, 0, -0.9, 0, `Rack-A${i+1}`);
                    this.createRack(x, 0, 0.9, Math.PI, `Rack-B${i+1}`);
                });
            },

            createCDU(x, y, z, name) {
                const w = 0.8, h = 1.8, d = 0.6;
                const group = new THREE.Group();
                group.position.set(x, h / 2, z);
                group.userData = { type: 'CDU', name: name };

                // ==========================================
                // 0. 材質極致精細化 (Advanced Materials)
                // ==========================================
                // 不鏽鋼：增加 clearcoat 模擬拋光金屬的微弱反射
                const stainlessMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.25, clearcoat: 0.3, clearcoatRoughness: 0.1 });
                const stainlessBrushed = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.75, roughness: 0.45 });
                
                // 工業鑄鐵/深色金屬：幫浦與閥體專用，高粗糙度
                const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.7 });
                const pumpMotorMat = new THREE.MeshPhysicalMaterial({ color: 0x111827, metalness: 0.5, roughness: 0.6, clearcoat: 0.1 });
                
                // 銅與黃銅組件
                const copperMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.95, roughness: 0.2 });
                const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });
                
                // 真實流體與玻璃 (IOR 折射率設定)
                const liquidMat = new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, transmission: 0.95, opacity: 1.0, transparent: true, roughness: 0.05, ior: 1.33 }); // 水的 IOR 約 1.33
                const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.98, transparent: true, opacity: 0.1, roughness: 0.0, ior: 1.52, thickness: 0.02 });
                
                // 其他輔助材質
                const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.0 });
                const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.3, roughness: 0.4 });
                const sensorYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });
                const wireMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.8 });

                // 在 CDU 內部增加一個微弱的點光源，凸顯金屬質感
                const internalLight = new THREE.PointLight(0xffffff, 0.4, 2);
                internalLight.position.set(0, -0.2, 0.1);
                group.add(internalLight);

                // ==========================================
                // 0.1 高精度共用工具函式 (Utilities)
                // ==========================================
                const createFlange = (radius, thickness, boltCount = 8) => { // 增加螺絲數量讓視覺更緊密
                    const fg = new THREE.Group();
                    const disk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 32), stainlessMat);
                    fg.add(disk);
                    // 增加法蘭盤上的螺絲與螺母細節
                    for (let i = 0; i < boltCount; i++) {
                        const angle = (i / boltCount) * Math.PI * 2;
                        const bx = Math.cos(angle) * (radius * 0.75);
                        const bz = Math.sin(angle) * (radius * 0.75);
                        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, thickness + 0.012, 6), ironMat);
                        bolt.position.set(bx, 0, bz);
                        fg.add(bolt);
                        const nut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 6), stainlessBrushed);
                        nut1.position.set(bx, thickness / 2 + 0.002, bz);
                        fg.add(nut1);
                        const nut2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 6), stainlessBrushed);
                        nut2.position.set(bx, -thickness / 2 - 0.002, bz);
                        fg.add(nut2);
                    }
                    return fg;
                };

                const createPipe = (radius, length, material = stainlessMat) => {
                    return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), material);
                };

                const createBallValve = (pipeRadius) => {
                    const vg = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.SphereGeometry(pipeRadius * 1.6, 24, 24), brassMat);
                    body.scale.set(1.2, 0.8, 1);
                    vg.add(body);
                    [-1, 1].forEach(dir => {
                        const stub = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius, pipeRadius, pipeRadius * 2, 16), brassMat);
                        stub.rotation.z = Math.PI / 2;
                        stub.position.x = dir * pipeRadius * 1.5;
                        vg.add(stub);
                        // 閥門兩側加上小型六角結構
                        const hex = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius*1.2, pipeRadius*1.2, 0.01, 6), brassMat);
                        hex.rotation.z = Math.PI / 2;
                        hex.position.x = dir * pipeRadius * 2;
                        vg.add(hex);
                    });
                    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, pipeRadius * 2, 16), brassMat);
                    neck.position.y = pipeRadius;
                    vg.add(neck);
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.012), redMat);
                    handle.position.y = pipeRadius * 2;
                    vg.add(handle);
                    return vg;
                };

                // ==========================================
                // 0.2 機櫃骨架與外殼 (Cabinet)
                // ==========================================
                const pillarGeo = new THREE.BoxGeometry(0.04, h, 0.04);
                [[-w / 2 + 0.02, d / 2 - 0.02], [w / 2 - 0.02, d / 2 - 0.02],
                 [-w / 2 + 0.02, -d / 2 + 0.02], [w / 2 - 0.02, -d / 2 + 0.02]].forEach(p => {
                    const pMesh = new THREE.Mesh(pillarGeo, this.materials.rackFrame);
                    pMesh.position.set(p[0], 0, p[1]);
                    group.add(pMesh);
                });

                // 頂板 (支援爆炸拆解)
                const topPlateGroup = new THREE.Group();
                topPlateGroup.position.set(0, h / 2, 0);
                topPlateGroup.userData = { isShell: true, origPos: topPlateGroup.position.clone(), explodeDir: new THREE.Vector3(0, 0.4, 0) };
                this.explodeShells.push(topPlateGroup);
                const topPlate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), this.materials.rackFrame);
                topPlateGroup.add(topPlate);
                group.add(topPlateGroup);

                const botPlate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), this.materials.rackFrame);
                botPlate.position.set(0, -h / 2, 0);
                group.add(botPlate);

                const sideMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transmission: 0.2, transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 0.1 });
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
                    
                    // 細緻化百葉窗
                    for (let i = 0; i < 12; i++) {
                        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012, d * 0.5), stainlessBrushed);
                        louver.position.set(side * 0.015, 0.2 + i * 0.03, 0);
                        louver.rotation.z = side * 0.4;
                        sideGroup.add(louver);
                    }
                    group.add(sideGroup);
                });

                // ==========================================
                // 1. 高精度板式熱交換器 (PHX - Plate Heat Exchanger)
                // ==========================================
                const phxGroup = new THREE.Group();
                const plateCount = 60; // 增加板數，讓體積感更重
                const plateSpacing = 0.0035;
                const plateW = 0.25, plateH = 0.45;
                const phxDepth = plateCount * plateSpacing;

                // 散熱板主體 (使用一個實體方塊模擬緊密的板片，並加上紋理視覺，以節省效能同時保有體積感)
                const coreGeo = new THREE.BoxGeometry(plateW, plateH, phxDepth);
                const coreMat = new THREE.MeshStandardMaterial({ color: 0xa0aec0, metalness: 0.6, roughness: 0.5 });
                const core = new THREE.Mesh(coreGeo, coreMat);
                phxGroup.add(core);

                // 前後厚重壓板 (Pressure Plates)
                const clampThk = 0.03;
                const clampMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.4, roughness: 0.7 });
                [-1, 1].forEach(dir => {
                    const clamp = new THREE.Mesh(new THREE.BoxGeometry(plateW + 0.04, plateH + 0.04, clampThk), clampMat);
                    clamp.position.z = dir * (phxDepth / 2 + clampThk / 2);
                    phxGroup.add(clamp);
                });

                // 上下導軌 (Carrying & Guiding Bars)
                const guideBarGeo = new THREE.BoxGeometry(0.02, 0.03, phxDepth + clampThk * 2 + 0.05);
                const guideBarTop = new THREE.Mesh(guideBarGeo, stainlessMat);
                guideBarTop.position.set(0, plateH/2 + 0.035, 0);
                phxGroup.add(guideBarTop);
                const guideBarBot = new THREE.Mesh(guideBarGeo, stainlessMat);
                guideBarBot.position.set(0, -plateH/2 - 0.035, 0);
                phxGroup.add(guideBarBot);

                // 緊固螺栓 (Tie Bolts) - 佈滿四周
                const boltPositions = [
                    [-plateW/2 - 0.01, plateH/2], [plateW/2 + 0.01, plateH/2],
                    [-plateW/2 - 0.01, -plateH/2], [plateW/2 + 0.01, -plateH/2],
                    [-plateW/2 - 0.01, 0], [plateW/2 + 0.01, 0]
                ];
                boltPositions.forEach(bp => {
                    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, phxDepth + clampThk * 2 + 0.04, 12), stainlessMat);
                    bolt.rotation.x = Math.PI / 2;
                    bolt.position.set(bp[0], bp[1], 0);
                    phxGroup.add(bolt);
                    [1, -1].forEach(nDir => {
                        const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 6), ironMat);
                        nut.rotation.x = Math.PI / 2;
                        nut.position.set(bp[0], bp[1], nDir * (phxDepth / 2 + clampThk + 0.01));
                        phxGroup.add(nut);
                    });
                });

                // 接口 (Nozzles) 與法蘭
                const nozzlePositions = [
                    { x: -0.07, y: plateH / 2 - 0.06 }, { x: 0.07, y: -plateH / 2 + 0.06 },
                    { x: 0.07, y: plateH / 2 - 0.06 }, { x: -0.07, y: -plateH / 2 + 0.06 }
                ];
                nozzlePositions.forEach(np => {
                    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 16), stainlessMat);
                    nozzle.rotation.x = Math.PI / 2;
                    nozzle.position.set(np.x, np.y, phxDepth / 2 + clampThk + 0.025);
                    phxGroup.add(nozzle);
                    const fl = createFlange(0.04, 0.01, 6);
                    fl.rotation.x = Math.PI / 2;
                    fl.position.set(np.x, np.y, phxDepth / 2 + clampThk + 0.05);
                    phxGroup.add(fl);
                });

                phxGroup.position.set(-0.15, -0.4, 0.02);
                group.add(phxGroup);

                // ==========================================
                // 2. 工業級二次側循環泵 (Secondary Pumps)
                // ==========================================
                const buildPump = (px, pz, label) => {
                    const pump = new THREE.Group();
                    
                    // 防震基座
                    const avMount = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.16), ironMat);
                    avMount.position.y = -0.12;
                    pump.add(avMount);
                    [[-0.07, -0.06], [0.07, -0.06], [-0.07, 0.06], [0.07, 0.06]].forEach(sp => {
                        const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.025, 12), stainlessMat);
                        spring.position.set(sp[0], -0.13, sp[1]);
                        pump.add(spring);
                    });

                    // 馬達主體 (高密度鰭片)
                    const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 32), pumpMotorMat);
                    motorBody.position.y = 0.02;
                    pump.add(motorBody);
                    for (let i = 0; i < 24; i++) {
                        const angle = (i / 24) * Math.PI * 2;
                        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.18, 0.015), pumpMotorMat);
                        fin.position.set(Math.cos(angle) * 0.062, 0.02, Math.sin(angle) * 0.062);
                        fin.rotation.y = -angle;
                        pump.add(fin);
                    }

                    // 馬達接線盒 (Terminal Box)
                    const terminalBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), pumpMotorMat);
                    terminalBox.position.set(0.05, 0.05, 0.04);
                    terminalBox.rotation.y = Math.PI / 4;
                    pump.add(terminalBox);
                    const powerCable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8), rubberMat);
                    powerCable.position.set(0.07, 0.05, 0.06);
                    powerCable.rotation.z = Math.PI / 4;
                    pump.add(powerCable);

                    // 散熱風扇罩
                    const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.04, 24), ironMat);
                    motorCap.position.y = 0.14;
                    pump.add(motorCap);

                    // 泵浦蝸殼 (Volute)
                    const volute = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.035, 16, 24), ironMat);
                    volute.rotation.x = Math.PI / 2;
                    volute.position.y = -0.09;
                    pump.add(volute);

                    // 接口與法蘭
                    const suction = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 16), ironMat);
                    suction.rotation.z = Math.PI / 2;
                    suction.position.set(-0.09, -0.09, 0);
                    pump.add(suction);
                    const sFlange = createFlange(0.04, 0.008, 6);
                    sFlange.rotation.z = Math.PI / 2;
                    sFlange.position.set(-0.115, -0.09, 0);
                    pump.add(sFlange);

                    const discharge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16), ironMat);
                    discharge.position.set(0, -0.04, 0.08);
                    discharge.rotation.x = Math.PI / 2;
                    pump.add(discharge);
                    const dFlange = createFlange(0.035, 0.008, 6);
                    dFlange.rotation.x = Math.PI / 2;
                    dFlange.position.set(0, -0.04, 0.105);
                    pump.add(dFlange);

                    pump.position.set(px, -0.55, pz);
                    pump.userData = { type: 'Pump', name: label };
                    return pump;
                };

                group.add(buildPump(0.18, 0.12, 'PUMP_A'));
                group.add(buildPump(0.18, -0.15, 'PUMP_B'));

                // ==========================================
                // 3. 儲液槽 (Expansion Tank) 強化真實感
                // ==========================================
                const tankGroup = new THREE.Group();
                const tankR = 0.1, tankH = 0.38;
                const tankShell = new THREE.Mesh(new THREE.CylinderGeometry(tankR, tankR, tankH, 32), glassMat);
                tankGroup.add(tankShell);

                // 金屬固定綁帶
                [-0.12, 0, 0.12].forEach(by => {
                    const band = new THREE.Mesh(new THREE.CylinderGeometry(tankR + 0.002, tankR + 0.002, 0.015, 32), stainlessMat);
                    band.position.y = by;
                    tankGroup.add(band);
                });

                const tankTop = new THREE.Mesh(new THREE.SphereGeometry(tankR, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), stainlessMat);
                tankTop.position.y = tankH / 2;
                tankGroup.add(tankTop);
                const tankBot = new THREE.Mesh(new THREE.SphereGeometry(tankR, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), stainlessMat);
                tankBot.position.y = -tankH / 2;
                tankGroup.add(tankBot);

                // 真實的液體與液位計
                const liquidLevel = 0.65; 
                const liquidH = tankH * liquidLevel;
                const liquid = new THREE.Mesh(new THREE.CylinderGeometry(tankR - 0.006, tankR - 0.006, liquidH, 32), liquidMat);
                liquid.position.y = -tankH / 2 + liquidH / 2 + 0.01;
                tankGroup.add(liquid);

                // 外部液位視窗 (Sight Glass Frame)
                const sightGlassFrame = new THREE.Mesh(new THREE.BoxGeometry(0.015, tankH * 0.8, 0.015), stainlessMat);
                sightGlassFrame.position.set(tankR + 0.005, 0, 0);
                tankGroup.add(sightGlassFrame);
                const sightGlass = new THREE.Mesh(new THREE.BoxGeometry(0.016, tankH * 0.75, 0.005), new THREE.MeshBasicMaterial({color: 0x0ea5e9}));
                sightGlass.position.set(tankR + 0.005, -tankH * 0.4 + (tankH * 0.75)/2, 0.006);
                tankGroup.add(sightGlass);

                // 頂部洩氣閥與補水蓋
                const airVent = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 16), brassMat);
                airVent.position.set(0, tankH / 2 + 0.02, 0);
                tankGroup.add(airVent);
                const fillCap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.015, 16), redMat);
                fillCap.position.set(0.04, tankH / 2 + 0.015, 0);
                tankGroup.add(fillCap);

                tankGroup.position.set(0.22, 0.4, -0.08);
                group.add(tankGroup);

                // ==========================================
                // 4. 管網系統 (Piping & Manifolds)
                // ==========================================
                // 供回水歧管 (Manifolds)
                const supplyHeader = createPipe(0.04, 0.6, stainlessMat);
                supplyHeader.position.set(-0.25, 0.25, 0.15);
                group.add(supplyHeader);
                const returnHeader = createPipe(0.04, 0.6, stainlessMat);
                returnHeader.position.set(0.25, 0.25, 0.15);
                group.add(returnHeader);

                // 增加歧管上的色環標示
                [-0.15, 0.15].forEach(by => {
                    const bandB = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
                    bandB.position.set(-0.25, 0.25 + by, 0.15);
                    group.add(bandB);
                    const bandR = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
                    bandR.position.set(0.25, 0.25 + by, 0.15);
                    group.add(bandR);
                });

                // 大口徑球閥
                const isoValve1 = createBallValve(0.03);
                isoValve1.position.set(-0.25, 0.6, 0.15);
                group.add(isoValve1);
                const isoValve2 = createBallValve(0.03);
                isoValve2.position.set(0.25, 0.6, 0.15);
                group.add(isoValve2);

                // ==========================================
                // 5. 控制面板與螢幕 (Control & UI) - 支援爆炸拆解
                // ==========================================
                // PLC 電控箱
                const plcBox = new THREE.Group();
                const plcEnclosure = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.08), stainlessBrushed);
                plcBox.add(plcEnclosure);
                // 增加散熱孔紋理
                const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true }));
                vent.position.set(0.1, 0.1, 0.041);
                plcBox.add(vent);

                for (let r = 0; r < 3; r++) {
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.01), stainlessMat);
                    rail.position.set(0, 0.12 - r * 0.12, 0.04);
                    plcBox.add(rail);
                    for (let m = 0; m < 6; m++) {
                        const modColor = r === 0 ? 0x1e3a5f : (m%2===0 ? 0x475569 : 0x374151);
                        const mod = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 0.045), new THREE.MeshStandardMaterial({ color: modColor, metalness: 0.2 }));
                        mod.position.set(-0.12 + m * 0.048, 0.12 - r * 0.12, 0.06);
                        plcBox.add(mod);
                    }
                }
                plcBox.position.set(0, 0.55, -0.15);
                group.add(plcBox);

                // CDU 主螢幕 (HMI)
                const screenGroup = new THREE.Group();
                const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.03), ironMat);
                screenGroup.add(screenFrame);
                const screenGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: this.textures.cduScreen }));
                screenGlass.position.z = 0.016;
                screenGroup.add(screenGlass);
                
                screenGroup.position.set(0, h / 2 - 0.15, d / 2 - 0.01);
                screenGroup.userData = { isShell: true, origPos: screenGroup.position.clone(), explodeDir: new THREE.Vector3(0, 0, 0.3) };
                this.explodeShells.push(screenGroup);
                group.add(screenGroup);

                // 急停按鈕 (E-Stop) 與指示燈
                const controlPanelGroup = new THREE.Group();
                
                // E-Stop Guard Ring
                const guardRing = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 24), new THREE.MeshStandardMaterial({color: 0xfbbf24}));
                guardRing.rotation.x = Math.PI / 2;
                controlPanelGroup.add(guardRing);
                const eButton = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0xdc2626, clearcoat: 0.5 }));
                eButton.rotation.x = Math.PI / 2;
                eButton.position.z = 0.01;
                controlPanelGroup.add(eButton);

                // 狀態指示燈帶金屬邊框
                [0x22c55e, 0xfbbf24, 0xef4444].forEach((c, i) => {
                    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), stainlessMat);
                    bezel.rotation.x = Math.PI / 2;
                    bezel.position.set(-0.15 - i * 0.05, 0.05, 0);
                    controlPanelGroup.add(bezel);
                    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.01, 16, 16), new THREE.MeshBasicMaterial({ color: c }));
                    lens.position.set(-0.15 - i * 0.05, 0.05, 0.005);
                    controlPanelGroup.add(lens);
                });

                controlPanelGroup.position.set(0.28, h / 2 - 0.15, d / 2);
                controlPanelGroup.userData = { isShell: true, origPos: controlPanelGroup.position.clone(), explodeDir: new THREE.Vector3(0, 0, 0.3) };
                this.explodeShells.push(controlPanelGroup);
                group.add(controlPanelGroup);

                // ==========================================
                // 6. 頂部散熱風扇模組
                // ==========================================
                const fanGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 32);
                const fanMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3 });
                const fanGrillMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, wireframe: true });
                [-0.2, 0.2].forEach(fx => {
                    const fanObj = new THREE.Group();
                    const fanFrame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), ironMat);
                    fanObj.add(fanFrame);
                    const fBase = new THREE.Mesh(fanGeo, fanMat);
                    fanObj.add(fBase);
                    const fGrill = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24), fanGrillMat);
                    fanObj.add(fGrill);
                    // 彎曲的風扇葉片
                    for (let b = 0; b < 9; b++) {
                        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.004, 0.035), new THREE.MeshStandardMaterial({ color: 0x222222 }));
                        blade.rotation.y = (b / 9) * Math.PI * 2;
                        blade.rotation.x = 0.2; // 葉片傾角
                        fanObj.add(blade);
                    }
                    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.02, 16), ironMat);
                    fanObj.add(hub);
                    fanObj.position.set(fx, h / 2 + 0.03, 0);
                    group.add(fanObj);
                });

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
                const w = 0.6, h = 2.0, d = 1.2;
                const group = new THREE.Group();
                group.position.set(x, h / 2, z);
                group.rotation.y = rot;
                group.userData = { type: 'Rack', name: name };

                if (!this.materials.copperDetail) {
                    this.materials.copperDetail = new THREE.MeshStandardMaterial({ color: 0xa89f9b, metalness: 0.95, roughness: 0.15 });
                    this.materials.pcbGreen = new THREE.MeshStandardMaterial({ color: 0x050805, roughness: 0.9 });
                    this.materials.chromeDetail = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.15 });
                    this.materials.darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.6 });
                    this.materials.goldPin = new THREE.MeshStandardMaterial({ color: 0xfbb034, metalness: 1.0, roughness: 0.1 });
                    this.materials.ledGreen = new THREE.MeshBasicMaterial({ color: 0x76b900 });
                    this.materials.rubberBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.0 });
                    this.materials.blankingPanel = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.8 });
                    this.materials.copperTube = new THREE.MeshStandardMaterial({ color: 0xc47e4a, metalness: 0.85, roughness: 0.25 });
                    this.materials.leakSensor = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.4, roughness: 0.5 });
                }

                const {
                    copperDetail, pcbGreen, chromeDetail, darkMetal, goldPin, ledGreen,
                    rackFrame, meshDoor, pipeBlueM, pipeRedM,
                    rubberBlack, blankingPanel, copperTube, leakSensor
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

                // 機櫃骨架
                const t = 0.04;
                const frameGeoV = new THREE.BoxGeometry(t, h, t);
                const corners = [
                    [-w / 2 + t / 2, d / 2 - t / 2], [w / 2 - t / 2, d / 2 - t / 2],
                    [-w / 2 + t / 2, -d / 2 + t / 2], [w / 2 - t / 2, -d / 2 + t / 2]
                ];
                corners.forEach(pos => {
                    const post = new THREE.Mesh(frameGeoV, rackFrame);
                    post.position.set(pos[0], 0, pos[1]);
                    group.add(post);
                });

                const hBraceGeo = new THREE.BoxGeometry(w - t * 2, 0.02, 0.02);
                const dBraceGeo = new THREE.BoxGeometry(0.02, 0.02, d - t * 2);
                const braceHeights = [-h / 2 + 0.06, -0.3, 0.3, h / 2 - 0.06];
                braceHeights.forEach(by => {
                    [d / 2 - t / 2, -d / 2 + t / 2].forEach(bz => {
                        const brace = new THREE.Mesh(hBraceGeo, rackFrame);
                        brace.position.set(0, by, bz);
                        group.add(brace);
                    });
                    if (Math.abs(by) > 0.5) {
                        [-w / 2 + t / 2, w / 2 - t / 2].forEach(bx => {
                            const brace = new THREE.Mesh(dBraceGeo, rackFrame);
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
                    const eiaPost = new THREE.Mesh(eiaGeo, chromeDetail);
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

                // 機櫃頂板 (加入爆炸拆解清單)
                const topCoverGroup = new THREE.Group();
                topCoverGroup.position.y = h / 2;
                topCoverGroup.userData = { isShell: true, origPos: topCoverGroup.position.clone(), explodeDir: new THREE.Vector3(0, 2.8, 0) };
                this.explodeShells.push(topCoverGroup);

                const topCover = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), rackFrame);
                topCoverGroup.add(topCover);
                [0.3, -0.3].forEach(cz => {
                    const cableOpening = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.15), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                    cableOpening.position.set(0, 0, cz);
                    topCoverGroup.add(cableOpening);
                    const grommet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.005, 0.17), rubberBlack);
                    grommet.position.set(0, 0.02, cz);
                    topCoverGroup.add(grommet);
                });
                group.add(topCoverGroup);

                const botCover = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d + 0.04), rackFrame);
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

                // 前門
                const doorGroup = new THREE.Group();
                doorGroup.position.set(-w / 2 + 0.02, 0, -d / 2 - 0.01);

                const doorContent = new THREE.Group();
                doorContent.position.set(w / 2 - 0.02, 0, 0.01);
                const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.12, 0.02), rackFrame);
                doorContent.add(doorFrame);
                const meshPanel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.2), meshDoor);
                meshPanel.position.z = -0.011; 
                meshPanel.rotation.y = Math.PI; 
                doorContent.add(meshPanel);
                const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 0.03), chromeDetail);
                handleBar.position.set(w / 2 - 0.04, 0, -0.02);
                doorContent.add(handleBar);
                const lockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 12), darkMetal);
                lockBody.rotation.x = Math.PI / 2;
                lockBody.position.set(w / 2 - 0.04, -0.15, -0.02);
                doorContent.add(lockBody);
                const lockSlot = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.01, 0.005), chromeDetail);
                lockSlot.position.set(w / 2 - 0.04, -0.15, -0.028);
                doorContent.add(lockSlot);
                doorGroup.add(doorContent);

                [-0.35, 0, 0.35].forEach(hy => {
                    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), darkMetal);
                    hinge.position.set(0, hy, 0);
                    doorGroup.add(hinge);
                    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6), chromeDetail);
                    pin.position.set(0, hy, 0);
                    doorGroup.add(pin);
                });

                group.add(doorGroup);
                if (!this.rackFrontDoors) this.rackFrontDoors = [];
                this.rackFrontDoors.push(doorGroup);

                // 機櫃側板 (加入爆炸拆解清單 - 僅最外側機櫃側板會作動)
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

                    const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.015, h - 0.1, d - 0.08), rackFrame);
                    sideGroup.add(sidePanel);
                    
                    [-0.3, 0.3].forEach(cy => {
                        const clip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.015), chromeDetail);
                        clip.position.set(side * 0.005, cy, d / 2 - 0.08);
                        sideGroup.add(clip);
                    });
                    group.add(sideGroup);
                });

                const instData = {
                    trayBody: [], pcb: [], handle: [],
                    gpuPlate: [], cpuPlate: [], switchPlate: [],
                    qdcMale: [], qdcFemale: [],
                    osfpPort: [], psuModule: [], statusLed: [], ledStrip: [],
                    blankPanel: [], coldTube: [],
                    psuFanGrill: [], psuHandle: [],
                    memModule: [], vrm: [],
                };

                const pushInst = (arr, px, py, pz, sx = 1, sy = 1, sz = 1, ry = 0) => {
                    const dummy = new THREE.Object3D();
                    dummy.position.set(px, py, pz);
                    dummy.scale.set(sx, sy, sz);
                    if (ry) dummy.rotation.y = ry;
                    dummy.updateMatrix();
                    arr.push(dummy.matrix);
                };

                const totalU = 42;
                const uHeight = (h - 0.15) / totalU;
                const startY = -h / 2 + 0.12;
                const trayW = 0.48, trayD = 0.95;

                for (let u = 0; u < totalU; u++) {
                    const ty = startY + u * uHeight;

                    const isPowerShelf = (u >= 0 && u <= 3);
                    const isCompute = (u >= 4 && u <= 13) || (u >= 23 && u <= 32);
                    const isSwitch = (u >= 14 && u <= 22);
                    const isCableSpace = (u >= 33 && u <= 35); 
                    const isBlank = !isPowerShelf && !isCompute && !isSwitch && !isCableSpace;

                    if (isBlank) {
                        pushInst(instData.blankPanel, 0, ty, d / 2 - 0.06, trayW, uHeight * 0.85, 0.005);
                        continue;
                    }
                    if (isCableSpace) continue;

                    pushInst(instData.trayBody, 0, ty, 0, trayW, uHeight * 0.8, trayD);

                    pushInst(instData.handle, -trayW / 2 + 0.015, ty, trayD / 2 + 0.015, 0.012, uHeight * 0.55, 0.035);
                    pushInst(instData.handle, trayW / 2 - 0.015, ty, trayD / 2 + 0.015, 0.012, uHeight * 0.55, 0.035);

                    for (let li = 0; li < 3; li++) {
                        pushInst(instData.statusLed, -trayW / 2 + 0.04 + li * 0.015, ty, trayD / 2 + 0.008, 0.005, 0.005, 0.005);
                    }

                    if (isPowerShelf) {
                        // 強化 PSU 視覺：風扇網罩、標誌、綠色指示燈
                        for (let p = 0; p < 6; p++) {
                            const px = -trayW / 2 + 0.045 + p * 0.078;
                            pushInst(instData.psuModule, px, ty, trayD / 2 - 0.12, 0.07, uHeight * 0.75, 0.22);
                            pushInst(instData.psuFanGrill, px, ty, trayD / 2 + 0.001, 0.06, uHeight * 0.6, 0.003);
                            pushInst(instData.psuHandle, px, ty + uHeight * 0.25, trayD / 2 + 0.008, 0.045, 0.006, 0.02);
                            pushInst(instData.statusLed, px - 0.02, ty - uHeight * 0.25, trayD / 2 + 0.005, 0.005, 0.005, 0.005);
                        }
                    }
                    else if (isCompute) {
                        pushInst(instData.pcb, 0, ty - uHeight * 0.25, 0, trayW * 0.92, 0.004, trayD * 0.88);
                        
                        // GB200 Bianca 比例：2 顆 Grace CPU (大), 4 顆 Blackwell GPU (緊湊)
                        const cpuPositions = [[-0.12, -0.15], [0.12, -0.15]];
                        cpuPositions.forEach(cp => {
                            pushInst(instData.cpuPlate, cp[0], ty, cp[1], 0.09, 0.016, 0.12);
                            // CPU 周圍放置 LPDDR
                            [-0.05, 0.05].forEach(mx => {
                                pushInst(instData.memModule, cp[0] + mx, ty + 0.01, cp[1] - 0.08, 0.015, 0.008, 0.02);
                            });
                        });

                        const gpuPositions = [[-0.15, 0.12], [-0.05, 0.12], [0.05, 0.12], [0.15, 0.12]];
                        gpuPositions.forEach(pos => {
                            pushInst(instData.gpuPlate, pos[0], ty, pos[1], 0.08, 0.02, 0.12); // GPU 冷卻板
                            // GPU 緊湊排列 HBM
                            [-0.05, 0.05].forEach(mz => {
                                pushInst(instData.memModule, pos[0], ty + 0.01, pos[1] + mz, 0.02, 0.008, 0.015);
                            });
                        });
                        
                        // VRM 設計
                        [-0.12, 0.12].forEach(vx => {
                            pushInst(instData.vrm, vx, ty + 0.005, -0.05, 0.08, 0.01, 0.04);
                        });

                        // 運算節點正面 (面板兩側) 明顯的 QDC 金屬盲插接頭
                        pushInst(instData.qdcMale, -trayW / 2 + 0.035, ty, trayD / 2 + 0.015, 0.022, 0.022, 0.06);
                        pushInst(instData.qdcMale, trayW / 2 - 0.035, ty, trayD / 2 + 0.015, 0.022, 0.022, 0.06);

                        // 後方液冷盲插接頭 (配合 Manifold)
                        const qdcZ_Male = -trayD / 2 - 0.008;
                        const qdcZ_Female = -trayD / 2 - 0.035;
                        [-0.13, 0.13].forEach(qx => {
                            pushInst(instData.qdcMale, qx, ty, qdcZ_Male, 0.018, 0.018, 0.035);
                            pushInst(instData.qdcFemale, qx, ty, qdcZ_Female, 0.022, 0.022, 0.035);
                        });

                        // 冷卻板水管連接
                        [-0.15, -0.05, 0.05, 0.15].forEach(tx => {
                            pushInst(instData.coldTube, tx, ty + 0.01, 0.05, 0.006, 0.006, 0.38);
                        });
                    }
                    else if (isSwitch) {
                        pushInst(instData.pcb, 0, ty - uHeight * 0.25, 0, trayW * 0.92, 0.004, trayD * 0.88);
                        
                        // 大型 NVSwitch 核心晶片 (取代原本長條 SwitchPlate)
                        pushInst(instData.switchPlate, 0, ty, 0, trayW * 0.5, 0.015, 0.35);

                        // NVSwitch 正面面板高密度 OSFP 接口陣列 (排 24 個金屬方塊)
                        for (let port = 0; port < 24; port++) {
                            const px = -trayW / 2 + 0.03 + port * 0.018;
                            pushInst(instData.osfpPort, px, ty, trayD / 2 + 0.005, 0.012, uHeight * 0.35, 0.025);
                        }
                        
                        // 正面面板 NVIDIA 綠色飾條
                        pushInst(instData.ledStrip, 0, ty + uHeight * 0.35, trayD / 2 + 0.008, trayW * 0.92, 0.003, 0.002);

                        // 其他晶片輔助冷卻板
                        [-0.16, 0.16].forEach(sx => {
                            pushInst(instData.cpuPlate, sx, ty, -0.2, 0.04, 0.012, 0.06);
                            pushInst(instData.cpuPlate, sx, ty, 0.25, 0.04, 0.012, 0.06);
                        });
                        
                        // 後方液冷盲插接頭 (配合 Manifold)
                        const qdcZ_Male = -trayD / 2 - 0.008;
                        const qdcZ_Female = -trayD / 2 - 0.035;
                        [-0.13, 0.13].forEach(qx => {
                            pushInst(instData.qdcMale, qx, ty, qdcZ_Male, 0.018, 0.018, 0.035);
                            pushInst(instData.qdcFemale, qx, ty, qdcZ_Female, 0.022, 0.022, 0.035);
                        });

                        pushInst(instData.coldTube, -0.16, ty + 0.01, 0.025, 0.005, 0.005, 0.38);
                        pushInst(instData.coldTube, 0.16, ty + 0.01, 0.025, 0.005, 0.005, 0.38);
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
                addInstMesh(box1, chromeDetail, instData.handle);
                addInstMesh(box1, pcbGreen, instData.pcb);
                addInstMesh(box1, copperDetail, instData.gpuPlate);
                addInstMesh(box1, copperDetail, instData.cpuPlate);
                addInstMesh(box1, copperDetail, instData.switchPlate);
                addInstMesh(box1, chromeDetail, instData.psuModule);
                addInstMesh(box1, goldPin, instData.osfpPort);
                addInstMesh(cyl1, chromeDetail, instData.qdcMale);
                addInstMesh(cyl1, darkMetal, instData.qdcFemale, false); // 母頭固定在分水管上不抽出
                addInstMesh(sphere1, ledGreen, instData.statusLed);
                addInstMesh(box1, ledGreen, instData.ledStrip);
                addInstMesh(box1, blankingPanel, instData.blankPanel);
                addInstMesh(cyl1, copperTube, instData.coldTube);

                const grillMat = new THREE.MeshStandardMaterial({ color: 0x475569, wireframe: true });
                addInstMesh(box1, grillMat, instData.psuFanGrill);
                addInstMesh(box1, chromeDetail, instData.psuHandle);

                addInstMesh(box1, new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.5, roughness: 0.6 }), instData.memModule);
                addInstMesh(box1, new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.6, roughness: 0.4 }), instData.vrm);

                // ==========================================
                // 5. 盲插歧管 (Blind-Mate Manifold) + 避讓群組
                // ==========================================
                const spineH = totalU * uHeight;

                // 新增避讓群組：將機櫃背後的管路全數裝進來，爆炸時往熱通道側(負Z方向)退讓
                const rackPipingGroup = new THREE.Group();
                rackPipingGroup.userData = { 
                    isShell: true, 
                    origPos: new THREE.Vector3(0, 0, 0), 
                    explodeDir: new THREE.Vector3(0, 0, -0.8) // 往機櫃背後退開 0.8 米
                };
                this.explodeShells.push(rackPipingGroup);
                group.add(rackPipingGroup);

                const spineGeo = new THREE.CylinderGeometry(0.028, 0.028, spineH, 16);
                const spineSupply = new THREE.Mesh(spineGeo, pipeBlueM);
                spineSupply.position.set(-0.13, 0, -trayD / 2 - 0.07);
                rackPipingGroup.add(spineSupply);

                const spineReturn = new THREE.Mesh(spineGeo, pipeRedM);
                spineReturn.position.set(0.13, 0, -trayD / 2 - 0.07);
                rackPipingGroup.add(spineReturn);

                const insulGeo = new THREE.CylinderGeometry(0.035, 0.035, spineH, 16);
                const insulMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, transparent: true, opacity: 0.4, roughness: 1.0 });
                const insulS = new THREE.Mesh(insulGeo, insulMat);
                insulS.position.copy(spineSupply.position);
                rackPipingGroup.add(insulS);
                const insulR = new THREE.Mesh(insulGeo, insulMat);
                insulR.position.copy(spineReturn.position);
                rackPipingGroup.add(insulR);

                for (let u = 0; u < totalU; u++) {
                    const isCompute = (u >= 4 && u <= 13) || (u >= 23 && u <= 32);
                    const isSwitch = (u >= 14 && u <= 22);
                    if (!isCompute && !isSwitch) continue;

                    const branchY = startY + u * uHeight;
                    const branchLength = 0.06;

                    const bSupply = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeBlueM);
                    bSupply.rotation.x = Math.PI / 2;
                    bSupply.position.set(-0.13, branchY, -trayD / 2 - 0.04);
                    rackPipingGroup.add(bSupply);

                    const bReturn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, branchLength, 8), pipeRedM);
                    bReturn.rotation.x = Math.PI / 2;
                    bReturn.position.set(0.13, branchY, -trayD / 2 - 0.04);
                    rackPipingGroup.add(bReturn);
                }

                [-0.13, 0.13].forEach((fx, idx) => {
                    const fl = createFlange(0.04, 0.015, 4);
                    fl.position.set(fx, spineH / 2 + 0.01, -trayD / 2 - 0.07);
                    rackPipingGroup.add(fl);
                    const barb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 12), chromeDetail);
                    barb.position.set(fx, spineH / 2 + 0.04, -trayD / 2 - 0.07);
                    rackPipingGroup.add(barb);
                    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x3b82f6 : 0xef4444 }));
                    band.position.set(fx, spineH / 2 + 0.025, -trayD / 2 - 0.07);
                    rackPipingGroup.add(band);
                });

                [-0.13, 0.13].forEach(fx => {
                    const drainValve = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }));
                    drainValve.position.set(fx, -spineH / 2 - 0.01, -trayD / 2 - 0.07);
                    rackPipingGroup.add(drainValve);
                });

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

                const leakRope = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), leakSensor);
                leakRope.rotation.z = Math.PI / 2;
                leakRope.position.set(0, -h / 2 + 0.055, -trayD / 2 - 0.07);
                rackPipingGroup.add(leakRope);
                const leakController = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), leakSensor);
                leakController.position.set(0.2, -h / 2 + 0.08, -trayD / 2 - 0.07);
                rackPipingGroup.add(leakController);

                // 把垂直走線槽也歸入背板避讓群組
                [-w / 2 + 0.03, w / 2 - 0.03].forEach(cx => {
                    const cableTrough = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.7, 0.04), darkMetal);
                    cableTrough.position.set(cx, 0.1, -d / 2 + 0.06);
                    rackPipingGroup.add(cableTrough);
                    for (let ring = 0; ring < 6; ring++) {
                        const cableRing = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 6, 12), darkMetal);
                        cableRing.rotation.y = Math.PI / 2;
                        cableRing.position.set(cx, -0.3 + ring * 0.15, -d / 2 + 0.06);
                        rackPipingGroup.add(cableRing);
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

                const zA = -1.8; 
                const zB = 1.8;  
                const zAr = zA + 0.15; 
                const zBr = zB - 0.15; 
                const blueM = this.materials.pipeBlueM;  
                const redM = this.materials.pipeRedM;

                // --- CDU 側總幹管 (錯開 X 座標避免重疊) ---
                const xBlueM = -3.2;
                const xRedM = -2.8;

                // CDU 到總幹管的垂直段
                // CDU A (Z = 1.5)
                drawStraightPipe([xBlueM, 1.8, 1.5], [xBlueM, headerY, 1.5], rMain, blueM);
                addElbow(xBlueM, headerY, 1.5, blueM);
                drawStraightPipe([xRedM, 1.8, 1.5], [xRedM, headerY, 1.5], rMain, redM);
                addElbow(xRedM, headerY, 1.5, redM);

                // CDU B (Z = -1.5)
                drawStraightPipe([xBlueM, 1.8, -1.5], [xBlueM, headerY, -1.5], rMain, blueM);
                addElbow(xBlueM, headerY, -1.5, blueM);
                drawStraightPipe([xRedM, 1.8, -1.5], [xRedM, headerY, -1.5], rMain, redM);
                addElbow(xRedM, headerY, -1.5, redM);

                // Main Headers along Z axis (從 zA 到 zB)
                drawStraightPipe([xBlueM, headerY, zA], [xBlueM, headerY, zB], rMain, blueM);
                drawStraightPipe([xRedM, headerY, zAr], [xRedM, headerY, zBr], rMain, redM);

                // --- 走到各排機櫃的水平幹管 ---
                // Aisle A Headers
                addElbow(xBlueM, headerY, zA, blueM);
                drawStraightPipe([xBlueM, headerY, zA], [1.6, headerY, zA], rMain, blueM);

                addElbow(xRedM, headerY, zAr, redM);
                drawStraightPipe([xRedM, headerY, zAr], [1.6, headerY, zAr], rMain, redM);
                
                // Aisle B Headers
                addElbow(xBlueM, headerY, zB, blueM);
                drawStraightPipe([xBlueM, headerY, zB], [1.6, headerY, zB], rMain, blueM);

                addElbow(xRedM, headerY, zBr, redM);
                drawStraightPipe([xRedM, headerY, zBr], [1.6, headerY, zBr], rMain, redM);

                // --- 下接至機櫃的分支管 ---
                const yDrop = 1.96;       // 剛好接到機櫃 Spine Manifold 頂部接頭
                const zDropA = -1.445;    // A排機櫃後方 Manifold 的世界 Z 座標
                const zDropB = 1.445;     // B排機櫃後方 Manifold 的世界 Z 座標

                const xs = [-1.24, -0.62, 0, 0.62, 1.24];
                xs.forEach(x => {
                    // Rack A (z = -0.9, rot = 0)
                    // Spine local: Blue -0.13, Red +0.13
                    const bXa = x - 0.13;
                    const rXa = x + 0.13;

                    // Blue Branch A
                    addElbowSmall(bXa, headerY, zA, blueM);
                    drawStraightPipe([bXa, headerY, zA], [bXa, 2.05, zA], rBranch, blueM);     
                    addElbowSmall(bXa, 2.05, zA, blueM);
                    drawStraightPipe([bXa, 2.05, zA], [bXa, 2.05, zDropA], rBranch, blueM);     
                    addElbowSmall(bXa, 2.05, zDropA, blueM);
                    drawStraightPipe([bXa, 2.05, zDropA], [bXa, yDrop, zDropA], rBranch, blueM);   

                    // Red Branch A
                    addElbowSmall(rXa, headerY, zAr, redM);
                    drawStraightPipe([rXa, headerY, zAr], [rXa, 2.05, zAr], rBranch, redM);
                    addElbowSmall(rXa, 2.05, zAr, redM);
                    drawStraightPipe([rXa, 2.05, zAr], [rXa, 2.05, zDropA], rBranch, redM);
                    addElbowSmall(rXa, 2.05, zDropA, redM);
                    drawStraightPipe([rXa, 2.05, zDropA], [rXa, yDrop, zDropA], rBranch, redM);

                    addButterfly(bXa, 2.03, zDropA);
                    addButterfly(rXa, 2.03, zDropA);

                    // Rack B (z = 0.9, rot = Math.PI)
                    // Spine local: Blue -0.13, Red +0.13 -> World (with rot): Blue +0.13, Red -0.13
                    const bXb = x + 0.13;
                    const rXb = x - 0.13;

                    // Blue Branch B
                    addElbowSmall(bXb, headerY, zB, blueM);
                    drawStraightPipe([bXb, headerY, zB], [bXb, 2.05, zB], rBranch, blueM);
                    addElbowSmall(bXb, 2.05, zB, blueM);
                    drawStraightPipe([bXb, 2.05, zB], [bXb, 2.05, zDropB], rBranch, blueM);
                    addElbowSmall(bXb, 2.05, zDropB, blueM);
                    drawStraightPipe([bXb, 2.05, zDropB], [bXb, yDrop, zDropB], rBranch, blueM);

                    // Red Branch B
                    addElbowSmall(rXb, headerY, zBr, redM);
                    drawStraightPipe([rXb, headerY, zBr], [rXb, 2.05, zBr], rBranch, redM);
                    addElbowSmall(rXb, 2.05, zBr, redM);
                    drawStraightPipe([rXb, 2.05, zBr], [rXb, 2.05, zDropB], rBranch, redM);
                    addElbowSmall(rXb, 2.05, zDropB, redM);
                    drawStraightPipe([rXb, 2.05, zDropB], [rXb, yDrop, zDropB], rBranch, redM);

                    addButterfly(bXb, 2.03, zDropB);
                    addButterfly(rXb, 2.03, zDropB);
                });

                // --- 支撐吊架 (Support Brackets) ---
                // A 與 B 排通道上方橫向管的支撐
                for(let x = -1.5; x <= 1.5; x += 0.8) {
                    const sA = new THREE.Group();
                    const rodA = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5), this.materials.aluminum);
                    rodA.position.y = 3.25; sA.add(rodA);
                    // 修正原本的 BoxGeometry(0.4, 0.02, 0.04) 為 (0.04, 0.02, 0.4) 使其橫跨管線
                    const armA = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.4), this.materials.aluminum);
                    armA.position.y = headerY - 0.07; // 稍微降低承托於管下方
                    sA.add(armA);
                    sA.position.set(x, 0, zA + 0.075);
                    this.pipeGroup.add(sA);

                    const sB = new THREE.Group();
                    const rodB = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5), this.materials.aluminum);
                    rodB.position.y = 3.25; sB.add(rodB);
                    const armB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.4), this.materials.aluminum);
                    armB.position.y = headerY - 0.07;
                    sB.add(armB);
                    sB.position.set(x, 0, zB - 0.075);
                    this.pipeGroup.add(sB);
                }

                // CDU 側縱向主幹管的支撐
                for(let z = -1.0; z <= 1.0; z += 1.0) {
                    const sM = new THREE.Group();
                    const rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5), this.materials.aluminum);
                    rodM.position.y = 3.25; sM.add(rodM);
                    const armM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.04), this.materials.aluminum);
                    armM.position.y = headerY - 0.07;
                    sM.add(armM);
                    sM.position.set(-3.0, 0, z);
                    this.pipeGroup.add(sM);
                }

                this.scene.add(this.pipeGroup);
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
                
                if(data.type === 'Rack') document.getElementById('detail-subtitle').innerText = 'GB200 NVL72 RACK';
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
                else if(preset === 'aisle')  { cp = new THREE.Vector3(0, 1.2, -3.0);   ct = new THREE.Vector3(0, 1.2, -0.9); }
                else if(preset === 'hot_aisle') { cp = new THREE.Vector3(1.2, 1.3, 0); ct = new THREE.Vector3(-0.5, 1.0, 0); }
                else if(preset === 'rack_close') { 
                    cp = new THREE.Vector3(0.25, 1.05, 0.15);
                    ct = new THREE.Vector3(0, 1.0, -0.3);
                }
                else if(preset === 'cdu_close') { 
                    cp = new THREE.Vector3(-1.8, 1.2, 3.2);
                    ct = new THREE.Vector3(-3.0, 0.9, 1.5);
                }
                else if(preset === 'piping') { 
                    cp = new THREE.Vector3(3.5, 3.5, -2.5);
                    ct = new THREE.Vector3(0, 2.5, -1.8);
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
            toggleExplode() {
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
                    new TWEEN.Tween(this.explodeProgress)
                        .to({ val: targetVal }, 1500)
                        .easing(TWEEN.Easing.Cubic.InOut)
                        .onUpdate(() => {
                            this.updateExplodedView();
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

                // 3. 頂部冷卻主水管向熱通道方向(Z軸)退讓擴散
                if (this.pipeGroup) {
                    this.pipeGroup.children.forEach(pipe => {
                        if (!pipe.userData.origPos) {
                            pipe.userData.origPos = pipe.position.clone();
                            let zDir = 0;
                            // 判斷該管路屬於哪一側 (zA約為-1.8, zB約為1.8)
                            if (pipe.position.z < -0.2) zDir = -1.2;     // A排上方水管往外擴散 (-Z)
                            else if (pipe.position.z > 0.2) zDir = 1.2;  // B排上方水管往外擴散 (+Z)
                            
                            pipe.userData.explodeDir = new THREE.Vector3(0, 0, zDir);
                        }
                        pipe.position.copy(pipe.userData.origPos).addScaledVector(pipe.userData.explodeDir, progress);
                    });
                }
            },

            animate() {
                requestAnimationFrame(() => this.animate());
                if(window.TWEEN) TWEEN.update();
                
                const time = this.clock.getElapsedTime();
                this.controls.update();

                this.scene.traverse((child) => {
                    if(child.userData && child.userData.isLed) {
                        const intensity = (Math.sin(time * 3 + child.userData.offset) * 0.5 + 0.5) * 0.8 + 0.2;
                        child.material.color.setHex(child.userData.offset > 1 ? 0xfbbf24 : 0x76b900);
                        child.material.color.multiplyScalar(intensity);
                    }
                });

                this.renderer.render(this.scene, this.camera);
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