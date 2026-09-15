Created At: 2026-06-04T13:05:59Z
Completed At: 2026-06-04T13:05:59Z
File Path: `file:///c:/Users/user/OneDrive/%E6%A1%8C%E9%9D%A2/HVAC-Pro/public/whitespace/app.js`
Total Lines: 2579
Total Bytes: 142856
Showing lines 1601 to 2400
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1601:                         blade.rotation.x = 0.2; // 葉片傾角
1602:                         fanObj.add(blade);
1603:                     }
1604:                     const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.02, 16), ironMat);
1605:                     fanObj.add(hub);
1606:                     fanObj.position.set(fx, h / 2 + 0.03, 0);
1607:                     group.add(fanObj);
1608:                 });
1609: 
1610:                 // ==========================================
1611:                 // 7. 互動判定框 (HitBox)
1612:                 // ==========================================
1613:                 const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
1614:                 hitBox.userData = group.userData;
1615:                 group.add(hitBox);
1616:                 this.interactables.push(hitBox);
1617: 
1618:                 this.scene.add(group);
1619:             },
1620:             createRack(x, y, z, rot, name) {
1621:                 const w = 0.6, h = 2.0, d = 1.2;
1622:                 const group = new THREE.Group();
1623:                 group.position.set(x, h / 2, z);
1624:                 group.rotation.y = rot;
1625:                 group.userData = { type: 'Rack', name: name };
1626: 
1627:                 if (!this.materials.copperDetail) {
1628:                     this.materials.copperDetail = new THREE.MeshStandardMaterial({ color: 0xa89f9b, metalness: 0.95, roughness: 0.15 });
1629:                     this.material
<truncated 45281 bytes>
2364:                     
2365:                     if(data.type === 'Rack') {
2366:                         const isRowA = targetPos.z < 0; 
2367:                         const frontZ = isRowA ? targetPos.z + 0.7 : targetPos.z - 0.7;
2368:                         this.tweenCamera(
2369:                             new THREE.Vector3(targetPos.x + 0.25, 1.05, frontZ),
2370:                             new THREE.Vector3(targetPos.x, 1.0, targetPos.z)
2371:                         );
2372:                     } else if(data.type === 'CDU') {
2373:                         this.tweenCamera(
2374:                             new THREE.Vector3(targetPos.x + 1.2, 1.2, targetPos.z + 1.5),
2375:                             new THREE.Vector3(targetPos.x, 0.9, targetPos.z)
2376:                         );
2377:                     }
2378:                     */
2379:                 }
2380:             },
2381: 
2382:             showDetail(data) {
2383:                 document.getElementById('hud-detail').classList.add('active');
2384:                 document.getElementById('detail-title').innerText = data.name;
2385:                 
2386:                 document.getElementById('detail-content-rack').style.display = data.type === 'Rack' ? 'block' : 'none';
2387:                 document.getElementById('detail-content-cdu').style.display = data.type === 'CDU' ? 'block' : 'none';
2388:                 
2389:                 if(data.type === 'Rack') document.getElementById('detail-subtitle').innerText = 'GB200 NVL72 RACK';
2390:                 if(data.type === 'CDU') document.getElementById('detail-subtitle').innerText = 'IN-ROW CDU 800kW';
2391: 
2392:                 if (window.innerWidth <= 768 && this.leftHudVisible) {
2393:                     this.leftHudVisible = false;
2394:                     this.updateHudState();
2395:                 }
2396:             
<truncated 339 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.