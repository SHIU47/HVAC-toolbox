Created At: 2026-06-04T13:05:59Z
Completed At: 2026-06-04T13:05:59Z
File Path: `file:///c:/Users/user/OneDrive/%E6%A1%8C%E9%9D%A2/HVAC-Pro/public/whitespace/app.js`
Total Lines: 2579
Total Bytes: 142856
Showing lines 1601 to 2400
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
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
                    this.material
<truncated 45281 bytes>
                    
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
            
<truncated 339 bytes>

NOTE: The output was truncated because it was too long. Use a more targeted query or a smaller range to get the information you need.