const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'grey_space.html');
let html = fs.readFileSync(filePath, 'utf8');

// 1. Restore the indentation of lines 582-585 (revert any unintended edit)
html = html.replace(
    /                \/\/ 模擬電池把手與小 LED 指示燈\s+const handle = new THREE\.Mesh\(new THREE\.BoxGeometry\(0\.18, 0\.02, 0\.02\), this\.materials\.aluminum\);/g,
    '                                // 模擬電池把手與小 LED 指示燈\n                                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.02), this.materials.aluminum);'
);

// 2. Replace the Main Switch Board (createPDU) section to add dedicated Clean PDUs, safety signs, and ground trenches
const oldPduBlock = `                 // 建立主配電盤 (PDU / MSB) - 放在後方，增加細緻開關與發光警示燈
                 const createPDU = (xPos, label) => {
                     const pdu = new THREE.Group();
                     
                     const pBase = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.82), this.materials.darkMetal);
                     pBase.position.y = 0.04; pdu.add(pBase);

                     const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.12, 0.8), this.materials.cabinet);
                     body.position.y = 1.14; body.castShadow = true;
                     pdu.add(body);

                     // 斷路器開關排 (Breakers)
                     for(let r=0; r<4; r++) {
                         for(let c=0; c<3; c++) {
                             const xVal = -0.36 + c*0.36;
                             const yVal = 1.6 - r*0.35;
                             const breaker = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.04), this.materials.darkMetal);
                             breaker.position.set(xVal, yVal, 0.402);
                             pdu.add(breaker);
                             
                             // 紅/綠雙色切換手柄
                             const toggleColor = (r % 2 === 0) ? 0xef4444 : 0x22c55e;
                             const toggleMat = new THREE.MeshStandardMaterial({color: toggleColor, roughness: 0.3});
                             const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), toggleMat);
                             toggle.position.set(xVal, yVal + 0.02, 0.43);
                             toggle.rotation.x = (r % 2 === 0) ? -0.4 : 0.4;
                             pdu.add(toggle);
                             
                             // 小指示燈
                             const pduLed = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), (r % 2 === 0) ? this.materials.redLed : this.materials.greenLed);
                             pduLed.position.set(xVal - 0.07, yVal + 0.07, 0.42);
                             pdu.add(pduLed);
                         }
                     }

                     pdu.position.set(xPos, 0, -5);
                     const pduHit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.8), new THREE.MeshBasicMaterial({visible:false}));
                     pduHit.position.y = 1.1;
                     pduHit.userData = { type: 'PDU', name: label };
                     pdu.add(pduHit);
                     this.interactables.push(pduHit);
                     this.scene.add(pdu);
                 };

                 createPDU(-3, 'MSB-A (Main Switch Board)');
                 createPDU(0, 'Tie Panel');
                 createPDU(3, 'MSB-B (Main Switch Board)');`;

