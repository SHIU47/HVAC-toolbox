const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'code_artifact.html');
let s = fs.readFileSync(file, 'utf8');

// 1. Fix createFlowMat
let flowMatStart = s.indexOf(`                const createFlowMat = (colorHex) => {`);
let flowMatEnd = s.indexOf(`                };`, flowMatStart) + 18;

const newFlowMat = `                const createFlowMat = (colorHex) => {
                    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 256;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = colorHex; ctx.fillRect(0,0,64,256);
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.beginPath();
                    // Draw arrow pointing UP (towards y=0)
                    ctx.moveTo(32, 20);
                    ctx.lineTo(60, 100);
                    ctx.lineTo(40, 100);
                    ctx.lineTo(40, 220);
                    ctx.lineTo(24, 220);
                    ctx.lineTo(24, 100);
                    ctx.lineTo(4, 100);
                    ctx.fill();
                    
                    const tex = new THREE.CanvasTexture(canvas);
                    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                    const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.35 });
                    mat.solidMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.4, roughness: 0.35 });
                    mat.isFlowMat = true;
                    // We don't push the template mat to pipeMaterials, only the cloned ones.
                    return mat;
                };`;

if (flowMatStart !== -1 && flowMatEnd !== -1) {
    s = s.substring(0, flowMatStart) + newFlowMat + s.substring(flowMatEnd);
    console.log('✅ createFlowMat updated');
} else {
    console.error('❌ createFlowMat not found');
}

// 2. Fix drawOrthogonalPipe
let drawPipeStart = s.indexOf(`                const drawOrthogonalPipe = (pathPoints, mat, radius = 0.12) => {`);
let drawPipeEnd = s.indexOf(`                // ============================================================================`, drawPipeStart + 100);

const newDrawPipe = `                const drawOrthogonalPipe = (pathPoints, mat, radius = 0.12) => {
                    const group = new THREE.Group();
                    
                    // 繪製直管段
                    for(let i = 0; i < pathPoints.length - 1; i++) {
                        const start = new THREE.Vector3(...pathPoints[i]);
                        const end = new THREE.Vector3(...pathPoints[i+1]);
                        const len = start.distanceTo(end);
                        if(len < 0.01) continue;

                        let useMat = mat;
                        if (mat.isFlowMat) {
                            useMat = mat.clone();
                            useMat.map = mat.map.clone();
                            // Adjust repeat based on length to prevent stretching. Arrow points along Y.
                            useMat.map.repeat.set(1, len * 1.5);
                            this.pipeMaterials.push(useMat);
                        }

                        const geom = new THREE.CylinderGeometry(radius, radius, len, 16);
                        const pipe = new THREE.Mesh(geom, useMat);
                        pipe.position.copy(start).add(end).multiplyScalar(0.5);
                        pipe.lookAt(end);
                        pipe.rotateX(Math.PI/2);
                        pipe.castShadow = true;
                        group.add(pipe);
                    }

                    // 彎管球形接頭 (Smooth Elbow Joints at bends)
                    for(let i = 1; i < pathPoints.length - 1; i++) {
                        const pt = new THREE.Vector3(...pathPoints[i]);
                        // Use solid color for elbows so texture doesn't stretch weirdly on spheres
                        const elbow = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 12, 12), mat.solidMat || mat);
                        elbow.position.copy(pt); elbow.castShadow = true;
                        group.add(elbow);
                    }

                    // 起終點法蘭 (Endpoint Flanges Only)
                    if(pathPoints.length >= 2) {
                        const fG = new THREE.CylinderGeometry(radius * 1.4, radius * 1.4, 0.035, 16);
                        const sp = new THREE.Vector3(...pathPoints[0]);
                        const sn = new THREE.Vector3(...pathPoints[1]);
                        const ep = new THREE.Vector3(...pathPoints[pathPoints.length-1]);
                        const epv = new THREE.Vector3(...pathPoints[pathPoints.length-2]);
                        
                        const f1 = new THREE.Mesh(fG, this.materials.aluminum);
                        f1.position.copy(sp); f1.lookAt(sn); f1.rotateX(Math.PI/2); group.add(f1);
                        
                        const f2 = new THREE.Mesh(fG, this.materials.aluminum);
                        f2.position.copy(ep); f2.lookAt(epv); f2.rotateX(Math.PI/2); group.add(f2);
                    }

                    this.scene.add(group);
                };
`;

if (drawPipeStart !== -1 && drawPipeEnd !== -1) {
    s = s.substring(0, drawPipeStart) + newDrawPipe + s.substring(drawPipeEnd);
    console.log('✅ drawOrthogonalPipe updated');
} else {
    console.error('❌ drawOrthogonalPipe not found');
}


// 3. Fix animate()
let animateStr = `mat.map.offset.x -= delta * 0.5;`;
if (s.includes(animateStr)) {
    // We reverse the animation direction (+=) because y=0 is the TOP of the texture (arrow tip). 
    // Wait, if texture offset moves negative, the texture moves UP, so arrows flow UP.
    s = s.replace(animateStr, `mat.map.offset.y -= delta * 0.5;`);
    console.log('✅ animate updated offset.y');
} else {
    console.error('❌ animate offset not found');
}

fs.writeFileSync(file, s, 'utf8');
console.log('✅ DONE!');
