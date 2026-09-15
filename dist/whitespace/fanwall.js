/**
 * NVIDIA Vera Rubin NVL72 白區模擬 — 極致擬真工業級 Fanwall 模組
 * DTC.buildFanWalls() 完全重構實作 (CRAH 雙面通透、內置冷卻盤管、精緻 EC 節能風扇與冷凍水管路 V4.1)
 * * * 參考設計：
 * - Vertiv CRAH Fan Wall (Chilled Water)
 * - STULZ CyberAir 3PRO Fanwall
 * - Ziehl-Abegg ZAvblue / ebm-papst RadiPac EC Fan
 */
DTC.buildFanWalls = function() {
    const FW = this.VR_LAYOUT.fanwall;
    const fwGroup = this.layers.fanwall;

    // 1. 初始化工業標準色卡與材料特性 (RAL 7035 / RAL 7021 / 國標銅 / 不鏽鋼)
    if (!this.materials.fanwallCasing) {
        // 與機櫃骨架 (rackFrame) 一致的深色烤漆材質 (Vera Rubin 標誌性機櫃外殼)
        this.materials.fanwallCasing = new THREE.MeshStandardMaterial({ 
            color: 0x1e293b, 
            metalness: 0.8, 
            roughness: 0.4 
        });
        // 鈑金面板也改為與機櫃一致
        this.materials.fanwallPanel = this.materials.fanwallCasing;
        // 鍍鋅鋼板 / 鋁合金骨架 (Galvanized / Alum Frame)
        this.materials.fanwallTrim = new THREE.MeshStandardMaterial({ 
            color: 0x90a4ae, 
            metalness: 0.8, 
            roughness: 0.3 
        });
        // 鋼絲防護網 (Grille Guard 鋼絲)
        this.materials.fanwallGrille = new THREE.MeshStandardMaterial({ 
            color: 0x475569, 
            metalness: 0.9, 
            roughness: 0.15 
        });
        // Ziehl-Abegg 標誌性 EC 藍色外轉子電機 Hub/Rotor 殼體
        this.materials.ecFanBlue = new THREE.MeshStandardMaterial({
            color: 0x005b94, 
            metalness: 0.75, 
            roughness: 0.25
        });
        // 仿生葉片高剛性碳黑複合塑膠 (Composite Matte Black)
        this.materials.fanwallBlade = new THREE.MeshStandardMaterial({ 
            color: 0x1e293b, 
            metalness: 0.25, 
            roughness: 0.45 
        });
        // 不鏽鋼冷凍水管路 (Stainless steel pipes)
        this.materials.pipeStainless = new THREE.MeshStandardMaterial({
            color: 0xf2f4f4, 
            metalness: 0.95, 
            roughness: 0.12
        });
        // 銅管 / U型彎頭與激磁繞組 (Pure Copper)
        this.materials.fanwallCopper = new THREE.MeshStandardMaterial({ 
            color: 0xe67e22, 
            emissive: 0x2d1100,
            metalness: 0.95, 
            roughness: 0.18 
        });
        // 鍍鋅冷卻翅片群 (Coil Fin Core)
        this.materials.coilFinMat = new THREE.MeshStandardMaterial({
            color: 0x78909c, 
            metalness: 0.75, 
            roughness: 0.35
        });
        // Belimo 亮橙色閥門執行器 (Belimo Orange Actuator)
        this.materials.belimoOrange = new THREE.MeshStandardMaterial({
            color: 0xff5500, 
            metalness: 0.2, 
            roughness: 0.45
        });
        // 閥體黃銅與接頭 (Industrial Brass)
        this.materials.brassMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37, 
            metalness: 0.85, 
            roughness: 0.25
        });
        // 防震黑色橡膠軟接頭 (Rubber Bellows)
        this.materials.rubberBellows = new THREE.MeshStandardMaterial({
            color: 0x11161b, 
            metalness: 0.0, 
            roughness: 0.9
        });
        // 亮鋅高強度緊固螺栓 (Galvanized Bolt Fasteners)
        this.materials.boltMat = new THREE.MeshStandardMaterial({
            color: 0xbdc3c7, 
            metalness: 0.95, 
            roughness: 0.1
        });
        
        this.materials.fanwallLed = new THREE.MeshBasicMaterial({ color: 0x22c55e });

        // 【防呆補強】定義原本缺漏的 materials.fanFrame，避免 runtime 拋 undefined 錯誤
        this.materials.fanFrame = this.materials.fanwallCasing;

        // 【防呆補強】定義進風過濾網框材質，防範 V4.1 中漏掉導致的 runtime 拋 undefined 錯誤
        this.materials.filterFrameMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0, 
            metalness: 0.95,
            roughness: 0.1
        });

        // 建立高密度冷卻翅片法線貼圖 (Procedural Normal Map for Super-Dense Fins)
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#8080ff'; ctx.fillRect(0, 0, 128, 128); // 基準藍
        ctx.fillStyle = '#a080ff'; // 斜向受光模擬
        for (let x = 0; x < 128; x += 4) {
            ctx.fillRect(x, 0, 2, 128);
        }
        this.textures.coilFinNormal = new THREE.CanvasTexture(canvas);
        this.textures.coilFinNormal.wrapS = THREE.RepeatWrapping;
        this.textures.coilFinNormal.wrapT = THREE.RepeatWrapping;
        this.textures.coilFinNormal.repeat.set(24, 1);
        this.materials.coilFinMat.normalMap = this.textures.coilFinNormal;
        this.materials.coilFinMat.normalScale = new THREE.Vector2(0.8, 0.8);

        // 側面小狀態螢幕紋理 (保留既有控制螢幕設定)
        const sc = document.createElement('canvas'); sc.width = 512; sc.height = 256;
        const sctx = sc.getContext('2d');
        sctx.fillStyle = '#020617'; sctx.fillRect(0, 0, 512, 256);
        sctx.fillStyle = '#76b900'; sctx.fillRect(0, 0, 512, 30);
        sctx.fillStyle = '#000'; sctx.font = 'bold 18px monospace'; sctx.fillText('FANWALL UNIT CONTROL', 10, 22);
        sctx.fillStyle = '#fff'; sctx.font = 'bold 34px monospace'; sctx.fillText('96 kW', 20, 100);
        sctx.fillStyle = '#0ea5e9'; sctx.font = 'bold 26px monospace'; sctx.fillText('MODE: AUTO', 20, 150);
        sctx.fillStyle = '#22c55e'; sctx.font = 'bold 16px monospace'; sctx.fillText('● ALL SYSTEMS NOMINAL', 20, 230);
        this.textures.fanwallScreen = new THREE.CanvasTexture(sc);
        this.materials.fanwallScreen = new THREE.MeshBasicMaterial({ map: this.textures.fanwallScreen });

        // 預留擴充位 Canvas 紋理
        const rc = document.createElement('canvas'); rc.width = 1024; rc.height = 264;
        const rctx = rc.getContext('2d');
        rctx.fillStyle = '#facc15';
        rctx.font = 'bold 60px Arial, sans-serif';
        rctx.textAlign = 'center'; rctx.textBaseline = 'middle';
        rctx.fillText('RESERVED • FANWALL N+1', 512, 132);
        this.textures.fanwallReserved = new THREE.CanvasTexture(rc);
        this.materials.fanwallReserved = new THREE.MeshBasicMaterial({ map: this.textures.fanwallReserved, transparent: true, depthWrite: false });
    }

    // ---- 【全新工業級】離心風扇葉片幾何生成：Aerofoil 斷面、扭曲攻角、厚根薄尾、前向掃掠 ----
    const buildAerofoilBladeGeo = () => {
        const geo = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const uvs = [];

        const radialSegments = 6;
        const profilePoints = 14;

        // 標準翼型 NACACam-like 斷面相對座標 (X: 弦長比 0~1, Y: 厚度比)
        const xCoords = [0.0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.8, 0.5, 0.2, 0.05, 0.0];
        const yCoords = [0.0, 0.04, 0.07, 0.10, 0.12, 0.13, 0.12, 0.11, 0.09, 0.07, 0.04, 0.01, 0.0, -0.015, -0.02, -0.01, -0.005, 0.0];

        const spanLength = 0.135;  // 葉片長度
        const rootChord = 0.065;   // 根部弦寬
        const tipChord = 0.032;    // 尾部弦寬

        for (let r = 0; r <= radialSegments; r++) {
            const t = r / radialSegments;
            const h = t * spanLength; // 徑向長度
            
            // 扭曲角 (Twist Angle)：根部大攻角 (30度) 遞減至尾部 (8度) 確保最佳氣流分佈
            const twist = THREE.MathUtils.lerp(0.52, 0.14, t);
            const chord = THREE.MathUtils.lerp(rootChord, tipChord, t);
            
            // 前掠弧度掃掠 (Forward Swept Curves)
            const sweep = Math.pow(t, 2) * 0.024;
            const thicknessScale = THREE.MathUtils.lerp(1.0, 0.35, t); // 根部厚，尾部極薄

            const cosT = Math.cos(twist);
            const sinT = Math.sin(twist);

            for (let p = 0; p < profilePoints; p++) {
                const pt = p / (profilePoints - 1);
                const pIdx = Math.floor(pt * (xCoords.length - 1));
                const nextIdx = Math.min(pIdx + 1, xCoords.length - 1);
                const interp = (pt * (xCoords.length - 1)) - pIdx;

                const lx = THREE.MathUtils.lerp(xCoords[pIdx], xCoords[nextIdx], interp) * chord;
                const ly = THREE.MathUtils.lerp(yCoords[pIdx], yCoords[nextIdx], interp) * chord * thicknessScale;

                // 繞中心扭曲旋轉
                const rx = lx * cosT - ly * sinT;
                const ry = lx * sinT + ly * cosT;

                // 軸向 X = 氣流方向, Y = 徑向長度, Z = 切向 (帶有前掠位移)
                const px = ry;
                const py = h;
                const pz = rx + sweep;

                vertices.push(px, py, pz);
                uvs.push(t, pt);
            }
        }

        // 索引三角面化
        for (let r = 0; r < radialSegments; r++) {
            const r0 = r * profilePoints;
            const r1 = (r + 1) * profilePoints;
            for (let p = 0; p < profilePoints - 1; p++) {
                const p0 = p;
                const p1 = p + 1;
                indices.push(r0 + p0, r1 + p0, r1 + p1);
                indices.push(r0 + p0, r1 + p1, r0 + p1);
            }
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    };

    // ---- 【全新工業級】導流集風圈 (Venturi Inlet Bellmouth) 幾何生成 ----
    const buildVenturiNozzleGeo = () => {
        const points = [];
        const rOuter = 0.25;
        const rInner = 0.235;
        const depth = 0.12;
        
        // 12點擬真剖面曲線 (雙壁厚度，防止單面貼圖穿透)
        for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            const x = (t - 0.5) * depth;
            let r;
            if (t < 0.25) { // 喇叭狀進風面
                const f = (0.25 - t) / 0.25;
                r = rInner + f * f * 0.024;
            } else if (t > 0.8) { // 出風面稍微擴散
                const f = (t - 0.8) / 0.2;
                r = rInner + f * 0.003;
            } else {
                r = rInner;
            }
            points.push(new THREE.Vector2(r, x));
        }
        // 反向繪製外壁厚度 (5mm 鋼板)
        for (let i = 12; i >= 0; i--) {
            const t = i / 12;
            const x = (t - 0.5) * depth;
            let r;
            if (t < 0.25) {
                const f = (0.25 - t) / 0.25;
                r = rInner + f * f * 0.024 + 0.005;
            } else {
                r = rInner + 0.005;
            }
            points.push(new THREE.Vector2(r, x));
        }

        const lathe = new THREE.LatheGeometry(points, 24);
        lathe.rotateZ(Math.PI / 2); // 對齊 X 軸為流道方向
        return lathe;
    };

    // ---- 【全新工業級】弧形懸吊支撐架 (Curved Spider Arm) 幾何生成 ----
    const buildSpiderArmGeo = () => {
        // 從馬達直徑曲向導風圈內壁，呈重工業 L/S 弧線工藝型態
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.045, 0.0, 0.0),
            new THREE.Vector3(0.02, 0.04, 0.07),
            new THREE.Vector3(-0.02, 0.08, 0.15),
            new THREE.Vector3(-0.04, 0.09, 0.225)
        ]);
        const tube = new THREE.TubeGeometry(curve, 10, 0.007, 6, false);
        return tube;
    };

    // ---- 【全新工業級】真實褶形過濾網 (Pleated Filter) 幾何生成 ----
    const buildPleatedFilterGeo = (width, height, depth) => {
        const geo = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const uvs = [];
        
        const pleatCount = 24; // 24褶
        const pleatWidth = width / pleatCount;

        for (let i = 0; i <= pleatCount; i++) {
            const z = -width / 2 + i * pleatWidth;
            const x = (i % 2 === 0) ? -depth / 2 : depth / 2; // Z字形鋸齒褶皺
            
            // 頂端點
            vertices.push(x, height / 2, z);
            uvs.push(i / pleatCount, 1);
            // 底端點
            vertices.push(x, -height / 2, z);
            uvs.push(i / pleatCount, 0);
        }

        for (let i = 0; i < pleatCount; i++) {
            const v0 = i * 2;
            const v1 = i * 2 + 1;
            const v2 = (i + 1) * 2;
            const v3 = (i + 1) * 2 + 1;
            indices.push(v0, v1, v2);
            indices.push(v1, v3, v2);
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    };

    // 2. 鋼構風牆組件、馬達殼體、水閥各部件基礎幾何結構
    const fanRadius = 0.24;
    const fanDepth = 0.25;

    const box1 = new THREE.BoxGeometry(1, 1, 1);
    const bladeGeo = buildAerofoilBladeGeo();
    const venturiGeo = buildVenturiNozzleGeo();
    const spiderArmGeo = buildSpiderArmGeo();

    // EC 馬達殼體細部：電機主筒、散熱肋片、接線盒、端蓋
    const motorBodyGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.11, 16).rotateZ(Math.PI / 2);
    const motorRearCoverGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.015, 12).rotateZ(Math.PI / 2);
    const motorFinGeo = new THREE.BoxGeometry(0.09, 0.003, 0.024); // 軸向散熱鰭片
    const terminalBoxGeo = new THREE.BoxGeometry(0.035, 0.035, 0.025);
    const cableGlandGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8);

    // Guard Concentric Grill: Concentric rings and spokes (100% 鋼網實建模擬)
    const guardRingGeo = new THREE.TorusGeometry(1, 0.0014, 4, 18).rotateY(Math.PI / 2);
    const guardSpokeGeo = new THREE.CylinderGeometry(0.002, 0.002, 1, 8).rotateZ(Math.PI / 2);

    // 緊固螺栓
    const hexBoltHeadGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 6);
    const washerGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0018, 12);
    const eyeGeo = new THREE.TorusGeometry(0.025, 0.006, 6, 12); // 吊裝耳幾何
    const ledIndicatorGeo = new THREE.SphereGeometry(0.008, 8, 8); // LED燈珠幾何

    // 管路組件幾何
    const pipeGeoVert = new THREE.CylinderGeometry(0.022, 0.022, 1.0, 12);
    const pipeGeoHoriz = new THREE.CylinderGeometry(0.013, 0.013, 1.0, 12).rotateZ(Math.PI / 2);
    const elbowGeo = new THREE.TorusGeometry(0.035, 0.015, 8, 12, Math.PI / 2);
    const flangeGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.012, 12);
    const rubberJointGeo = new THREE.TorusGeometry(0.02, 0.008, 8, 12); // 橡膠防震軟接
    const uBendGeo = new THREE.TorusGeometry(0.025, 0.008, 8, 12, Math.PI); // 盤管銅迴路 U 彎

    // 閥門執行器與 PICV Body
    const valveActuatorGeo = new THREE.BoxGeometry(0.05, 0.055, 0.045);
    const PICVBodyGeo = new THREE.BoxGeometry(0.052, 0.045, 0.042);

    // 傳感器與 Cable Tray 網架
    const transmitterBoxGeo = new THREE.BoxGeometry(0.04, 0.04, 0.025);

    // 3. 輔助導航與材質建立
    if (!this.materials.filterFiberMat) {
        // 【優化】將原本 Wireframe 虛擬濾網重構為「灰白灰白」高物理實體阻光濾芯
        this.materials.filterFiberMat = new THREE.MeshStandardMaterial({
            color: 0xdfe4ea,          // 工業灰白防塵纖維色 (RAL 9003 / RAL 7035 相似度調校)
            roughness: 0.85,          // 纖維紙質漫反射
            metalness: 0.05,          // 非金屬高分子聚合物
            transparent: true,
            opacity: 0.92,            // 92% 高遮光率，大幅阻隔前後直接通透的空洞視感
            side: THREE.DoubleSide,   // 雙面渲染確保折疊百葉面不受背向剔除影響
            depthWrite: true
        });
    } else {
        // 若外部已建立，直接覆寫關鍵屬性確保即時套用
        this.materials.filterFiberMat.wireframe = false;
        this.materials.filterFiberMat.color.setHex(0xdfe4ea);
        this.materials.filterFiberMat.roughness = 0.85;
        this.materials.filterFiberMat.metalness = 0.05;
        this.materials.filterFiberMat.transparent = true;
        this.materials.filterFiberMat.opacity = 0.92;
        this.materials.filterFiberMat.side = THREE.DoubleSide;
        this.materials.filterFiberMat.depthWrite = true;
    }

    const pushLocalMatrix = (arr, px, py, pz, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
        const dummy = new THREE.Object3D();
        dummy.position.set(px, py, pz);
        dummy.scale.set(sx, sy, sz);
        dummy.rotation.set(rx, ry, rz);
        dummy.updateMatrix();
        arr.push(dummy.matrix.clone());
    };

    const addLocalInstancedMesh = (parent, geo, mat, matrices) => {
        if (!matrices.length) return;
        const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
    };

    const cols = [-0.72, 0, 0.72];
    const rows = [0.7, 0, -0.7];

    const reservedGroup = new THREE.Group();

    // ---- 【葉片轉子模組】 ebm/Ziehl 原廠型 EC 後彎式離心葉輪 (Centrifugal Plug Impeller) ----
    const buildIndustrialRotor = () => {
        const rotor = new THREE.Group();
        
        // 1. 後盤 (Backplate - 實心關閉圓盤)
        const backplatePoints = [
            new THREE.Vector2(0.0, -0.035),
            new THREE.Vector2(0.23, -0.035),
            new THREE.Vector2(0.23, -0.03),
            new THREE.Vector2(0.0, -0.03)
        ];
        const backplateGeo = new THREE.LatheGeometry(backplatePoints, 24);
        backplateGeo.rotateZ(Math.PI / 2); // 對齊 X 軸
        const backplateMesh = new THREE.Mesh(backplateGeo, this.materials.ecFanBlue);
        backplateMesh.castShadow = true;
        backplateMesh.receiveShadow = true;
        rotor.add(backplateMesh);

        // 2. 前盤導流罩 (Inlet Shroud - 喇叭口中心進風環)
        const shroudPoints = [
            new THREE.Vector2(0.14, 0.035),  // 進風眼口
            new THREE.Vector2(0.145, 0.032),
            new THREE.Vector2(0.17, 0.02),
            new THREE.Vector2(0.20, 0.0),
            new THREE.Vector2(0.23, -0.025), // 葉輪外徑端
            new THREE.Vector2(0.23, -0.03),  
            new THREE.Vector2(0.225, -0.03), 
            new THREE.Vector2(0.195, -0.005),
            new THREE.Vector2(0.155, 0.022),
            new THREE.Vector2(0.142, 0.033)
        ];
        const shroudGeo = new THREE.LatheGeometry(shroudPoints, 24);
        shroudGeo.rotateZ(Math.PI / 2); // 對齊 X 軸
        const shroudMesh = new THREE.Mesh(shroudGeo, this.materials.ecFanBlue);
        shroudMesh.castShadow = true;
        shroudMesh.receiveShadow = true;
        rotor.add(shroudMesh);

        // 3. 亮藍色外轉子電機中心 Hub
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.042, 16), this.materials.fanwallHub);
        hub.rotation.z = Math.PI / 2;
        rotor.add(hub);

        // 4. 7 片實體裝配的仿生型後彎式三維翼型葉片 (Aerofoil Blades)
        // 沿 X 軸拉伸（流道），並在 Y-Z 面旋轉定位，完美夾在前後盤之間
        const customBladeGeo = bladeGeo.clone();
        customBladeGeo.rotateY(Math.PI / 2); // 使拉伸軸 aligned to X-axis
        customBladeGeo.translate(-0.035, 0, 0); // 置中

        for (let i = 0; i < 7; i++) {
            const bladeMesh = new THREE.Mesh(customBladeGeo, this.materials.fanwallBlade);
            const angle = (i / 7) * Math.PI * 2;
            bladeMesh.rotation.x = angle; // 繞局部 X 軸均勻分佈
            rotor.add(bladeMesh);
        }

        // 5. 轉子磁鐵外殼 (Rotor Cover)
        const motorRotorHubGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.04, 16).rotateZ(Math.PI / 2);
        const motorRotorHubMesh = new THREE.Mesh(motorRotorHubGeo, this.materials.ecFanBlue);
        motorRotorHubMesh.position.x = -0.05; // 置於後盤中心
        rotor.add(motorRotorHubMesh);

        return rotor;
    };

    // 4. 針對每一組 Slot 進行風牆單元建造
    FW.slotZs.forEach((cz, slotIdx) => {
        const isInstalled = FW.installed.includes(slotIdx);

        if (isInstalled) {
            const unitGroup = new THREE.Group();
            unitGroup.position.set(FW.x, FW.h / 2, cz);
            const fwUnitIndex = FW.installed.indexOf(slotIdx) + 1;
            unitGroup.userData = { type: 'Fanwall', name: `FanWall-${String(fwUnitIndex).padStart(2, '0')}` };

            // 建立 LOD 節點來保證網頁渲染效能 (高細節 & 遠程低細節)
            const unitLOD = new THREE.LOD();
            const highDetailGroup = new THREE.Group();
            const lowDetailGroup = new THREE.Group();

            unitLOD.addLevel(highDetailGroup, 0);
            unitLOD.addLevel(lowDetailGroup, 18); // 18 米外無縫轉換

            // 爆炸拆解支援：濾網/盤管模組 (+X 面) 與風機模組 (-X 面) 各自成殼，
            // 呼應 explodeShells 機制 (與 createCDU 的 topPlateGroup/sideGroup 相同寫法)，
            // 靜態機殼骨架 (frame/skid/screen/duct) 保持原位不動
            const frontModuleGroup = new THREE.Group();
            frontModuleGroup.userData = { isShell: true, origPos: new THREE.Vector3(0, 0, 0), explodeDir: new THREE.Vector3(0.55, 0, 0) };
            this.explodeShells.push(frontModuleGroup);
            highDetailGroup.add(frontModuleGroup);

            const fanModuleGroup = new THREE.Group();
            fanModuleGroup.userData = { isShell: true, origPos: new THREE.Vector3(0, 0, 0), explodeDir: new THREE.Vector3(-0.55, 0, 0) };
            this.explodeShells.push(fanModuleGroup);
            highDetailGroup.add(fanModuleGroup);

            // ==========================================
            // A. 低細節 (Low LOD) 結構：維持大輪廓、無高密螺栓與護網
            // ==========================================
            const simpleBody = new THREE.Mesh(new THREE.BoxGeometry(FW.w, FW.h, FW.d), this.materials.fanwallCasing);
            lowDetailGroup.add(simpleBody);

            const simpleKick = new THREE.Mesh(new THREE.BoxGeometry(FW.w + 0.04, 0.06, FW.d + 0.04), this.materials.fanwallTrim);
            simpleKick.position.y = -FW.h / 2 - 0.03;
            lowDetailGroup.add(simpleKick);

            // 9組簡易風扇碟盤代表 (Centrifugal Disc)
            rows.forEach(fy => {
                cols.forEach(fz => {
                    const disk = new THREE.Mesh(new THREE.CylinderGeometry(fanRadius, fanRadius, 0.08, 12).rotateZ(Math.PI / 2), this.materials.fanwallBlade);
                    disk.position.set(-FW.w / 2 - 0.01, fy, fz);
                    lowDetailGroup.add(disk);
                });
            });

            // ==========================================
            // B. 高細節 (High LOD) 工業重裝 CAD 實景
            // ==========================================

            // B1. 外殼框架與支撐結構 (Structural Frame)
            const frameMat = this.materials.fanwallCasing;
            const panelMat = this.materials.fanwallPanel;

            // 頂底板
            const topSkid = new THREE.Mesh(new THREE.BoxGeometry(FW.w - 0.01, 0.03, FW.d - 0.01), panelMat);
            topSkid.position.y = FW.h / 2 - 0.015;
            highDetailGroup.add(topSkid);

            // 左右側牆板
            const endCapL = new THREE.Mesh(new THREE.BoxGeometry(FW.w - 0.02, FW.h - 0.08, 0.02), panelMat);
            endCapL.position.z = FW.d / 2 - 0.01;
            highDetailGroup.add(endCapL);

            const endCapR = endCapL.clone();
            endCapR.position.z = -FW.d / 2 + 0.01;
            highDetailGroup.add(endCapR);

            // 踢腳鋼軌 (Base Rail / Skid)
            const kickRail = new THREE.Mesh(new THREE.BoxGeometry(FW.w + 0.04, 0.06, FW.d + 0.04), frameMat);
            kickRail.position.y = -FW.h / 2 - 0.03;
            highDetailGroup.add(kickRail);

            // B2. 冷凍水盤組件 (Stainless Drain Pan) - 盤管下防滴漏斜板
            const drainPan = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, FW.d - 0.06), this.materials.pipeStainless);
            drainPan.position.set(FW.w / 2 - 0.22, -FW.h / 2 + 0.035, 0);
            highDetailGroup.add(drainPan);

            // B3. 四角重型吊裝耳
            const eyeMatrices = [];
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
                this.pushInstMatrix(eyeMatrices, sx * (FW.w / 2 - 0.06), FW.h / 2 + 0.02, sz * (FW.d / 2 - 0.08));
            });
            const eyeMesh = new THREE.InstancedMesh(eyeGeo, this.materials.fanwallTrim, eyeMatrices.length);
            eyeMatrices.forEach((m, i) => {
                const rotFix = new THREE.Matrix4().makeRotationX(Math.PI / 2);
                eyeMesh.setMatrixAt(i, m.clone().multiply(rotFix));
            });
            eyeMesh.instanceMatrix.needsUpdate = true;
            highDetailGroup.add(eyeMesh);

            // B4. 高度優化之實例化容器 (Local Instanced Arrays)
            const boltMatrices = [];
            const guardRingMatrices = [];
            const guardSpokeMatrices = [];
            const filterFrameMatrices = [];
            const filterMediaMatrices = [];
            
            const venturiMatrices = [];
            const spiderArmMatrices = [];
            const motorBodyMatrices = [];
            const motorFinMatrices = [];
            const terminalBoxMatrices = [];
            const cableGlandMatrices = [];
            const ledIndicatorMatrices = [];

            const coilFinMatrices = [];
            const coilTubeMatrices = [];
            const coilUBendMatrices = [];
            
            const pipeVertMatrices = [];
            const pipeHorizMatrices = [];
            const elbowMatrices = [];
            const flangeMatrices = [];
            const rubberJointMatrices = [];
            const picvMatrices = [];
            const actuatorMatrices = [];
            const valveLeverMatrices = [];
            const transmitterMatrices = [];

            // B5. 收集 Hex Bolts 緊固螺栓 (在框架連接縫與底座上追加 12x 實體螺帽)
            for (let k = 0; k < 6; k++) {
                const bz = -FW.d / 2 + 0.08 + k * (FW.d - 0.16) / 5;
                pushLocalMatrix(boltMatrices, -FW.w / 2 + 0.04, -FW.h / 2, bz);
                pushLocalMatrix(boltMatrices, FW.w / 2 - 0.04, -FW.h / 2, bz);
            }

            // B6. 褶形過濾網模組 (G4/F7 Filter Module + Holding Frame)
            const filterWidth = 0.54;
            const filterHeight = FW.h - 0.14;
            const filterDepth = 0.045;
            const filterX = FW.w / 2 - 0.015;

            // 創建 3 組褶網模組並排
            cols.forEach(fz => {
                // 鍍鋅外框
                pushLocalMatrix(filterFrameMatrices, filterX, filterHeight / 2, fz, filterDepth, 0.015, filterWidth);
                pushLocalMatrix(filterFrameMatrices, filterX, -filterHeight / 2, fz, filterDepth, 0.015, filterWidth);
                pushLocalMatrix(filterFrameMatrices, filterX, 0, fz - filterWidth / 2 + 0.005, filterDepth, filterHeight - 0.01, 0.01);
                pushLocalMatrix(filterFrameMatrices, filterX, 0, fz + filterWidth / 2 - 0.005, filterDepth, filterHeight - 0.01, 0.01);
                
                // 褶層定位
                pushLocalMatrix(filterMediaMatrices, filterX - 0.002, 0, fz);
                
                // 緊固快拆扣
                pushLocalMatrix(boltMatrices, filterX + 0.01, filterHeight / 2 - 0.04, fz);
                pushLocalMatrix(boltMatrices, filterX + 0.01, -filterHeight / 2 + 0.04, fz);
            });

            // B7. 冷卻盤管模組 (Aluminum Coils Module - 緊貼在濾網後方)
            const coilX = FW.w / 2 - 0.14;
            const coilW = 0.10; // 盤管鰭片厚度
            const coilH = FW.h - 0.18;

            cols.forEach(fz => {
                // 1. 散熱鰭片鋁座 (使用 Normal-Map 高密法線貼圖)
                pushLocalMatrix(coilFinMatrices, coilX, 0, fz, coilW, coilH, filterWidth - 0.04);

                // 2. 4 排穿孔銅管 + staggered 兩端 180度 U-Bends
                const tubeRows = 14;
                const tubeDepth = 4;
                const tubeSpacing = coilH / tubeRows;

                for (let td = 0; td < tubeDepth; td++) {
                    const tx = coilX - coilW / 2 + (td / (tubeDepth - 1)) * coilW;
                    for (let tr = 0; tr < tubeRows; tr++) {
                        const ty = -coilH / 2 + tr * tubeSpacing + tubeSpacing / 2;
                        // 貫穿銅管 (橫向穿透)
                        pushLocalMatrix(coilTubeMatrices, tx, ty, fz, filterWidth - 0.05, 1, 1, 0, 0, Math.PI / 2);

                        // 銅彎頭 U-Bend
                        if (tr % 2 === 0) {
                            pushLocalMatrix(coilUBendMatrices, tx, ty, fz - filterWidth / 2 + 0.025, 1, 1, 1, 0, -Math.PI / 2, 0);
                            pushLocalMatrix(coilUBendMatrices, tx, ty, fz + filterWidth / 2 - 0.025, 1, 1, 1, 0, Math.PI / 2, 0);
                        }
                    }
                }
            });

            // B8. 冷凍水管路與 Belimo Actuator 閥門調節組 (Pipe & Valve Module)
            const pipeX = 0.04;
            const mainPipeY = FW.h - 0.16;

            // 1. 進出水主管 (一側進、一側出)
            pushLocalMatrix(pipeVertMatrices, pipeX, 0, -0.16, 1, mainPipeY, 1); // 供應主管 (Supply)
            pushLocalMatrix(pipeVertMatrices, pipeX, 0, 0.16, 1, mainPipeY, 1);  // 回水主管 (Return)

            // 連接法蘭與緊固螺絲 (Flanges & Flange Bolts)
            pushLocalMatrix(flangeMatrices, pipeX, FW.h / 2 - 0.02, -0.16);
            pushLocalMatrix(flangeMatrices, pipeX, FW.h / 2 - 0.02, 0.16);

            for (let b = 0; b < 6; b++) {
                const theta = (b / 6) * Math.PI * 2;
                pushLocalMatrix(boltMatrices, pipeX + Math.cos(theta) * 0.03, FW.h / 2 - 0.02, -0.16 + Math.sin(theta) * 0.03);
                pushLocalMatrix(boltMatrices, pipeX + Math.cos(theta) * 0.03, FW.h / 2 - 0.02, 0.16 + Math.sin(theta) * 0.03);
            }

            // 2. 連接至 3 組盤管的分支水閥路與 Belimo Actuator 執行器
            const pipeBranches = [-0.16, 0.16];
            pipeBranches.forEach(pz => {
                rows.forEach((fy) => {
                    // 橫向分配支管
                    pushLocalMatrix(pipeHorizMatrices, pipeX + 0.04, fy, pz, 0.08, 1, 1);
                    // 90度不鏽鋼彎頭
                    pushLocalMatrix(elbowMatrices, pipeX, fy, pz, 1, 1, 1, 0, pz > 0 ? 0 : Math.PI, 0);
                    // 橡膠防震軟接頭
                    pushLocalMatrix(rubberJointMatrices, pipeX + 0.08, fy, pz, 1, 1, 1, 0, Math.PI / 2, 0);

                    // 智慧調節閥本體 (PICV Body)
                    pushLocalMatrix(picvMatrices, pipeX + 0.11, fy, pz);
                    // 標誌性 Belimo 執行器橙色盒 (Belimo Actuator Box)
                    pushLocalMatrix(actuatorMatrices, pipeX + 0.11, fy + 0.032, pz);
                    // 手動隔離閥 (Isolation Valves levers)
                    pushLocalMatrix(valveLeverMatrices, pipeX + 0.05, fy + 0.02, pz, 0.01, 0.01, 0.05, 0.45, 0, 0);
                });
            });

            // B9. 差壓感測器等自控儀表 (Instrumentation Sensors)
            const dpTransmitterX = FW.w / 2 - 0.05;
            pushLocalMatrix(transmitterMatrices, dpTransmitterX, 0.35, FW.d / 2 - 0.03);

            // B10. 電纜網格橋架 (Cable Tray) - 橫跨在水管後側上方
            const trayLength = FW.d - 0.08;
            pushLocalMatrix(flangeMatrices, -0.06, FW.h / 2 - 0.06, 0, 1.2, 0.01, trayLength, 0, 0, Math.PI / 2);

            // B11. 3 直 × 3 橫 = 9 組完全裸露式變頻 EC 離心風機系統 (-X 排風面)
            const fanX = -FW.w / 2 + 0.12;

            rows.forEach(fy => {
                cols.forEach(fz => {
                    // 1. 【活動轉子】全擬真後彎離心葉輪組 (加載至全域運動陣列)
                    const rotor = buildIndustrialRotor();
                    rotor.position.set(fanX, fy, fz);
                    fanModuleGroup.add(rotor);
                    this.fanRotors.push(rotor);

                    // 2. 【靜態導流】空氣動力流線型集風罩 (Venturi Nozzle)
                    pushLocalMatrix(venturiMatrices, fanX + 0.03, fy, fz);

                    // 3. 【電機馬達本體】EC Motor Housing
                    pushLocalMatrix(motorBodyMatrices, fanX + 0.09, fy, fz);
                    
                    // 4. 【馬達外殼散熱鰭片】Cylinder surround radiating fins
                    const finCount = 8;
                    for (let f = 0; f < finCount; f++) {
                        const angle = (f / finCount) * Math.PI * 2;
                        pushLocalMatrix(motorFinMatrices, 
                            fanX + 0.14, 
                            fy + Math.cos(angle) * 0.045, 
                            fz + Math.sin(angle) * 0.045, 
                            1, 1, 1, 
                            angle, 0, 0
                        );
                    }

                    // 5. 【接線盒與電纜接頭】Terminal box and gland
                    pushLocalMatrix(terminalBoxMatrices, fanX + 0.11, fy + 0.04, fz + 0.03, 1, 1, 1, 0, 0, 0.2);
                    pushLocalMatrix(cableGlandMatrices, fanX + 0.11, fy + 0.055, fz + 0.03);

                    // 6. 【智慧運行監控 LED 燈】
                    pushLocalMatrix(ledIndicatorMatrices, fanX - 0.05, fy + 0.18, fz + 0.18);

                    // 7. 【重型 Spider Arm】
                    // 3 向 120 度放射懸吊蛛翼鑄鋁支架，支撐中央 EC 馬達
                    const armSpokes = 3;
                    for (let a = 0; a < armSpokes; a++) {
                        const angle = (a / armSpokes) * Math.PI * 2;
                        pushLocalMatrix(spiderArmMatrices, 
                            fanX + 0.08, 
                            fy, 
                            fz, 
                            1, 1, 1, 
                            angle, 0, 0 // 繞 X 軸徑向發散
                        );
                    }

                    // 8. 【concentric steel wire guard】
                    // 安全密格網罩：20 圈細鋼環與 4 根粗骨架徑向焊接 (ebm-papst 標準)
                    const ringsCount = 20;
                    for (let j = 0; j < ringsCount; j++) {
                        const r = 0.06 + j * (fanRadius - 0.075) / (ringsCount - 1);
                        pushLocalMatrix(guardRingMatrices, fanX - 0.015, fy, fz, 1, r, r);
                    }
                    const spokeWires = 4;
                    for (let s = 0; s < spokeWires; s++) {
                        const angle = (s / spokeWires) * Math.PI * 2;
                        pushLocalMatrix(guardSpokeMatrices, 
                            fanX - 0.015, 
                            fy + Math.cos(angle) * (fanRadius / 2.2), 
                            fz + Math.sin(angle) * (fanRadius / 2.2), 
                            fanRadius - 0.04, 1, 1, 
                            0, 0, angle
                        );
                    }

                    // 9. 【電機配線佈線】
                    // 新增實體電纜線從接線盒引出，順著導風支架排入上方 Cable Tray
                    const cableCurve = new THREE.CatmullRomCurve3([
                        new THREE.Vector3(fanX + 0.11, fy + 0.055, fz + 0.03), 
                        new THREE.Vector3(fanX + 0.05, fy + 0.12, fz + 0.06),  
                        new THREE.Vector3(-0.06, FW.h / 2 - 0.06, fz)          
                    ]);
                    const cableGeo = new THREE.TubeGeometry(cableCurve, 8, 0.003, 4, false);
                    const cableMesh = new THREE.Mesh(cableGeo, this.materials.rubberBellows);
                    fanModuleGroup.add(cableMesh);
                });
            });

            // B12. 高速實例化組裝 (Assembly Instanced Meshes for High Detail)
            addLocalInstancedMesh(highDetailGroup, washerGeo, this.materials.boltMat, boltMatrices);
            addLocalInstancedMesh(frontModuleGroup, box1, this.materials.filterFrameMat, filterFrameMatrices);

            // 褶型濾芯加載 (改為實體灰白色折疊面，隨濾網/盤管模組一起爆炸拆解)
            const pleatGeo = buildPleatedFilterGeo(filterWidth - 0.01, filterHeight - 0.04, filterDepth);
            const pleatMesh = new THREE.Mesh(pleatGeo, this.materials.filterFiberMat);
            pleatMesh.castShadow = true;
            cols.forEach(fz => {
                const pClone = pleatMesh.clone();
                pClone.position.set(filterX - 0.002, 0, fz);
                frontModuleGroup.add(pClone);
            });

            // 集風罩與馬達零件實例化 (隨風機模組一起爆炸拆解)
            addLocalInstancedMesh(fanModuleGroup, venturiGeo, this.materials.fanwallTrim, venturiMatrices);
            addLocalInstancedMesh(fanModuleGroup, spiderArmGeo, this.materials.fanwallTrim, spiderArmMatrices);
            addLocalInstancedMesh(fanModuleGroup, motorBodyGeo, this.materials.ecFanBlue, motorBodyMatrices); // 採用 EC 專用工業藍色電機殼
            addLocalInstancedMesh(fanModuleGroup, motorRearCoverGeo, this.materials.fanwallCasing, motorBodyMatrices);
            addLocalInstancedMesh(fanModuleGroup, motorFinGeo, this.materials.fanwallTrim, motorFinMatrices);
            addLocalInstancedMesh(fanModuleGroup, terminalBoxGeo, this.materials.fanwallCasing, terminalBoxMatrices);
            addLocalInstancedMesh(fanModuleGroup, cableGlandGeo, this.materials.brassMat, cableGlandMatrices);
            addLocalInstancedMesh(fanModuleGroup, ledIndicatorGeo, this.materials.fanwallLed, ledIndicatorMatrices);

            // 護網密網格裝配 (隨風機模組一起爆炸拆解)
            addLocalInstancedMesh(fanModuleGroup, guardRingGeo, this.materials.fanwallGrille, guardRingMatrices);
            addLocalInstancedMesh(fanModuleGroup, guardSpokeGeo, this.materials.fanwallGrille, guardSpokeMatrices);

            // 冷卻盤管系統實例 (隨濾網/盤管模組一起爆炸拆解)
            addLocalInstancedMesh(frontModuleGroup, box1, this.materials.coilFinMat, coilFinMatrices);
            addLocalInstancedMesh(frontModuleGroup, pipeGeoHoriz, this.materials.fanwallCopper, coilTubeMatrices);
            addLocalInstancedMesh(frontModuleGroup, uBendGeo, this.materials.fanwallCopper, coilUBendMatrices);

            // 不鏽鋼水路管網裝配
            addLocalInstancedMesh(highDetailGroup, pipeGeoVert, this.materials.pipeStainless, pipeVertMatrices);
            addLocalInstancedMesh(highDetailGroup, pipeGeoHoriz, this.materials.pipeStainless, pipeHorizMatrices);
            addLocalInstancedMesh(highDetailGroup, elbowGeo, this.materials.pipeStainless, elbowMatrices);
            addLocalInstancedMesh(highDetailGroup, flangeGeo, this.materials.pipeStainless, flangeMatrices);
            addLocalInstancedMesh(highDetailGroup, rubberJointGeo, this.materials.rubberBellows, rubberJointMatrices);
            addLocalInstancedMesh(highDetailGroup, PICVBodyGeo, this.materials.fanwallCasing, picvMatrices);
            addLocalInstancedMesh(highDetailGroup, valveActuatorGeo, this.materials.belimoOrange, actuatorMatrices);
            addLocalInstancedMesh(highDetailGroup, box1, this.materials.brassMat, valveLeverMatrices);
            addLocalInstancedMesh(highDetailGroup, transmitterBoxGeo, this.materials.fanwallCasing, transmitterMatrices);

            // B13. 側面液晶控制螢幕 (Bezel & Glass)
            const screenBezel = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.31, 0.01), this.materials.fanwallTrim);
            screenBezel.position.set(0, 0.35, FW.d / 2 + 0.002);
            highDetailGroup.add(screenBezel);

            const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), this.materials.fanwallScreen);
            screen.position.set(0, 0.35, FW.d / 2 + 0.008);
            highDetailGroup.add(screen);

            // 頂部出線垂直小導管
            const ductH = this.VR_LAYOUT.room.ceilingY - FW.h;
            const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 12), this.materials.fanwallTrim);
            flange.position.set(0, FW.h / 2 + 0.008, 0);
            highDetailGroup.add(flange);

            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, ductH, 12), this.materials.fanwallTrim);
            pipe.position.set(0, FW.h / 2 + ductH / 2, 0);
            highDetailGroup.add(pipe);

            // 互動判定框 (HitBox) —— 讓風牆單元可被滑鼠 hover/click 選取，跳出右側設備資訊面板
            const hitBox = new THREE.Mesh(new THREE.BoxGeometry(FW.w, FW.h, FW.d), new THREE.MeshBasicMaterial({ visible: false }));
            hitBox.userData = unitGroup.userData;
            unitGroup.add(hitBox);
            this.interactables.push(hitBox);

            // 將組建完畢的 LOD 加入 Slot 組中
            unitGroup.add(unitLOD);
            fwGroup.add(unitGroup);
        } else {
            // 預留擴充位文字牌 (N+1 Reserved Plate)
            const label = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.22), this.materials.fanwallReserved);
            label.rotation.x = -Math.PI / 2;
            label.position.set(FW.x, 0.011, cz);
            reservedGroup.add(label);
        }
    });
    fwGroup.add(reservedGroup);
};