const newPduBlock = `                 // 建立主配電盤 (PDU / MSB) - 放在後方，增加細緻開關與發光警示燈
                 const createPDU = (xPos, label) => {
                     const pdu = new THREE.Group();
                     
                     const pBase = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.82), this.materials.darkMetal);
                     pBase.position.y = 0.04; pdu.add(pBase);

                     const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.12, 0.8), this.materials.cabinet);
                     body.position.y = 1.14; body.castShadow = true;
                     pdu.add(body);

                     // 斷路器開關排 (Breakers)
                     for(let r=0; r<4; r++) {
                         for(let c=0; c<3; c++) {
                             const xVal = -0.36 + c*0.36;
                             const yVal = 1.6 - r*0.35;
                             const breaker = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.04), this.materials.darkMetal);
                             breaker.position.set(xVal, yVal, 0.402);
                             pdu.add(breaker);
                             
                             // 紅/綠雙色切換手柄
                             const toggleColor = (r % 2 === 0) ? 0xef4444 : 0x22c55e;
                             const toggleMat = new THREE.MeshStandardMaterial({color: toggleColor, roughness: 0.3});
                             const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), toggleMat);
                             toggle.position.set(xVal, yVal + 0.02, 0.43);
                             toggle.rotation.x = (r % 2 === 0) ? -0.4 : 0.4;
                             pdu.add(toggle);
                             
                             // 小指示燈
                             const pduLed = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), (r % 2 === 0) ? this.materials.redLed : this.materials.greenLed);
                             pduLed.position.set(xVal - 0.07, yVal + 0.07, 0.42);
                             pdu.add(pduLed);
                         }
                     }

                     pdu.position.set(xPos, 0, -5);

                     // 門上的高壓警示標誌 (黃色三角形小片)
                     const warningGeo = new THREE.ConeGeometry(0.05, 0.1, 3);
                     const warningMat = new THREE.MeshBasicMaterial({color: 0xfbbf24});
                     const warningSign = new THREE.Mesh(warningGeo, warningMat);
                     warningSign.position.set(0, 1.9, 0.41);
                     warningSign.rotation.x = Math.PI;
                     warningSign.rotation.y = Math.PI;
                     pdu.add(warningSign);

                     const pduHit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.8), new THREE.MeshBasicMaterial({visible:false}));
                     pduHit.position.y = 1.1;
                     pduHit.userData = { type: 'PDU', name: label };
                     pdu.add(pduHit);
                     this.interactables.push(pduHit);
                     this.scene.add(pdu);
                 };

                 createPDU(-3, 'MSB-A (Main Switch Board)');
                 createPDU(0, 'Tie Panel');
                 createPDU(3, 'MSB-B (Main Switch Board)');

                 // 建立專用 PDU-A/B 乾淨配電櫃 (UPS Output Panels)
                 const createCleanPDU = (xPos, zPos, label) => {
                     const cpdu = new THREE.Group();
                     const base = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.62), this.materials.darkMetal);
                     base.position.y = 0.04; cpdu.add(base);

                     const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.02, 0.6), this.materials.cabinet);
                     body.position.y = 1.09; body.castShadow = true;
                     cpdu.add(body);

                     // PDU 前門上的狀態發光面板
                     const pduScreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.02), this.materials.darkMetal);
                     pduScreen.position.set(0, 1.5, 0.3);
                     cpdu.add(pduScreen);

                     const pduLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), this.materials.greenLed);
                     pduLed.position.set(0, 1.5, 0.312);
                     cpdu.add(pduLed);

                     // 量測儀表
                     const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), this.materials.aluminum);
                     dial.rotation.x = Math.PI/2;
                     dial.position.set(0.12, 1.5, 0.31);
                     cpdu.add(dial);

                     // 門上的高壓警示標誌
                     const warningGeo = new THREE.ConeGeometry(0.04, 0.08, 3);
                     const warningMat = new THREE.MeshBasicMaterial({color: 0xfbbf24});
                     const warningSign = new THREE.Mesh(warningGeo, warningMat);
                     warningSign.position.set(0, 1.8, 0.305);
                     warningSign.rotation.x = Math.PI;
                     warningSign.rotation.y = Math.PI;
                     cpdu.add(warningSign);

                     cpdu.position.set(xPos, 0, zPos);
                     const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.1, 0.6), new THREE.MeshBasicMaterial({visible:false}));
                     hit.position.y = 1.05;
                     hit.userData = { type: 'PDU', name: label };
                     cpdu.add(hit);
                     this.interactables.push(hit);
                     this.scene.add(cpdu);
                 };

                 createCleanPDU(-7.2, 4.0, 'PDU-A (UPS Output Distribution Panel)');
                 createCleanPDU(7.2, 4.0, 'PDU-B (UPS Output Distribution Panel)');

                 // 地面電纜溝 (Metallic-covered Underfloor Trench)
                 const createTrench = (xPos) => {
                     const trench = new THREE.Group();
                     // 電纜溝主體 (深灰色暗槽)
                     const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 10), new THREE.MeshStandardMaterial({color: 0x0a0f1d, roughness: 0.9}));
                     slot.rotation.x = -Math.PI/2;
                     slot.position.set(xPos, 0.015, 0);
                     trench.add(slot);

                     // 金屬網格蓋板 (Gratings) - 每隔 1m 鋪一塊
                     for(let i=0; i<10; i++) {
                         const cover = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.01, 0.9), this.materials.darkMetal);
                         cover.position.set(xPos, 0.02, -4.5 + i*1.0);
                         trench.add(cover);
                     }
                     this.scene.add(trench);
                 };
                 createTrench(-3.5);
                 createTrench(3.5);

                 // 建立電池直流開關箱 (Battery Circuit Breaker - BCB Box)
                 const createBCBBox = (xPos, zPos, name) => {
                     const bcb = new THREE.Group();
                     const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.18), this.materials.darkMetal);
                     box.position.y = 1.25; box.castShadow = true;
                     bcb.add(box);

                     // 紅色開關手柄
                     const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.03), new THREE.MeshStandardMaterial({color: 0xef4444, roughness: 0.3}));
                     handle.position.set(0.09, 1.25, 0);
                     handle.rotation.z = -0.3;
                     bcb.add(handle);

                     // 指示燈
                     const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), this.materials.greenLed);
                     led.position.set(0.06, 1.35, 0.06);
                     bcb.add(led);

                     bcb.position.set(xPos, 0, zPos);
                     
                     const hit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.18), new THREE.MeshBasicMaterial({visible:false}));
                     hit.position.y = 1.25;
                     hit.userData = { type: 'Battery', name: name + ' Disconnect Breaker (BCB)' };
                     bcb.add(hit);
                     this.interactables.push(hit);
                     this.scene.add(bcb);
                 };

                 // 在電池櫃群外側安裝 BCB 箱
                 createBCBBox(-7.5, -1.5, 'Feed-A1 String');
                 createBCBBox(-7.5, 2.0, 'Feed-A2 String');
                 createBCBBox(7.5, -1.5, 'Feed-B1 String');
                 createBCBBox(7.5, 2.0, 'Feed-B2 String');

                 // FM-200 消防高壓鋼瓶組 (Corner of the room)
                 const fmGroup = new THREE.Group();
                 for(let i=0; i<3; i++) {
                     const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12), new THREE.MeshStandardMaterial({color: 0xef4444, metalness: 0.5, roughness: 0.4}));
                     cylinder.position.set(-8.5 + i*0.4, 0.7, 5.0);
                     cylinder.castShadow = true;
                     fmGroup.add(cylinder);

                     // 瓶頭閥與壓力表
                     const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8), this.materials.aluminum);
                     valve.position.set(-8.5 + i*0.4, 1.45, 5.0);
                     fmGroup.add(valve);
                     
                     const gauge = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), this.materials.yellowGreen);
                     gauge.position.set(-8.5 + i*0.4, 1.5, 5.08);
                     fmGroup.add(gauge);
                 }
                 // 氣體主管路
                 const fmPipe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), this.materials.exhaustPipe);
                 fmPipe.position.set(-8.1, 1.55, 5.0);
                 fmGroup.add(fmPipe);
                 this.scene.add(fmGroup);

                 // 天花板氣體釋放噴頭 (Ceiling Gas Discharge Nozzles)
                 [[-4.0, 5.3, 0], [4.0, 5.3, 0]].forEach(p => {
                     const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.12, 10), this.materials.aluminum);
                     nozzle.position.set(p[0], p[1], p[2]);
                     this.scene.add(nozzle);
                 });

                 // 緊急出口安全發光指示燈 (Green Emergency Exit Sign)
                 const exitSign = new THREE.Group();
                 const signPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.04), new THREE.MeshStandardMaterial({color: 0x052e16, roughness: 0.5}));
                 signPlate.position.set(-9.45, 2.5, -4.0);
                 signPlate.rotation.y = Math.PI/2;
                 exitSign.add(signPlate);

                 const signLight = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.18), new THREE.MeshBasicMaterial({
                     color: 0x22c55e,
                     emissive: 0x22c55e,
                     emissiveIntensity: 1.5
                 }));
                 signLight.position.set(-9.428, 2.5, -4.0);
                 signLight.rotation.y = Math.PI/2;
                 exitSign.add(signLight);
                 this.scene.add(exitSign);`;

