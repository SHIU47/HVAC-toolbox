const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../public/whitespace/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Add call in init()
const targetInit = `                this.buildHotAisleContainment(); 
                this.buildDataCenter(); 
                this.buildPiping();
                // buildInstancedDetails 已移至 createRack 中處理`;

const replacementInit = `                this.buildHotAisleContainment(); 
                this.buildDataCenter(); 
                this.buildPiping();
                this.buildPowerBusways();
                // buildInstancedDetails 已移至 createRack 中處理`;

// 2. Add buildPowerBusways() definition
const targetDefinition = `                this.scene.add(this.pipeGroup);
            },`;

const replacementDefinition = `                this.scene.add(this.pipeGroup);
            },

            buildPowerBusways() {
                this.buswayGroup = new THREE.Group();
                const buswayMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 }); // Starline grey
                const boxMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 }); // Tap-off box dark grey
                const conduitMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }); // Black/Dark metallic flexible conduit
                const copperMat = this.materials.copperDetail || new THREE.MeshStandardMaterial({ color: 0xc47e4a, metalness: 0.95 });

                const buswayY = 3.25;
                const buswayW = 0.08;
                const buswayH = 0.14;
                const buswayLength = 3.8; // Cover the rack rows
                const zA = -1.45;
                const zB = 1.45;

                // Busway A (Row A - Cold Aisle Side / Outside Containment Wall)
                const buswayA = new THREE.Mesh(new THREE.BoxGeometry(buswayLength, buswayH, buswayW), buswayMat);
                buswayA.position.set(0, buswayY, zA);
                this.buswayGroup.add(buswayA);

                // Busway B (Row B - Cold Aisle Side / Outside Containment Wall)
                const buswayB = new THREE.Mesh(new THREE.BoxGeometry(buswayLength, buswayH, buswayW), buswayMat);
                buswayB.position.set(0, buswayY, zB);
                this.buswayGroup.add(buswayB);

                // Hangers for the busways (threaded rods from ceiling)
                const ceilingY = 4.0;
                const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, ceilingY - buswayY, 8);
                const hangerMat = this.materials.aluminum || new THREE.MeshStandardMaterial({ color: 0x94a3b8 });

                for (let hx = -1.6; hx <= 1.6; hx += 0.8) {
                    const rodA = new THREE.Mesh(rodGeo, hangerMat);
                    rodA.position.set(hx, buswayY + (ceilingY - buswayY) / 2, zA);
                    this.buswayGroup.add(rodA);

                    const rodB = new THREE.Mesh(rodGeo, hangerMat);
                    rodB.position.set(hx, buswayY + (ceilingY - buswayY) / 2, zB);
                    this.buswayGroup.add(rodB);
                }

                // Tap-Off Boxes and Vertical Drops above each cabinet position
                const xs = [-1.24, -0.62, 0, 0.62, 1.24];
                xs.forEach(x => {
                    // Tap-off Box A
                    const boxA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), boxMat);
                    boxA.position.set(x, buswayY - 0.07, zA);
                    this.buswayGroup.add(boxA);

                    // Vertical flexible conduit drop into Row A Cabinet (World Z = -1.2, top cover at Y = 2.0, connector at Z = -1.2 - 0.2 = -1.4)
                    // The conduit curves from zA = -1.45 to cabinet input at Z = -1.4
                    const startA = new THREE.Vector3(x, buswayY - 0.13, zA);
                    const endA = new THREE.Vector3(x, 2.02, -1.4); // Drop to top of rack (local Z -0.2 is World Z -1.4)
                    const controlA = new THREE.Vector3(x, 2.6, zA - 0.05);
                    
                    const curveA = new THREE.QuadraticBezierCurve3(startA, controlA, endA);
                    const pointsA = curveA.getPoints(12);
                    const conduitGeoA = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pointsA), 8, 0.012, 8, false);
                    const conduitA = new THREE.Mesh(conduitGeoA, conduitMat);
                    this.buswayGroup.add(conduitA);

                    // Tap-off Box B
                    const boxB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), boxMat);
                    boxB.position.set(x, buswayY - 0.07, zB);
                    this.buswayGroup.add(boxB);

                    // Vertical flexible conduit drop into Row B Cabinet (World Z = 1.2, top cover at Y = 2.0, connector at Z = 1.2 + 0.2 = 1.4)
                    const startB = new THREE.Vector3(x, buswayY - 0.13, zB);
                    const endB = new THREE.Vector3(x, 2.02, 1.4); // Drop to top of rack (local Z +0.2 is World Z 1.4)
                    const controlB = new THREE.Vector3(x, 2.6, zB + 0.05);

                    const curveB = new THREE.QuadraticBezierCurve3(startB, controlB, endB);
                    const pointsB = curveB.getPoints(12);
                    const conduitGeoB = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pointsB), 8, 0.012, 8, false);
                    const conduitB = new THREE.Mesh(conduitGeoB, conduitMat);
                    this.buswayGroup.add(conduitB);
                });

                this.scene.add(this.buswayGroup);
            },`;

let matches = 0;
if (content.includes(targetInit)) {
    content = content.replace(targetInit, replacementInit);
    matches++;
} else {
    console.error("targetInit not found!");
}

if (content.includes(targetDefinition)) {
    // Note: since targetDefinition is very generic (this.scene.add(this.pipeGroup); \n }), let's make sure it matches the one in buildPiping.
    // The buildPiping end is around line 2440. We can replace it.
    content = content.replace(targetDefinition, replacementDefinition);
    matches++;
} else {
    console.error("targetDefinition not found!");
}

if (matches === 2) {
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log("Successfully added buildPowerBusways to app.js!");
} else {
    console.error(`Failed to apply busways patches. Match count: ${matches}`);
}
