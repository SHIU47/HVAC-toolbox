/**
 * createCDU(x, y, z, name)
 * Extracted module for CDU (Cooling Distribution Unit) refinement.
 */
function createCDU(x, y, z, name) {
    const w = 1.2, h = 2.2, d = 1.0;
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
    // 0.3 前門設計 (左玻璃門與右控制板鋼門)
    // ==========================================
    // 左側玻璃視窗門
    const leftDoorGroup = new THREE.Group();
    const leftDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(w / 2, h - 0.08, 0.02), this.materials.rackFrame);
    leftDoorFrame.position.set(-w / 4, 0, d / 2 - 0.01);
    leftDoorGroup.add(leftDoorFrame);
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(w / 2 - 0.08, h - 0.2), glassMat);
    glassPane.position.set(-w / 4, 0, d / 2);
    leftDoorGroup.add(glassPane);
    group.add(leftDoorGroup);

    // 右側鋼門
    const rightDoorGroup = new THREE.Group();
    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(w / 2, h - 0.08, 0.02), this.materials.rackFrame);
    rightDoor.position.set(w / 4, 0, d / 2 - 0.01);
    rightDoorGroup.add(rightDoor);
    group.add(rightDoorGroup);

    // 內部垂直 LED 燈條 (提供展示照明)
    const neonLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h - 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
    neonLeft.position.set(-w / 2 + 0.08, 0, d / 2 - 0.06);
    group.add(neonLeft);
    const neonRight = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h - 0.2, 16), new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }));
    neonRight.position.set(-0.08, 0, d / 2 - 0.06);
    group.add(neonRight);

    // ==========================================
    // 1. 高精度板式熱交換器 (PHX - Plate Heat Exchanger)
    // ==========================================
    const phxGroup = new THREE.Group();
    const plateCount = 60; // 增加板數，讓體積感更重
    const plateSpacing = 0.0035;
    const plateW = 0.25, plateH = 0.45;
    const phxDepth = plateCount * plateSpacing;

    // 散熱板主體 (使用一個實體方塊模擬緊密的板片，並加上紋理視覺)
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

    // N+1 重複板熱交換器：建置兩個 PHX Stack (移到中上方以避免與泵浦重疊)
    const phx1 = phxGroup.clone();
    phx1.position.set(-0.3, 0.5, -0.1);
    group.add(phx1);

    const phx2 = phxGroup.clone();
    phx2.position.set(-0.3, -0.1, -0.1);
    group.add(phx2);

    // ==========================================
    // 2. 工業級二次側循環泵 - 臥式離心泵 (Secondary Horizontal Pumps)
    // ==========================================
    const buildPump = (px, pz, label) => {
        const pump = new THREE.Group();
        pump.scale.set(1.5, 1.5, 1.5);
        
        // 防震基座 (橫向躺平)
        const avMount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.25), ironMat);
        avMount.position.set(0, -0.09, -0.05);
        pump.add(avMount);
        [[-0.06, -0.12], [0.06, -0.12], [-0.06, 0.02], [0.06, 0.02]].forEach(sp => {
            const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.025, 12), stainlessMat);
            spring.position.set(sp[0], -0.105, sp[1]);
            pump.add(spring);
        });

        // 馬達主體 (臥式躺平, 軸心沿 Z 軸)
        const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 24), pumpMotorMat);
        motorBody.rotation.x = Math.PI / 2;
        motorBody.position.set(0, 0, -0.05);
        pump.add(motorBody);
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.015, 0.18), pumpMotorMat);
            fin.position.set(Math.cos(angle) * 0.062, Math.sin(angle) * 0.062, -0.05);
            fin.rotation.z = angle;
            pump.add(fin);
        }

        // 馬達接線盒 (Terminal Box)
        const terminalBox = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), pumpMotorMat);
        terminalBox.position.set(0.05, 0.05, -0.05);
        pump.add(terminalBox);
        const powerCable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8), rubberMat);
        powerCable.position.set(0.07, 0.05, -0.01);
        powerCable.rotation.x = Math.PI / 4;
        pump.add(powerCable);

        // 散熱風扇罩 (在馬達後端)
        const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.04, 24), ironMat);
        motorCap.rotation.x = Math.PI / 2;
        motorCap.position.set(0, 0, -0.17);
        pump.add(motorCap);

        // 泵浦蝸殼 (Volute - 垂直 Torus)
        const volute = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.035, 16, 24), ironMat);
        volute.position.set(0, 0, 0.08);
        pump.add(volute);

        // 臥式進水 (Suction - 水平向前沿 Z 軸)
        const suction = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 16), ironMat);
        suction.rotation.x = Math.PI / 2;
        suction.position.set(0, 0, 0.13);
        pump.add(suction);
        const sFlange = createFlange(0.04, 0.008, 6);
        sFlange.rotation.x = Math.PI / 2;
        sFlange.position.set(0, 0, 0.16);
        pump.add(sFlange);

        // 臥式出水 (Discharge - 垂直向上沿 Y 軸)
        const discharge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 16), ironMat);
        discharge.position.set(0, 0.06, 0.08);
        pump.add(discharge);
        const dFlange = createFlange(0.035, 0.008, 6);
        dFlange.position.set(0, 0.09, 0.08);
        pump.add(dFlange);

        // 臥式泵浦位置（靠近箱體底部，避免重疊）
        pump.position.set(px, -0.9, pz);
        pump.userData = { type: 'Pump', name: label };
        return pump;
    };

    // 將大型泵浦置於左側玻璃門後 (並排置於底部)
    group.add(buildPump(-0.38, 0.0, 'PUMP_A (Active)'));
    group.add(buildPump(-0.12, 0.0, 'PUMP_B (Standby)'));

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

    tankGroup.position.set(0.35, 0.4, -0.2);
    group.add(tankGroup);

    // ==========================================
    // 4. 管網系統 (Piping & Manifolds)
    // ==========================================
    // 供回水歧管 (Manifolds) - 配合 2.2m 高度
    const supplyHeader = createPipe(0.04, 0.8, stainlessMat);
    supplyHeader.position.set(-0.3, 0.4, 0.05);
    group.add(supplyHeader);
    const returnHeader = createPipe(0.04, 0.8, stainlessMat);
    returnHeader.position.set(0.3, 0.4, 0.05);
    group.add(returnHeader);

    // 增加歧管上的色環標示
    [-0.15, 0.15].forEach(by => {
        const bandB = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
        bandB.position.set(-0.3, 0.4 + by, 0.05);
        group.add(bandB);
        const bandR = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        bandR.position.set(0.3, 0.4 + by, 0.05);
        group.add(bandR);
    });

    // 大口徑球閥
    const isoValve1 = createBallValve(0.03);
    isoValve1.position.set(-0.3, 0.85, 0.05);
    group.add(isoValve1);
    const isoValve2 = createBallValve(0.03);
    isoValve2.position.set(0.3, 0.85, 0.05);
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
    plcBox.position.set(0.3, 0.6, -0.25);
    group.add(plcBox);

    // CDU 主螢幕 (HMI) - 移至右側門面
    const screenGroup = new THREE.Group();
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.03), ironMat);
    screenGroup.add(screenFrame);
    const screenGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: this.textures.cduScreen }));
    screenGlass.position.z = 0.016;
    screenGroup.add(screenGlass);
    
    screenGroup.position.set(0.3, h / 2 - 0.35, d / 2 + 0.01);
    screenGroup.userData = { isShell: true, origPos: screenGroup.position.clone(), explodeDir: new THREE.Vector3(0, 0, 0.3) };
    this.explodeShells.push(screenGroup);
    group.add(screenGroup);

    // 急停按鈕 (E-Stop) 與指示燈 - 移至右側門面
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
    if (!this.cduIndicators) this.cduIndicators = [];
    const indicators = { green: null, yellow: null, red: null };

    [0x22c55e, 0xfbbf24, 0xef4444].forEach((c, i) => {
        const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), stainlessMat);
        bezel.rotation.x = Math.PI / 2;
        bezel.position.set(-0.15 - i * 0.05, 0.05, 0);
        controlPanelGroup.add(bezel);
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.01, 16, 16), new THREE.MeshBasicMaterial({ color: c }));
        lens.position.set(-0.15 - i * 0.05, 0.05, 0.005);
        controlPanelGroup.add(lens);

        if (i === 0) indicators.green = lens;
        else if (i === 1) indicators.yellow = lens;
        else if (i === 2) indicators.red = lens;
    });

    group.userData.indicators = indicators;
    this.cduIndicators.push(indicators);

    controlPanelGroup.position.set(0.42, h / 2 - 0.65, d / 2 + 0.015);
    controlPanelGroup.userData = { isShell: true, origPos: controlPanelGroup.position.clone(), explodeDir: new THREE.Vector3(0, 0, 0.3) };
    this.explodeShells.push(controlPanelGroup);
    group.add(controlPanelGroup);

    // (Top cooling fans removed to align with liquid-to-liquid exchange standard)

    // ==========================================
    // 7. 互動判定框 (HitBox)
    // ==========================================
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.userData = group.userData;
    group.add(hitBox);
    this.interactables.push(hitBox);

    this.scene.add(group);
}