// Direct string replacement for MSB/PDU section
html = html.replace(oldPduBlock, newPduBlock);

// 3. Replace the Cables block (bi-directional flows, vertical drops, ATS input)
const oldCablesBlock = `                 // A排輸入電纜路徑 (從 MSB-A 頂部 -> 橫向架 -> 縱向架 -> UPS A-Feed)
                 const pathAPoints = [
                     new THREE.Vector3(-3.0, 2.2, -5.0),
                     new THREE.Vector3(-3.0, 3.44, -5.0),
                     new THREE.Vector3(-3.5, 3.46, -4.8),
                     new THREE.Vector3(-3.5, 3.46, 2.8)   // 延伸至 UPS-2 (z=2.0) 之後
                 ];
                 createPowerCables(pathAPoints, offsets);

                 // B排輸入電纜路徑 (從 MSB-B 頂部 -> 橫向架 -> 縱向架 -> UPS B-Feed)
                 const pathBPoints = [
                     new THREE.Vector3(3.0, 2.2, -5.0),
                     new THREE.Vector3(3.0, 3.44, -5.0),
                     new THREE.Vector3(3.5, 3.46, -4.8),
                     new THREE.Vector3(3.5, 3.46, 2.8)   // 延伸至 UPS-2 (z=2.0) 之後
                 ];
                 createPowerCables(pathBPoints, offsets);

                 // UPS-A 輸出電纜（每台 UPS 各一條，從底部出線往 MSB-A 出線端）
                 // UPS-A-1 (z=-1.5) 輸出
                 const pathA_out1 = [
                     new THREE.Vector3(-3.5, 0.15, -1.5),
                     new THREE.Vector3(-3.5, 0.15, -3.5),
                     new THREE.Vector3(-3.0, 0.15, -4.5),
                     new THREE.Vector3(-3.0, 0.15, -5.0)
                 ];
                 createPowerCables(pathA_out1, offsets, [0x1e3a8a]);

                 // UPS-A-2 (z=2.0) 輸出
                 const pathA_out2 = [
                     new THREE.Vector3(-3.5, 0.15, 2.0),
                     new THREE.Vector3(-3.5, 0.15, -0.5),
                     new THREE.Vector3(-3.0, 0.15, -4.5),
                     new THREE.Vector3(-3.0, 0.15, -5.0)
                 ];
                 createPowerCables(pathA_out2, offsets, [0x1e3a8a]);

                 // UPS-B 輸出電纜（Feed-B 同理）
                 const pathB_out1 = [
                     new THREE.Vector3(3.5, 0.15, -1.5),
                     new THREE.Vector3(3.5, 0.15, -3.5),
                     new THREE.Vector3(3.0, 0.15, -4.5),
                     new THREE.Vector3(3.0, 0.15, -5.0)
                 ];
                 createPowerCables(pathB_out1, offsets, [0x064e3b]);

                 const pathB_out2 = [
                     new THREE.Vector3(3.5, 0.15, 2.0),
                     new THREE.Vector3(3.5, 0.15, -0.5),
                     new THREE.Vector3(3.0, 0.15, -4.5),
                     new THREE.Vector3(3.0, 0.15, -5.0)
                 ];
                 createPowerCables(pathB_out2, offsets, [0x064e3b]);`;

