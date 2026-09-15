(function() {
    window.capturedScene = null;
    const origAdd = THREE.Scene.prototype.add;
    THREE.Scene.prototype.add = function(...args) {
        if (!window.capturedScene) {
            window.capturedScene = this;
        }
        return origAdd.apply(this, args);
    };

    setTimeout(() => {
        if (!window.capturedScene) {
            console.error("Hotfix failed: Could not capture scene.");
            return;
        }
        const scene = window.capturedScene;
        
        // 1. Remove old pipe groups
        const groupsToRemove = [];
        scene.traverse(child => {
            if (child.type === 'Group') {
                let pipeCount = 0;
                let otherCount = 0;
                child.children.forEach(c => {
                    if (c.type === 'Mesh' && (c.geometry.type === 'CylinderGeometry' || c.geometry.type === 'SphereGeometry')) {
                        pipeCount++;
                    } else {
                        otherCount++;
                    }
                });
                // Our pipe groups have LOTS of pipes and elbows, and NOTHING else.
                if (pipeCount > 10 && otherCount === 0) {
                    groupsToRemove.push(child);
                }
            }
        });

        groupsToRemove.forEach(g => scene.remove(g));
        console.log("Hotfix: Removed", groupsToRemove.length, "old pipe groups.");

        // 2. Re-create materials
        const matCHWS = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, metalness: 0.1 });
        const matCHWR = new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.4, metalness: 0.1 });
        const matCWS = new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.4, metalness: 0.1 });
        const matCWR = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4, metalness: 0.1 });
        const flangeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.5 });

        // 3. Draw Orthogonal Pipe function
        const drawOrthogonalPipe = (pathPoints, mat, radius = 0.12) => {
            const group = new THREE.Group();
            for(let i = 0; i < pathPoints.length - 1; i++) {
                const start = new THREE.Vector3(...pathPoints[i]);
                const end = new THREE.Vector3(...pathPoints[i+1]);
                const len = start.distanceTo(end);
                if(len < 0.01) continue;

                const geom = new THREE.CylinderGeometry(radius, radius, len, 16);
                const pipe = new THREE.Mesh(geom, mat);
                pipe.position.copy(start).add(end).multiplyScalar(0.5);
                pipe.lookAt(end);
                pipe.rotateX(Math.PI/2);
                pipe.castShadow = true;
                group.add(pipe);

                // Flanges
                const flangeGeom = new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, 0.04, 16);
                const flange1 = new THREE.Mesh(flangeGeom, flangeMat);
                flange1.position.copy(start); flange1.lookAt(end); flange1.rotateX(Math.PI/2);
                group.add(flange1);

                const flange2 = new THREE.Mesh(flangeGeom, flangeMat);
                flange2.position.copy(end); flange2.lookAt(start); flange2.rotateX(Math.PI/2);
                group.add(flange2);

                // Elbows (except at ends)
                if (i > 0) {
                    const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.2, 16, 16), mat);
                    elbow.position.copy(start);
                    group.add(elbow);
                }
            }
            scene.add(group);
        };

        // 4. Draw NEW Pipes!

        // === CH-01 (x = -1.5, z = 1.0) ===
        // Evaporator (Top Nozzles on LEFT side): x=-2.76, y=1.35
        drawOrthogonalPipe([[-3.5, 3.8, 1.45], [-3.5, 1.35, 1.45], [-2.76, 1.35, 1.45]], matCHWS); // CHWS In
        drawOrthogonalPipe([[-3.5, 3.8, 1.15], [-3.5, 1.35, 1.15], [-2.76, 1.35, 1.15]], matCHWR); // CHWR Out

        // Condenser (Top Nozzles pointing UP): x=-2.4, y=1.65
        drawOrthogonalPipe([[-2.4, 4.4, 0.85], [-2.4, 1.65, 0.85]], matCWS); // CWS In
        drawOrthogonalPipe([[-2.4, 4.4, 0.55], [-2.4, 1.65, 0.55]], matCWR); // CWR Out

        // === CH-02 (x = 4.0, z = 1.0) ===
        // Evaporator (Top Nozzles on RIGHT side): x=5.26, y=1.35
        drawOrthogonalPipe([[6.0, 3.8, 1.45], [6.0, 1.35, 1.45], [5.26, 1.35, 1.45]], matCHWS); // CHWS In
        drawOrthogonalPipe([[6.0, 3.8, 1.15], [6.0, 1.35, 1.15], [5.26, 1.35, 1.15]], matCHWR); // CHWR Out

        // Condenser (Top Nozzles pointing UP): x=4.9, y=1.65
        drawOrthogonalPipe([[4.9, 4.4, 0.85], [4.9, 1.65, 0.85]], matCWS); // CWS In
        drawOrthogonalPipe([[4.9, 4.4, 0.55], [4.9, 1.65, 0.55]], matCWR); // CWR Out

        // === Headers to CH-01 & CH-02 (Manifolds) ===
        // CHWS (Blue)
        drawOrthogonalPipe([[-3.5, 3.8, 1.45], [-3.5, 3.8, -11.0], [6.0, 3.8, -11.0], [6.0, 3.8, 1.45]], matCHWS);
        // CHWR (Red)
        drawOrthogonalPipe([[-3.5, 3.8, 1.15], [-3.5, 3.8, -11.5], [6.0, 3.8, -11.5], [6.0, 3.8, 1.15]], matCHWR);
        
        // CWR (Green, high level)
        drawOrthogonalPipe([[-2.4, 4.4, 0.55], [-2.4, 4.4, -13.0]], matCWR);
        drawOrthogonalPipe([[4.9, 4.4, 0.55], [4.9, 4.4, -13.0]], matCWR);
        drawOrthogonalPipe([[-2.4, 4.4, -13.0], [4.9, 4.4, -13.0]], matCWR); // Header

        // CWS (Light Green, high level)
        drawOrthogonalPipe([[-2.4, 4.4, 0.85], [-2.4, 4.4, -12.5]], matCWS);
        drawOrthogonalPipe([[4.9, 4.4, 0.85], [4.9, 4.4, -12.5]], matCWS);
        drawOrthogonalPipe([[-2.4, 4.4, -12.5], [4.9, 4.4, -12.5]], matCWS); // Header


        // === Cooling Towers (Roof) ===
        // CT-01 (x = -3.0). Valves at x = -1.2
        drawOrthogonalPipe([[-0.5, 5.8, -13.0], [-0.5, 5.8, -17.5], [-0.5, 10.6, -17.5], [-1.2, 10.6, -17.5]], matCWR);
        drawOrthogonalPipe([[-1.2, 8.4, -17.5], [-0.5, 8.4, -17.5], [-0.5, 5.0, -17.5], [-0.5, 5.0, -13.0]], matCWS);
        
        // CT-02 (x = 3.0). Valves at x = 4.8
        drawOrthogonalPipe([[5.5, 5.8, -13.0], [5.5, 5.8, -17.5], [5.5, 10.6, -17.5], [4.8, 10.6, -17.5]], matCWR);
        drawOrthogonalPipe([[4.8, 8.4, -17.5], [5.5, 8.4, -17.5], [5.5, 5.0, -17.5], [5.5, 5.0, -13.0]], matCWS);

        // CT Headers
        drawOrthogonalPipe([[-0.5, 5.8, -13.0], [5.5, 5.8, -13.0]], matCWR); // CT CWR Header
        drawOrthogonalPipe([[-0.5, 5.0, -13.0], [5.5, 5.0, -13.0]], matCWS); // CT CWS Header


        // === Pumps (CHWP and CWP) ===
        // Pumps are at z = -7.0
        // CHWP: px = -6.5, -5.0, -3.5
        // CWP: px = 1.5, 3.0, 4.5
        
        // CHWP (Ice water pumps)
        [-6.5, -5.0, -3.5].forEach(px => {
            // Suction (CHWR from Headers/PHX) -> goes to pump z=-6.5
            drawOrthogonalPipe([[px, 0.58, -11.5], [px, 0.58, -6.5]], matCHWR); 
            // Discharge (CHWS to Headers) -> goes from pump z=-6.7
            drawOrthogonalPipe([[px, 0.58, -6.7], [px, 4.4, -6.7], [px, 4.4, -11.0]], matCHWS); 
        });
        
        // CWP (Cooling water pumps)
        [1.5, 3.0, 4.5].forEach(px => {
            // Suction (CWS from CT Headers) -> goes to pump z=-6.5
            drawOrthogonalPipe([[px, 5.0, -13.0], [px, 0.58, -13.0], [px, 0.58, -6.5]], matCWS);
            // Discharge (CWR to Chiller Headers) -> goes from pump z=-6.7
            drawOrthogonalPipe([[px, 0.58, -6.7], [px, 3.2, -6.7], [px, 3.2, -13.0]], matCWR); 
        });
        
        // CHWP Discharge Header (to Chillers & PHX)
        drawOrthogonalPipe([[-6.5, 4.4, -11.0], [-3.5, 4.4, -11.0]], matCHWS);
        // CWP Discharge Header (to Chillers)
        drawOrthogonalPipe([[1.5, 3.2, -13.0], [4.9, 3.2, -13.0]], matCWR);
        // Connect CWP discharge header to the Condenser headers (y=4.4)
        drawOrthogonalPipe([[4.9, 3.2, -13.0], [4.9, 4.4, -13.0]], matCWR);

        // === PHX (x=-9.0, z=-15.0) ===
        // CHWS In (z=-14.85, y=0.5): from CHWS Header (y=3.8)
        drawOrthogonalPipe([[-9.0, 3.8, -11.0], [-9.0, 3.8, -14.85], [-9.0, 0.5, -14.85]], matCHWS);
        // CHWR Out (z=-14.55, y=0.5): to CHWR Header
        drawOrthogonalPipe([[-9.0, 0.5, -14.55], [-9.0, 1.5, -14.55], [-8.0, 1.5, -14.55], [-8.0, 3.8, -14.55], [-8.0, 3.8, -11.5]], matCHWR);
        // CWS Out (z=-15.15, y=0.5): to CWS Header (y=5.0)
        drawOrthogonalPipe([[-9.0, 0.5, -15.15], [-9.0, 5.0, -15.15], [-9.0, 5.0, -13.0]], matCWS);
        // CWR In (z=-15.45, y=0.5): from CWR Header (y=5.8)
        drawOrthogonalPipe([[-9.0, 5.8, -13.0], [-9.0, 5.8, -15.45], [-9.0, 0.5, -15.45]], matCWR);

        console.log("Hotfix: Drawn new pipes!");
    }, 2000);
})();