const newCablesBlock = `                 // A排輸入電纜路徑 (從 MSB-A 頂部 -> 橫向架 -> 縱向架 -> UPS A-Feed-1/2 垂直落入)
                 const pathA_in1 = [
                     new THREE.Vector3(-3.0, 2.2, -5.0),
                     new THREE.Vector3(-3.0, 3.44, -5.0),
                     new THREE.Vector3(-3.5, 3.46, -4.8),
                     new THREE.Vector3(-3.5, 3.46, -1.5),
                     new THREE.Vector3(-3.5, 2.12, -1.5)
                 ];
                 const pathA_in2 = [
                     new THREE.Vector3(-3.0, 2.2, -5.0),
                     new THREE.Vector3(-3.0, 3.44, -5.0),
                     new THREE.Vector3(-3.5, 3.46, -4.8),
                     new THREE.Vector3(-3.5, 3.46, 2.0),
                     new THREE.Vector3(-3.5, 2.12, 2.0)
                 ];
                 createPowerCables(pathA_in1, offsets);
                 createPowerCables(pathA_in2, offsets);

                 // B排輸入電纜路徑 (從 MSB-B 頂部 -> 橫向架 -> 縱向架 -> UPS B-Feed-1/2 垂直落入)
                 const pathB_in1 = [
                     new THREE.Vector3(3.0, 2.2, -5.0),
                     new THREE.Vector3(3.0, 3.44, -5.0),
                     new THREE.Vector3(3.5, 3.46, -4.8),
                     new THREE.Vector3(3.5, 3.46, -1.5),
                     new THREE.Vector3(3.5, 2.12, -1.5)
                 ];
                 const pathB_in2 = [
                     new THREE.Vector3(3.0, 2.2, -5.0),
                     new THREE.Vector3(3.0, 3.44, -5.0),
                     new THREE.Vector3(3.5, 3.46, -4.8),
                     new THREE.Vector3(3.5, 3.46, 2.0),
                     new THREE.Vector3(3.5, 2.12, 2.0)
                 ];
                 createPowerCables(pathB_in1, offsets);
                 createPowerCables(pathB_in2, offsets);

                 // ATS 輸出至 MSB-A 輸入聯絡電纜 (Heavy busway/cable)
                 const pathATS_to_MSB = [
                     new THREE.Vector3(7.2, 1.5, -1.0),
                     new THREE.Vector3(7.2, 3.48, -1.0),
                     new THREE.Vector3(7.2, 3.48, -5.0),
                     new THREE.Vector3(-3.0, 3.48, -5.0),
                     new THREE.Vector3(-3.0, 2.2, -5.0)
                 ];
                 createPowerCables(pathATS_to_MSB, [
                     { x: -0.05, y: 0.04, z: 0 },
                     { x: 0, y: 0.04, z: 0 },
                     { x: 0.05, y: 0.04, z: 0 }
                 ], [0xb87333]); // 銅色

                 // UPS-A 輸出電纜（每台 UPS 各一條，沿地坪電纜溝敷設至 PDU-A 乾淨配電櫃）
                 // UPS-A-1 (z=-1.5) 輸出
                 const pathA_out1 = [
                     new THREE.Vector3(-3.5, 0.15, -1.5),
                     new THREE.Vector3(-3.5, 0.15, 3.5),
                     new THREE.Vector3(-7.2, 0.15, 3.5),
                     new THREE.Vector3(-7.2, 0.15, 4.0)
                 ];
                 createPowerCables(pathA_out1, offsets, [0x1e3a8a]);

                 // UPS-A-2 (z=2.0) 輸出
                 const pathA_out2 = [
                     new THREE.Vector3(-3.5, 0.15, 2.0),
                     new THREE.Vector3(-3.5, 0.15, 3.5),
                     new THREE.Vector3(-7.2, 0.15, 3.5),
                     new THREE.Vector3(-7.2, 0.15, 4.0)
                 ];
                 createPowerCables(pathA_out2, offsets, [0x1e3a8a]);

                 // UPS-B 輸出電纜（Feed-B 同理，敷設至 PDU-B）
                 const pathB_out1 = [
                     new THREE.Vector3(3.5, 0.15, -1.5),
                     new THREE.Vector3(3.5, 0.15, 3.5),
                     new THREE.Vector3(7.2, 0.15, 3.5),
                     new THREE.Vector3(7.2, 0.15, 4.0)
                 ];
                 createPowerCables(pathB_out1, offsets, [0x064e3b]);

                 const pathB_out2 = [
                     new THREE.Vector3(3.5, 0.15, 2.0),
                     new THREE.Vector3(3.5, 0.15, 3.5),
                     new THREE.Vector3(7.2, 0.15, 3.5),
                     new THREE.Vector3(7.2, 0.15, 4.0)
                 ];
                 createPowerCables(pathB_out2, offsets, [0x064e3b]);`;

// Direct string replacement for Cables section
html = html.replace(oldCablesBlock, newCablesBlock);

// 4. Upgrade Generator outdoor exhaust, rain cap, and add ATS hitbox
const oldGenExhaustBlock = `                 // 排氣煙囪（頂部，垂直）
                 const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 12), this.materials.exhaustPipe);
                 exhaust.position.set(genX + 1.2, 1.8 + 0.9, genZ);
                 genGroup.add(exhaust);

                 // 煙囪頂部風帽
                 const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.15, 12), this.materials.darkMetal);
                 cap.position.set(genX + 1.2, 1.8 + 1.9, genZ);
                 genGroup.add(cap);`;

const newGenExhaustBlock = `                 // 排氣煙囪（頂部，垂直）
                 const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 12), this.materials.exhaustPipe);
                 exhaust.position.set(genX + 1.2, 1.8 + 0.9, genZ);
                 genGroup.add(exhaust);

                 // 1. 避震波紋膨脹節 (Exhaust Bellows)
                 for(let i=0; i<4; i++) {
                     const bellowsRing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), this.materials.darkMetal);
                     bellowsRing.position.set(genX + 1.2, 1.8 + 0.1 + i*0.08, genZ);
                     genGroup.add(bellowsRing);
                 }

                 // 2. 不銹鋼隔熱防燙罩 (Shiny perforated Heat Shield)
                 const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 12), new THREE.MeshStandardMaterial({
                     color: 0xe2e8f0, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.45
                 }));
                 shield.position.set(genX + 1.2, 1.8 + 0.8, genZ);
                 genGroup.add(shield);

                 // 3. 煙囪頂部風帽及重力式防雨板 (Rain cap with hinged flap)
                 const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.15, 12), this.materials.darkMetal);
                 cap.position.set(genX + 1.2, 1.8 + 1.9, genZ);
                 genGroup.add(cap);

                 const flap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.24), this.materials.darkMetal);
                 flap.position.set(genX + 1.2 + 0.06, 1.8 + 1.98, genZ);
                 flap.rotation.z = 0.35; // 傾斜開啟狀態
                 genGroup.add(flap);`;

// Direct string replacement for Generator Exhaust section
html = html.replace(oldGenExhaustBlock, newGenExhaustBlock);

// 5. Add ATS interactive hitbox
const oldAtsBlock = `                 // ── 室內 ATS 面板 (Automatic Transfer Switch) x=7.2 ──
                 const atsPanel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.4), this.materials.cabinet);
                 atsPanel.position.set(7.2, 0.9, -1.0);
                 genGroup.add(atsPanel);`;

const newAtsBlock = `                 // ── 室內 ATS 面板 (Automatic Transfer Switch) x=7.2 ──
                 const atsPanel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.4), this.materials.cabinet);
                 atsPanel.position.set(7.2, 0.9, -1.0);
                 genGroup.add(atsPanel);

                 // ATS 互動 Hitbox
                 const atsHit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.4), new THREE.MeshBasicMaterial({visible:false}));
                 atsHit.position.set(7.2, 0.9, -1.0);
                 atsHit.userData = { type: 'Generator', name: 'ATS (Automatic Transfer Switch) Panel' };
                 genGroup.add(atsHit);
                 this.interactables.push(atsHit);`;

html = html.replace(oldAtsBlock, newAtsBlock);

fs.writeFileSync(filePath, html, 'utf8');
console.log('Successfully applied all 3D MEP refinements to public/grey_space.html!');
