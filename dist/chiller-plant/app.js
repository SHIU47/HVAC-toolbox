const APP = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  clock: new THREE.Clock(),
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  interactables: [],
  materials: {},
  textures: {},
  pipeMaterials: [],
  leftHudVisible: window.innerWidth > 768,
  simPanelOpen: false,
  utilityLoss: false,
  flowOffset: 0,
  coupledLoad: 1200,
  coolingTowerFans: [],
  freeCoolingActive: false,
  init() {
    const _0x100d16 = document.getElementById("canvas-container");
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(527380);
    this.scene.fog = new THREE.FogExp2(527380, 0.015);
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(12, 10, 14);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    _0x100d16.appendChild(this.renderer.domElement);
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
    this.controls.target.set(0, 1.5, -1);
    this.createMaterials();
    this.setupLighting();
    this.buildEnvironment();
    this.buildPlant();
    window.addEventListener("resize", () => this.resize());
    _0x100d16.addEventListener("mousemove", _0x5770e1 => this.onMouseMove(_0x5770e1));
    _0x100d16.addEventListener("click", _0x40e379 => this.onClick(_0x40e379));
    this.animate();
    setInterval(this.updateLiveValues, 1500);
    this.calculateChiller();
    this.updateHudState();
  },
  createMaterials() {
    this.materials.floor = new THREE.MeshStandardMaterial({
      color: 132104,
      metalness: 0.3,
      roughness: 0.7
    });
    this.materials.chillerBody = new THREE.MeshStandardMaterial({
      color: 9741240,
      metalness: 0.7,
      roughness: 0.25
    });
    this.materials.compressor = new THREE.MeshStandardMaterial({
      color: 4674921,
      metalness: 0.8,
      roughness: 0.4
    });
    this.materials.pumpMotor = new THREE.MeshStandardMaterial({
      color: 1981066,
      metalness: 0.6,
      roughness: 0.35
    });
    this.materials.ironPump = new THREE.MeshStandardMaterial({
      color: 1976635,
      metalness: 0.85,
      roughness: 0.5
    });
    this.materials.controlPanel = new THREE.MeshStandardMaterial({
      color: 988970,
      roughness: 0.75
    });
    this.materials.hxPlate = new THREE.MeshStandardMaterial({
      color: 6583435,
      metalness: 0.7,
      roughness: 0.4
    });
    this.materials.aluminum = new THREE.MeshStandardMaterial({
      color: 13358561,
      metalness: 0.7,
      roughness: 0.4
    });
    this.materials.copper = new THREE.MeshStandardMaterial({
      color: 12088115,
      metalness: 0.95,
      roughness: 0.2
    });
    this.materials.darkMetal = new THREE.MeshStandardMaterial({
      color: 988970,
      metalness: 0.85,
      roughness: 0.35
    });
    const _0x21fb3b = document.createElement("canvas");
    _0x21fb3b.width = 512;
    _0x21fb3b.height = 256;
    const _0x413b76 = _0x21fb3b.getContext("2d");
    _0x413b76.fillStyle = "#010c1a";
    _0x413b76.fillRect(0, 0, 512, 256);
    _0x413b76.fillStyle = "#0c2d48";
    _0x413b76.fillRect(0, 0, 512, 42);
    _0x413b76.fillStyle = "#38bdf8";
    _0x413b76.font = "bold 20px monospace";
    _0x413b76.fillText("● CHILLER CONTROL UNIT v4.1", 14, 28);
    _0x413b76.fillStyle = "#38bdf8";
    _0x413b76.font = "bold 30px monospace";
    _0x413b76.fillText("CHWS: 12.0°C   CHWR: 18.0°C", 20, 90);
    _0x413b76.fillStyle = "#22c55e";
    _0x413b76.fillText("CWS:  28.5°C   CWR: 34.0°C", 20, 135);
    _0x413b76.fillStyle = "#e2e8f0";
    _0x413b76.font = "20px monospace";
    _0x413b76.fillText("COP: 6.20   LOAD: 75.5%", 20, 180);
    _0x413b76.fillStyle = "#22c55e";
    _0x413b76.font = "bold 18px monospace";
    _0x413b76.fillText("● COMPRESSOR RUNNING — AUTO MODE", 20, 225);
    this.textures.chillerScreen = new THREE.CanvasTexture(_0x21fb3b);
    const _0x51a1d8 = _0x5ba72d => {
      const _0x27828d = document.createElement("canvas");
      _0x27828d.width = 64;
      _0x27828d.height = 256;
      const _0xbb3dc6 = _0x27828d.getContext("2d");
      _0xbb3dc6.fillStyle = _0x5ba72d;
      _0xbb3dc6.fillRect(0, 0, 64, 256);
      _0xbb3dc6.fillStyle = "rgba(255,255,255,0.4)";
      _0xbb3dc6.beginPath();
      _0xbb3dc6.moveTo(32, 20);
      _0xbb3dc6.lineTo(60, 100);
      _0xbb3dc6.lineTo(40, 100);
      _0xbb3dc6.lineTo(40, 220);
      _0xbb3dc6.lineTo(24, 220);
      _0xbb3dc6.lineTo(24, 100);
      _0xbb3dc6.lineTo(4, 100);
      _0xbb3dc6.fill();
      const _0x1561d8 = new THREE.CanvasTexture(_0x27828d);
      _0x1561d8.wrapS = _0x1561d8.wrapT = THREE.RepeatWrapping;
      const _0x13ba0f = new THREE.MeshStandardMaterial({
        map: _0x1561d8,
        metalness: 0.4,
        roughness: 0.35
      });
      _0x13ba0f.solidMat = new THREE.MeshStandardMaterial({
        color: _0x5ba72d,
        metalness: 0.4,
        roughness: 0.35
      });
      _0x13ba0f.isFlowMat = true;
      return _0x13ba0f;
    };
    this.materials.pipeCHWS = _0x51a1d8("#0ea5e9");
    this.materials.pipeCHWR = _0x51a1d8("#ef4444");
    this.materials.pipeCWS = _0x51a1d8("#22c55e");
    this.materials.pipeCWR = _0x51a1d8("#064e3b");
  },
  setupLighting() {
    this.scene.add(new THREE.AmbientLight(4871528, 2));
    const _0x45cc39 = new THREE.DirectionalLight(16777215, 1.2);
    _0x45cc39.position.set(8, 12, 5);
    _0x45cc39.castShadow = true;
    _0x45cc39.shadow.mapSize.set(2048, 2048);
    _0x45cc39.shadow.camera.left = -16;
    _0x45cc39.shadow.camera.right = 16;
    _0x45cc39.shadow.camera.top = 16;
    _0x45cc39.shadow.camera.bottom = -16;
    _0x45cc39.shadow.bias = -0.001;
    this.scene.add(_0x45cc39);
    const _0x233078 = new THREE.DirectionalLight(16777215, 0.6);
    _0x233078.position.set(-8, 8, -5);
    this.scene.add(_0x233078);
    const _0x2c425c = new THREE.SpotLight(16777215, 2, 18, 0.5, 0.5, 1.2);
    _0x2c425c.position.set(-3.5, 5.5, 5);
    _0x2c425c.target.position.set(-3.5, 1, 2);
    this.scene.add(_0x2c425c);
    this.scene.add(_0x2c425c.target);
    const _0x217b3b = new THREE.SpotLight(16777215, 2, 18, 0.5, 0.5, 1.2);
    _0x217b3b.position.set(2.5, 5.5, 5);
    _0x217b3b.target.position.set(2.5, 1, 2);
    this.scene.add(_0x217b3b);
    this.scene.add(_0x217b3b.target);
    const _0x9dc74e = new THREE.SpotLight(16777215, 1.5, 14, 0.55, 0.6, 1.5);
    _0x9dc74e.position.set(-1, 5.5, 1);
    _0x9dc74e.target.position.set(-1, 0.5, -1);
    this.scene.add(_0x9dc74e);
    this.scene.add(_0x9dc74e.target);
    const _0x57377a = new THREE.PointLight(3718648, 1, 4);
    _0x57377a.position.set(-3.5, 1.6, 3);
    this.scene.add(_0x57377a);
    const _0x4623d3 = new THREE.PointLight(3718648, 1, 4);
    _0x4623d3.position.set(2.5, 1.6, 3);
    this.scene.add(_0x4623d3);
  },
  buildEnvironment() {
    const _0x5cd5ec = new THREE.Mesh(new THREE.PlaneGeometry(38, 46), new THREE.MeshStandardMaterial({
      color: 132104,
      metalness: 0.3,
      roughness: 0.7
    }));
    _0x5cd5ec.rotation.x = -Math.PI / 2;
    _0x5cd5ec.receiveShadow = true;
    this.scene.add(_0x5cd5ec);
    const _0x3e8b40 = new THREE.MeshBasicMaterial({
      color: 959977,
      transparent: true,
      opacity: 0.35
    });
    const _0x11444b = new THREE.Mesh(new THREE.PlaneGeometry(28, 0.4), _0x3e8b40);
    _0x11444b.rotation.x = -Math.PI / 2;
    _0x11444b.position.set(-1, 0.01, -2);
    this.scene.add(_0x11444b);
    const _0x5cfad1 = new THREE.Mesh(new THREE.PlaneGeometry(38, 26), new THREE.MeshStandardMaterial({
      color: 1976635,
      roughness: 0.9
    }));
    _0x5cfad1.rotation.x = Math.PI / 2;
    _0x5cfad1.position.set(0, 5.5, 2);
    this.scene.add(_0x5cfad1);
    const _0x3e36ba = new THREE.MeshStandardMaterial({
      color: 16777215,
      emissive: 16777215,
      emissiveIntensity: 0.9
    });
    [[-4, 5.45, 0], [0, 5.45, 0], [4, 5.45, 0], [0, 5.45, -4]].forEach(_0x31913c => {
      const _0x32e85f = new THREE.Mesh(new THREE.BoxGeometry(2, 0.04, 0.18), _0x3e36ba);
      _0x32e85f.position.set(_0x31913c[0], _0x31913c[1], _0x31913c[2]);
      this.scene.add(_0x32e85f);
      const _0x13fabf = new THREE.PointLight(16777215, 1, 8);
      _0x13fabf.position.set(_0x31913c[0], _0x31913c[1] - 0.1, _0x31913c[2]);
      this.scene.add(_0x13fabf);
    });
    const _0x1b2972 = new THREE.Mesh(new THREE.PlaneGeometry(38, 5.5), new THREE.MeshStandardMaterial({
      color: 1976635,
      transparent: true,
      opacity: 0.55,
      roughness: 0.9,
      side: THREE.DoubleSide
    }));
    _0x1b2972.position.set(0, 2.75, -13);
    this.scene.add(_0x1b2972);
    const _0x5c0b2a = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.08), new THREE.MeshStandardMaterial({
      color: 988970,
      roughness: 0.9
    }));
    _0x5c0b2a.position.set(0.75, 1, -13);
    this.scene.add(_0x5c0b2a);
  },
  buildPlant() {
    const nozzleAnchors = {};
    this.nozzleAnchors = nozzleAnchors;
    const registerNozzleAnchor = (equipmentId, nozzleName, group, position, direction) => {
      const anchor = new THREE.Object3D();
      anchor.name = equipmentId + "." + nozzleName;
      anchor.position.set(position[0], position[1], position[2]);
      anchor.userData = {
        equipmentId,
        nozzleName,
        nozzleDirection: new THREE.Vector3(direction[0], direction[1], direction[2]).normalize()
      };
      group.add(anchor);
      nozzleAnchors[equipmentId] = nozzleAnchors[equipmentId] || {};
      nozzleAnchors[equipmentId][nozzleName] = anchor;
      return anchor;
    };
    const asWorldPoint = point => {
      if (point && point.isObject3D) {
        const out = new THREE.Vector3();
        point.getWorldPosition(out);
        return out;
      }
      if (point && point.isVector3) {
        return point.clone();
      }
      return new THREE.Vector3(point[0], point[1], point[2]);
    };
    const pushUniquePoint = (points, point) => {
      if (!points.length || points[points.length - 1].distanceTo(point) > 0.01) {
        points.push(point.clone());
      }
    };
    const _0xf475aa = (_0x32807e, _0x25cc91, _0x27d076 = 0.12, flowType = "main") => {
      const _0x276246 = new THREE.Group();
      const routePoints = _0x32807e.map(asWorldPoint);
      for (let _0x533099 = 0; _0x533099 < routePoints.length - 1; _0x533099++) {
        const _0x36ec36 = routePoints[_0x533099];
        const _0x2aeef1 = routePoints[_0x533099 + 1];
        const _0x273dd1 = _0x36ec36.distanceTo(_0x2aeef1);
        if (_0x273dd1 < 0.01) {
          continue;
        }
        let _0x31d25f = _0x25cc91;
        if (_0x25cc91.isFlowMat) {
          _0x31d25f = _0x25cc91.clone();
          _0x31d25f.map = _0x25cc91.map.clone();
          _0x31d25f.map.repeat.set(1, _0x273dd1 * 0.6);
          _0x31d25f.userData = { flowType: flowType };
          this.pipeMaterials.push(_0x31d25f);
        }
        const _0x1bd25c = new THREE.CylinderGeometry(_0x27d076, _0x27d076, _0x273dd1, 16);
        const _0x42e000 = new THREE.Mesh(_0x1bd25c, _0x31d25f);
        _0x42e000.position.copy(_0x36ec36).add(_0x2aeef1).multiplyScalar(0.5);
        _0x42e000.lookAt(_0x2aeef1);
        _0x42e000.rotateX(Math.PI / 2);
        _0x42e000.castShadow = true;
        _0x276246.add(_0x42e000);
      }
      for (let _0x322a7c = 1; _0x322a7c < routePoints.length - 1; _0x322a7c++) {
        const _0x5e132b = routePoints[_0x322a7c];
        const _prev = routePoints[_0x322a7c - 1].clone().sub(_0x5e132b).normalize();
        const _next = routePoints[_0x322a7c + 1].clone().sub(_0x5e132b).normalize();
        if (Math.abs(_prev.dot(_next)) > 0.99) {
          continue;
        }
        const _0x46effa = new THREE.Mesh(new THREE.SphereGeometry(_0x27d076 * 1.08, 12, 12), _0x25cc91.solidMat || _0x25cc91);
        _0x46effa.position.copy(_0x5e132b);
        _0x46effa.castShadow = true;
        _0x276246.add(_0x46effa);
      }
      if (routePoints.length >= 2) {
        const _0x362486 = new THREE.CylinderGeometry(_0x27d076 * 1.4, _0x27d076 * 1.4, 0.035, 16);
        const _0x4ba513 = routePoints[0];
        const _0x18b697 = routePoints[1];
        const _0x47a1c8 = routePoints[routePoints.length - 1];
        const _0x9b973e = routePoints[routePoints.length - 2];
        const _0xaff3e2 = new THREE.Mesh(_0x362486, this.materials.aluminum);
        _0xaff3e2.position.copy(_0x4ba513);
        _0xaff3e2.lookAt(_0x18b697);
        _0xaff3e2.rotateX(Math.PI / 2);
        _0x276246.add(_0xaff3e2);
        const _0x524360 = new THREE.Mesh(_0x362486, this.materials.aluminum);
        _0x524360.position.copy(_0x47a1c8);
        _0x524360.lookAt(_0x9b973e);
        _0x524360.rotateX(Math.PI / 2);
        _0x276246.add(_0x524360);
      }
      this.scene.add(_0x276246);
      return _0x276246;
    };
    const drawPipeRoute = (startPoint, endPoint, material, diameter = 0.24) => {
      const radius = diameter / 2;
      const start = asWorldPoint(startPoint);
      const end = asWorldPoint(endPoint);
      const startDir = startPoint && startPoint.isObject3D ? startPoint.userData.nozzleDirection : null;
      const endDir = endPoint && endPoint.isObject3D ? endPoint.userData.nozzleDirection : null;
      const route = [];
      pushUniquePoint(route, start);
      const routeStart = start.clone();
      const routeEnd = end.clone();
      if (startDir) {
        routeStart.add(startDir.clone().multiplyScalar(0.5));
        pushUniquePoint(route, routeStart);
      }
      if (endDir) {
        routeEnd.add(endDir.clone().multiplyScalar(0.5));
      }
      if (endPoint && endPoint.isObject3D && endPoint.userData.nozzleName === "Suction_In") {
        pushUniquePoint(route, new THREE.Vector3(routeStart.x, routeStart.y, routeEnd.z));
        pushUniquePoint(route, new THREE.Vector3(routeEnd.x, routeStart.y, routeEnd.z));
        pushUniquePoint(route, routeEnd);
        pushUniquePoint(route, end);
        return _0xf475aa(route, material, radius);
      }
      pushUniquePoint(route, new THREE.Vector3(routeStart.x, routeEnd.y, routeStart.z));
      pushUniquePoint(route, new THREE.Vector3(routeStart.x, routeEnd.y, routeEnd.z));
      pushUniquePoint(route, routeEnd);
      if (endDir) {
        pushUniquePoint(route, end);
      }
      return _0xf475aa(route, material, radius);
    };
    const _0x55e072 = new THREE.MeshStandardMaterial({
      color: 4674921,
      metalness: 0.72,
      roughness: 0.38
    });
    const _0x11d5f5 = new THREE.MeshStandardMaterial({
      color: 3621201,
      metalness: 0.68,
      roughness: 0.42
    });
    // ── Coordinated BIM Piping Supports ──────────────────────────────
    const supportSteelMat = this.materials.darkMetal;
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    
    // 1. Heavy-duty U-shaped Strut Hangers for Central Corridor Headers (y = 4.5, z = -3.4 to -4.6)
    // Placed at 2m intervals along the corridor (does not require floor columns!)
    [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8].forEach(cx => {
      // Horizontal thick strut cross-beam under pipes at y = 4.25, centered at z = -4.0
      const channel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.8), supportSteelMat);
      channel.position.set(cx, 4.25, -4.0);
      channel.castShadow = true;
      this.scene.add(channel);
      
      // Two vertical thick strut columns extending from ceiling (y = 5.5) to channel (y = 4.25)
      [-4.84, -3.16].forEach(cz => {
        const rod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), supportSteelMat);
        rod.position.set(cx, 4.875, cz);
        rod.castShadow = true;
        this.scene.add(rod);
      });
    });

    // 2. Concrete Sleepers under Outdoor Cooling Tower Headers (y = 8.3, z = -14.0 to -14.6)
    // Placed on the roof floor (y = 8.0)
    [-5.0, -2.0, 1.0, 3.0, 5.0, 7.0, 8.2].forEach(cx => {
      // Concrete block at y = 8.12
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 1.2), concreteMat);
      block.position.set(cx, 8.12, -14.3);
      block.castShadow = true;
      this.scene.add(block);
      
      // Steel cradle plates between block and headers
      [-14.6, -14.0].forEach(cz => {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.16), supportSteelMat);
        plate.position.set(cx, 8.255, cz);
        this.scene.add(plate);
      });
    });
    const _0x3d2a90 = this.materials.darkMetal;
    const _0xbb76bd = this.materials.aluminum;
    const _0x5dfcf8 = new THREE.MeshStandardMaterial({
      color: 1845040,
      metalness: 0.45,
      roughness: 0.7
    });
    const _0x265d85 = new THREE.MeshStandardMaterial({
      color: 9348532,
      metalness: 0.28,
      roughness: 0.62
    });
    const _0x3dca37 = new THREE.MeshStandardMaterial({
      color: 4937059,
      metalness: 0.58,
      roughness: 0.52
    });
    const _0x2db3ca = new THREE.MeshStandardMaterial({
      color: 16498468,
      metalness: 0.62,
      roughness: 0.38
    });
    const _0x51d7c7 = new THREE.MeshStandardMaterial({
      color: 3621201,
      metalness: 0.7,
      roughness: 0.42
    });
    const _0x41e693 = new THREE.MeshStandardMaterial({
      color: 3718648,
      metalness: 0.05,
      roughness: 0.15,
      transparent: true,
      opacity: 0.75
    });
    const _0x5315ad = new THREE.MeshStandardMaterial({
      color: 988970,
      metalness: 0,
      roughness: 0.92,
      transparent: true,
      opacity: 0.58
    });
    const _0x276914 = new THREE.MeshStandardMaterial({
      color: 1985134,
      metalness: 0.08,
      roughness: 0.82
    });
    const _0xbf7494 = new THREE.MeshStandardMaterial({
      color: 1450034,
      metalness: 0.42,
      roughness: 0.62
    });
    const _0xe7011 = new THREE.MeshStandardMaterial({
      color: 8330525,
      metalness: 0.58,
      roughness: 0.42
    });
    const _0x2378df = new THREE.MeshStandardMaterial({
      color: 1920728,
      metalness: 0.58,
      roughness: 0.42
    });
    const _0x2124b4 = (_0x504e26, _0x4b5be7, _0x1700d8, _0x227133) => {
      const _0x21cc43 = new THREE.Group();
      
      const casingMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.6 });
      const frameMat = this.materials.darkMetal;
      const alumMat = this.materials.aluminum;
      const fanMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.6, roughness: 0.3 }); // high-contrast industrial orange
      const gridMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.4 });
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.7, roughness: 0.35 }); // blue motor paint
      const fillMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.05, roughness: 0.95 }); // PVC honeycombs

      // 1. Water Basin
      const basinBase = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.45, 3.72), casingMat);
      basinBase.position.set(0, 0.225, 0);
      basinBase.castShadow = basinBase.receiveShadow = true;
      _0x21cc43.add(basinBase);

      const basinWater = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.02, 3.6),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.1, transparent: true, opacity: 0.8 }));
      basinWater.position.set(0, 0.44, 0);
      _0x21cc43.add(basinWater);

      // Basin corner rubber pads
      [[-1.65, -1.65], [1.65, -1.65], [-1.65, 1.65], [1.65, 1.65]].forEach(([px, pz]) => {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.075, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.15, roughness: 0.88 }));
        pad.position.set(px, -0.038, pz);
        _0x21cc43.add(pad);
      });

      // Support Pillars
      [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([px, pz]) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.75, 0.09), casingMat);
        pillar.position.set(px, 1.825, pz);
        pillar.castShadow = true;
        _0x21cc43.add(pillar);
      });

      // Horizontal frame rails
      [[3.44, 0.05, 0.05, 0, 1.25, 1.72], [3.44, 0.05, 0.05, 0, 1.25, -1.72],
       [0.05, 0.05, 3.44, 1.72, 1.25, 0], [0.05, 0.05, 3.44, -1.72, 1.25, 0]].forEach(([w, h, d, x, y, z]) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), casingMat);
        rail.position.set(x, y, z);
        _0x21cc43.add(rail);
      });

      // 2. Air Intake Louvers (showing details of PVC fills inside)
      for (let i = 0; i < 8; i++) {
        const ly = 0.54 + i * 0.205;
        const louverS = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.056, 0.12), frameMat);
        louverS.position.set(0, ly, 1.72); louverS.rotation.x = 0.22;
        _0x21cc43.add(louverS);
        const louverN = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.056, 0.12), frameMat);
        louverN.position.set(0, ly, -1.72); louverN.rotation.x = -0.22;
        _0x21cc43.add(louverN);
        const louverE = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.056, 3.38), frameMat);
        louverE.position.set(1.72, ly, 0); louverE.rotation.z = -0.22;
        _0x21cc43.add(louverE);
        const louverW = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.056, 3.38), frameMat);
        louverW.position.set(-1.72, ly, 0); louverW.rotation.z = 0.22;
        _0x21cc43.add(louverW);
      }

      // 3. Upper Casing Panels
      const panelN = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.78, 0.054),
        new THREE.MeshStandardMaterial({ color: 0x8e9ab0, metalness: 0.28, roughness: 0.62 }));
      panelN.position.set(0, 1.99, 1.725); _0x21cc43.add(panelN);
      const panelS = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.78, 0.054),
        new THREE.MeshStandardMaterial({ color: 0x8e9ab0, metalness: 0.28, roughness: 0.62 }));
      panelS.position.set(0, 1.99, -1.725); _0x21cc43.add(panelS);
      const panelE = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.78, 3.42),
        new THREE.MeshStandardMaterial({ color: 0x8e9ab0, metalness: 0.28, roughness: 0.62 }));
      panelE.position.set(1.725, 1.99, 0); _0x21cc43.add(panelE);
      const panelW = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.78, 3.42),
        new THREE.MeshStandardMaterial({ color: 0x8e9ab0, metalness: 0.28, roughness: 0.62 }));
      panelW.position.set(-1.725, 1.99, 0); _0x21cc43.add(panelW);

      // Casing upper rail - deck with center opening (North, South, East, West border plates)
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.58, roughness: 0.52 });
      
      const deckPlateN = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.054, 0.61), deckMat);
      deckPlateN.position.set(0, 2.39, 1.605); _0x21cc43.add(deckPlateN);
      
      const deckPlateS = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.054, 0.61), deckMat);
      deckPlateS.position.set(0, 2.39, -1.605); _0x21cc43.add(deckPlateS);
      
      const deckPlateE = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.054, 2.6), deckMat);
      deckPlateE.position.set(1.605, 2.39, 0); _0x21cc43.add(deckPlateE);
      
      const deckPlateW = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.054, 2.6), deckMat);
      deckPlateW.position.set(-1.605, 2.39, 0); _0x21cc43.add(deckPlateW);

      // 4. Access Ladder (placed on the side face, avoiding front pipe nozzles and gaps between towers)
      const ladderX = _0x227133 === "CT-01" ? -1.84 : 1.84;
      const ladderZ = 0; // middle of the side panel
      
      [-0.2, 0.2].forEach(lz => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.5, 8), alumMat);
        rail.position.set(ladderX, 1.25, ladderZ + lz);
        rail.castShadow = true;
        _0x21cc43.add(rail);
        
        // Wall mounting brackets for the ladder
        [0.4, 1.2, 2.0].forEach(by => {
          const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.024), frameMat);
          bracket.position.set(ladderX - Math.sign(ladderX) * 0.06, by, ladderZ + lz);
          _0x21cc43.add(bracket);
        });
      });
      
      // Ladder rungs (vertical spacing of 0.24m)
      for (let r = 0; r < 10; r++) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 8), alumMat);
        rung.rotation.x = Math.PI / 2;
        rung.position.set(ladderX, 0.2 + r * 0.24, ladderZ);
        rung.castShadow = true;
        _0x21cc43.add(rung);
      }

      // Ladder safety cage handrail hoops at the top (flat horizontal hoops!)
      for (let h = 0; h < 3; h++) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 8, 24, Math.PI), alumMat);
        hoop.rotation.z = ladderX > 0 ? -Math.PI / 2 : Math.PI / 2;
        hoop.rotation.x = Math.PI / 2;
        hoop.position.set(ladderX, 1.6 + h * 0.4, ladderZ);
        hoop.castShadow = true;
        _0x21cc43.add(hoop);
      }

      // Vertical cage straps connecting the hoops (3 vertical bars at 45 degree intervals)
      [-0.21, 0, 0.21].forEach(lz => {
        const lxOffset = Math.sqrt(0.09 - lz * lz); // r = 0.3, r^2 = 0.09
        const barX = ladderX + Math.sign(ladderX) * lxOffset;
        
        const verticalBar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.82, 6), alumMat);
        verticalBar.position.set(barX, 2.0, ladderZ + lz);
        verticalBar.castShadow = true;
        _0x21cc43.add(verticalBar);
      });

      // 5. Hollow Fan Shroud (open ended so we can see inside!)
      const fanShroud = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.44, 0.65, 32, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide })
      );
      fanShroud.position.set(0, 2.74, 0);
      fanShroud.castShadow = true;
      _0x21cc43.add(fanShroud);

      const shroudRim = new THREE.Mesh(
        new THREE.CylinderGeometry(1.31, 1.31, 0.042, 32, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.5, roughness: 0.52, side: THREE.DoubleSide })
      );
      shroudRim.position.set(0, 3.08, 0);
      _0x21cc43.add(shroudRim);

      // 6. Fan Hub & Blades Group (Animated Rotator)
      const fanRotator = new THREE.Group();
      fanRotator.position.set(0, 2.82, 0); // pivot at deck level
      
      const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.066, 16), frameMat);
      fanRotator.add(fanHub);

      for (let b = 0; b < 6; b++) {
        const bladeGroup = new THREE.Group();
        bladeGroup.rotation.y = (b / 6) * Math.PI * 2;
        
        const bladeSegment = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.016, 1.08), fanMat);
        bladeSegment.position.set(0, 0, 0.54);
        bladeSegment.rotation.z = 0.22; // blade twist pitch
        bladeSegment.castShadow = true;
        bladeGroup.add(bladeSegment);
        
        const tipCap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 6), alumMat);
        tipCap.rotation.z = Math.PI / 2;
        tipCap.position.set(0, 0, 1.08);
        bladeGroup.add(tipCap);
        
        fanRotator.add(bladeGroup);
      }
      _0x21cc43.add(fanRotator);
      this.coolingTowerFans.push(fanRotator);

      // 7. Safety Grille (radial spokes & concentric guard rings)
      const grilleGroup = new THREE.Group();
      grilleGroup.position.set(0, 3.065, 0);
      
      for (let s = 0; s < 12; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.008, 0.008), gridMat);
        spoke.rotation.y = (s / 12) * Math.PI;
        grilleGroup.add(spoke);
      }
      [0.4, 0.8, 1.2, 1.3].forEach(r => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 32), gridMat);
        ring.rotation.x = Math.PI / 2;
        grilleGroup.add(ring);
      });
      _0x21cc43.add(grilleGroup);

      // 8. Pipe Nozzle Connections (preserves original exact nozzle positions!)
      const topPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 10),
        new THREE.MeshStandardMaterial({ color: 0x7f7d77, metalness: 0.58, roughness: 0.42 }));
      topPipe.rotation.x = Math.PI / 2;
      topPipe.position.set(0, 2.3, 1.92);
      _0x21cc43.add(topPipe);

      const topFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.116, 0.02, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a4a42, metalness: 0.65, roughness: 0.4 }));
      topFlange.rotation.x = Math.PI / 2;
      topFlange.position.set(0, 2.3, 2.1);
      _0x21cc43.add(topFlange);

      const botPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.36, 10),
        new THREE.MeshStandardMaterial({ color: 0x1c6e38, metalness: 0.58, roughness: 0.42 }));
      botPipe.rotation.x = Math.PI / 2;
      botPipe.position.set(0, 0.3, 1.92);
      _0x21cc43.add(botPipe);

      const botFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.02, 12),
        new THREE.MeshStandardMaterial({ color: 0x1b5e30, metalness: 0.65, roughness: 0.4 }));
      botFlange.rotation.x = Math.PI / 2;
      botFlange.position.set(0, 0.3, 2.1);
      _0x21cc43.add(botFlange);

      // Fill vent stems
      const ventStemH = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 8), alumMat);
      ventStemH.position.set(0, 2.44, 2.19);
      _0x21cc43.add(ventStemH);
      const ventRingH = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.011, 8, 14), alumMat);
      ventRingH.position.set(0, 2.575, 2.19);
      _0x21cc43.add(ventRingH);
      const ventStemL = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.19, 8), alumMat);
      ventStemL.position.set(0, 0.475, 2.19);
      _0x21cc43.add(ventStemL);
      const ventRingL = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.011, 8, 14), alumMat);
      ventRingL.position.set(0, 0.63, 2.19);
      _0x21cc43.add(ventRingL);

      // 9. Detailed Internal Components (Fill Pack, Water Sprays, Motor & Drive Shaft)
      // PVC Heat-exchange Fill Pack (textured dark block visible through bottom air intake louvers)
      const fillPack = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.52, 3.38), fillMat);
      fillPack.position.set(0, 0.96, 0);
      _0x21cc43.add(fillPack);

      // Water Distribution main header pipe (horizontal)
      const waterHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 3.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.5 }));
      waterHeader.rotation.x = Math.PI / 2;
      waterHeader.position.set(0, 1.42, 0);
      _0x21cc43.add(waterHeader);

      // 4 branch distribution pipes with spray nozzles
      [-0.8, -0.3, 0.3, 0.8].forEach(pz => {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 3.1, 8),
          new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.2, roughness: 0.5 }));
        branch.rotation.z = Math.PI / 2;
        branch.position.set(0, 1.42, pz);
        _0x21cc43.add(branch);

        // Spray nozzles
        [-1.0, -0.5, 0, 0.5, 1.0].forEach(bx => {
          const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.038, 8), alumMat);
          nozzle.position.set(bx, 1.38, pz);
          _0x21cc43.add(nozzle);
        });
      });

      // Motor structural support steel beams crossing the tower
      const beamH = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.09, 0.09), frameMat);
      beamH.position.set(0, 2.05, 0);
      _0x21cc43.add(beamH);
      const beamV = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 3.38), frameMat);
      beamV.position.set(0, 2.05, 0);
      _0x21cc43.add(beamV);

      // Centrifugal Fan Motor (heavy cast iron motor box with cooling ribs)
      const motorGroup = new THREE.Group();
      motorGroup.position.set(0, 2.22, 0);
      
      const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.28, 12), motorMat);
      motorBody.castShadow = true;
      motorGroup.add(motorBody);
      
      const motorJBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), frameMat);
      motorJBox.position.set(0.13, 0.04, 0.06);
      motorGroup.add(motorJBox);

      // Motor cooling fins
      for (let f = 0; f < 6; f++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.28, 0.034), motorMat);
        fin.rotation.y = (f / 6) * Math.PI;
        motorGroup.add(fin);
      }
      _0x21cc43.add(motorGroup);

      // Fan drive shaft extending up to the hub
      const driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.58, 8), alumMat);
      driveShaft.position.set(0, 2.62, 0);
      _0x21cc43.add(driveShaft);

      // 10. Info Plate
      const infoCanvas = document.createElement("canvas");
      infoCanvas.width = 512; infoCanvas.height = 64;
      const infoCtx = infoCanvas.getContext("2d");
      infoCtx.fillStyle = "#0f172a"; infoCtx.fillRect(0, 0, 512, 64);
      infoCtx.strokeStyle = "#64748b"; infoCtx.lineWidth = 3;
      infoCtx.strokeRect(2, 2, 508, 60);
      infoCtx.fillStyle = "#e2e8f0";
      infoCtx.font = "bold 20px \"Segoe UI\", sans-serif";
      infoCtx.textAlign = "center";
      infoCtx.fillText("INDUCED DRAFT COOLING TOWER", 256, 28);
      infoCtx.fillStyle = "#94a3b8"; infoCtx.font = "14px monospace";
      infoCtx.fillText(_0x227133 + "  |  900 RT  |  FRP Construction", 256, 52);
      const infoTex = new THREE.CanvasTexture(infoCanvas);
      const infoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.25),
        new THREE.MeshBasicMaterial({ map: infoTex }));
      infoMesh.position.set(0, 0.68, 1.745);
      _0x21cc43.add(infoMesh);

      _0x21cc43.position.set(_0x504e26, _0x4b5be7, _0x1700d8);

      const _0x3e523b = new THREE.Mesh(new THREE.BoxGeometry(4, 3.6, 4.2), new THREE.MeshBasicMaterial({
        visible: false
      }));
      _0x3e523b.position.y = 1.8;
      _0x3e523b.userData = {
        type: "CoolingTower",
        name: "Induced Draft Cooling Tower " + _0x227133 + " (900 RT)"
      };
      _0x21cc43.add(_0x3e523b);
      registerNozzleAnchor(_0x227133, "CWR_In", _0x21cc43, [0, 2.3, 2.1], [0, 0, 1]);
      registerNozzleAnchor(_0x227133, "CWS_Out", _0x21cc43, [0, 0.3, 2.1], [0, 0, 1]);
      this.interactables.push(_0x3e523b);
      this.scene.add(_0x21cc43);
    };
    _0x2124b4(-3.5, 8, -17.5, "CT-01");
    _0x2124b4(1, 8, -17.5, "CT-02");

    // ── Sand Filter & Chemical Dosing Factories ─────────────────────────
    const createSandFilter = (x, y, z) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      
      const darkMetal = this.materials.darkMetal;
      const alumMat = this.materials.aluminum;
      const copperMat = this.materials.copper;
      const filterBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.25 }); // dark steel blue
      const valveMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.4, roughness: 0.4 }); // motorized orange
      const pumpMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.7, roughness: 0.3 }); // blue pump
      const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.35 }); // galvanised grey
      const ctrlPanelMat = this.materials.controlPanel;
      
      // 1. Skid Frame Base
      const skidBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.4), darkMetal);
      skidBase.position.set(0, 0.04, 0);
      skidBase.castShadow = skidBase.receiveShadow = true;
      group.add(skidBase);

      // Support frame posts
      [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]].forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), darkMetal);
        post.position.set(px, 0.1, pz);
        group.add(post);
      });

      // 2. Sand Filter Tank (Pressure Vessel)
      const tankGroup = new THREE.Group();
      tankGroup.position.set(-0.25, 0.1, 0);

      // Cylindrical vessel
      const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 20), filterBodyMat);
      tankBody.position.set(0, 0.65, 0);
      tankBody.castShadow = true;
      tankGroup.add(tankBody);

      // Spherical dome top & bottom
      const domeT = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), filterBodyMat);
      domeT.position.set(0, 1.2, 0);
      tankGroup.add(domeT);
      const domeB = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), filterBodyMat);
      domeB.rotation.x = Math.PI;
      domeB.position.set(0, 0.1, 0);
      tankGroup.add(domeB);

      // Tank center flange seam
      const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.395, 0.395, 0.04, 20), alumMat);
      seam.position.set(0, 0.65, 0);
      tankGroup.add(seam);

      // Tank nameplate
      const np = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 }));
      np.position.set(0, 0.85, 0.382);
      np.rotation.y = 0;
      tankGroup.add(np);

      group.add(tankGroup);

      // 3. Pump & Motor Unit
      const pumpGroup = new THREE.Group();
      pumpGroup.position.set(0.48, 0.08, 0.3);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), pumpMat);
      motor.rotation.z = Math.PI / 2;
      motor.position.set(0.06, 0.12, 0);
      motor.castShadow = true;
      pumpGroup.add(motor);

      // Motor cooling fins
      for(let f = 0; f < 5; f++) {
        const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 12), darkMetal);
        fin.rotation.z = Math.PI / 2;
        fin.position.set(-0.06 + f * 0.05, 0.12, 0);
        pumpGroup.add(fin);
      }

      const pumpHead = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), darkMetal);
      pumpHead.rotation.z = Math.PI / 2;
      pumpHead.position.set(0.24, 0.12, 0);
      pumpGroup.add(pumpHead);

      const pumpBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.22), darkMetal);
      pumpBase.position.set(0.08, 0.03, 0);
      pumpGroup.add(pumpBase);

      group.add(pumpGroup);

      // 4. Manifold Pipe Nest & Valve Nest (automatic 5-valve bypass system)
      const manifold = new THREE.Group();
      manifold.position.set(0.28, 0.1, -0.2);

      const pipeGeo = (r, h) => new THREE.CylinderGeometry(r, r, h, 12);

      // Vertical main inlet/outlet risers
      const riserIn = new THREE.Mesh(pipeGeo(0.04, 0.95), pipeMat);
      riserIn.position.set(-0.15, 0.475, 0);
      riserIn.castShadow = true;
      manifold.add(riserIn);

      const riserOut = new THREE.Mesh(pipeGeo(0.04, 0.95), pipeMat);
      riserOut.position.set(0.15, 0.475, 0);
      riserOut.castShadow = true;
      manifold.add(riserOut);

      // Cross connecting headers
      [0.32, 0.68].forEach(yPos => {
        const cross = new THREE.Mesh(pipeGeo(0.04, 0.38), pipeMat);
        cross.rotation.z = Math.PI / 2;
        cross.position.set(0, yPos, 0);
        manifold.add(cross);

        // Valve Actuator Boxes (motorized butterfly valves)
        [[-0.15, 0], [0.15, 0], [0, 0]].forEach(([px, pz]) => {
          const act = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), valveMat);
          act.position.set(px, yPos, pz);
          manifold.add(act);

          const flangeValve = new THREE.Mesh(pipeGeo(0.06, 0.05), alumMat);
          flangeValve.rotation.z = Math.PI / 2;
          flangeValve.position.set(px, yPos, pz);
          manifold.add(flangeValve);
        });
      });

      // Pressure Gauges (White face dials on inlet/outlet)
      [[-0.15, 0.85], [0.15, 0.85]].forEach(([px, py]) => {
        const stem = new THREE.Mesh(pipeGeo(0.008, 0.06), copperMat);
        stem.position.set(px, py, 0.05);
        manifold.add(stem);

        const gauge = new THREE.Mesh(pipeGeo(0.046, 0.02), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }));
        gauge.rotation.x = Math.PI / 2;
        gauge.position.set(px, py + 0.04, 0.07);
        manifold.add(gauge);

        // Dial casing
        const casing = new THREE.Mesh(pipeGeo(0.05, 0.024), darkMetal);
        casing.rotation.x = Math.PI / 2;
        casing.position.set(px, py + 0.04, 0.06);
        manifold.add(casing);

        // Red indicator dial pointer
        const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.002), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        pointer.position.set(px, py + 0.04, 0.081);
        pointer.rotation.z = -0.5 + Math.random();
        manifold.add(pointer);
      });

      group.add(manifold);

      // 5. PLC Control Box panel
      const plc = new THREE.Group();
      plc.position.set(-0.64, 0.9, 0.45);

      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.14), ctrlPanelMat);
      cabinet.castShadow = true;
      plc.add(cabinet);

      const stand = new THREE.Mesh(pipeGeo(0.016, 0.8), darkMetal);
      stand.position.set(0, -0.42, 0);
      plc.add(stand);

      // PLC indicators LED
      const ledG = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      ledG.position.set(-0.06, 0.1, 0.072);
      plc.add(ledG);

      const ledO = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      ledO.position.set(0.06, 0.1, 0.072);
      plc.add(ledO);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      screen.position.set(0, -0.04, 0.072);
      plc.add(screen);

      group.add(plc);



      // Set user interactive metadata
      const selectBox = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.5), new THREE.MeshBasicMaterial({ visible: false }));
      selectBox.position.set(0, 0.85, 0);
      selectBox.userData = { type: "SandFilter", name: "Side-stream Sand Filter (SF-01)" };
      group.add(selectBox);
      this.interactables.push(selectBox);

      this.scene.add(group);
    };

    const createDosingSkid = (x, y, z) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      
      const darkMetal = this.materials.darkMetal;
      const alumMat = this.materials.aluminum;
      const copperMat = this.materials.copper;
      const ctrlPanelMat = this.materials.controlPanel;
      
      // Poly translucent tank materials
      const tankBlue = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide
      });
      const tankYellow = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide
      });

      const liquidBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.82 });
      const liquidOrange = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.82 });
      
      // 1. Skid Base Frame
      const skidBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.1), darkMetal);
      skidBase.position.set(0, 0.03, 0);
      skidBase.castShadow = true;
      group.add(skidBase);

      const frameGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.95, 8);

      // Back frame posts
      [[-0.66, -0.5], [0.66, -0.5]].forEach(([px, pz]) => {
        const post = new THREE.Mesh(frameGeo, darkMetal);
        post.position.set(px, 0.475, pz);
        group.add(post);
      });

      // Frame crossbars
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.032, 0.032), darkMetal);
      crossbar.position.set(0, 0.92, -0.5);
      group.add(crossbar);

      // 2. Translucent Polyethylene Tanks with Opaque Internal Liquids
      // Tank 1: Biocide (Blue)
      const tank1 = new THREE.Group();
      tank1.position.set(-0.32, 0.06, 0.12);

      const shell1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 16), tankBlue);
      shell1.position.y = 0.4;
      shell1.castShadow = true;
      tank1.add(shell1);

      // Translucent lid
      const lid1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), darkMetal);
      lid1.position.y = 0.815;
      tank1.add(lid1);

      // Internal fluid level
      const fluid1 = new THREE.Mesh(new THREE.CylinderGeometry(0.236, 0.236, 0.46, 16), liquidBlue);
      fluid1.position.y = 0.23;
      tank1.add(fluid1);

      // Agitator Motor on lid
      const agitator1 = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.12, 10), alumMat);
      agitator1.position.set(0, 0.89, 0);
      tank1.add(agitator1);
      const motorWire1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.22), darkMetal);
      motorWire1.rotation.y = Math.PI / 2;
      motorWire1.position.set(0.08, 0.89, -0.06);
      tank1.add(motorWire1);

      group.add(tank1);

      // Tank 2: Scale Inhibitor (Amber/Yellow)
      const tank2 = new THREE.Group();
      tank2.position.set(0.32, 0.06, 0.12);

      const shell2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 16), tankYellow);
      shell2.position.y = 0.4;
      shell2.castShadow = true;
      tank2.add(shell2);

      const lid2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), darkMetal);
      lid2.position.y = 0.815;
      tank2.add(lid2);

      const fluid2 = new THREE.Mesh(new THREE.CylinderGeometry(0.236, 0.236, 0.58, 16), liquidOrange);
      fluid2.position.y = 0.29;
      tank2.add(fluid2);

      const agitator2 = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.12, 10), alumMat);
      agitator2.position.set(0, 0.89, 0);
      tank2.add(agitator2);
      
      group.add(tank2);

      // 3. Precision Dosing Pumps (Diaphragm pumps mounted on back shelf)
      const pumpShelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 0.24), darkMetal);
      pumpShelf.position.set(0, 0.48, -0.38);
      group.add(pumpShelf);

      [[-0.32, 0x1d4ed8], [0.32, 0xef4444]].forEach(([px, col]) => {
        const pumpGroup = new THREE.Group();
        pumpGroup.position.set(px, 0.495, -0.38);

        // Pump housing
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }));
        housing.castShadow = true;
        pumpGroup.add(housing);

        // Liquid end diaphragm
        const diaphragm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), alumMat);
        diaphragm.rotation.x = Math.PI / 2;
        diaphragm.position.set(0, -0.02, 0.08);
        pumpGroup.add(diaphragm);

        // Suction tube (transparent PVC tube)
        const tubeS = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
        tubeS.position.set(0, -0.21, 0.08);
        pumpGroup.add(tubeS);

        // Discharge dosing tube (Fine copper capillary tube)
        const tubeD = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6), copperMat);
        tubeD.position.set(0, 0.28, 0.08);
        pumpGroup.add(tubeD);

        group.add(pumpGroup);
      });

      // 4. Central PLC Control Panel
      const plc = new THREE.Group();
      plc.position.set(0, 0.72, -0.48);

      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.1), ctrlPanelMat);
      cabinet.castShadow = true;
      plc.add(cabinet);

      // Status indicator lights
      [[-0.07, 0x22c55e], [0, 0x22c55e], [0.07, 0xef4444]].forEach(([px, col]) => {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
        led.position.set(px, 0.08, 0.052);
        plc.add(led);
      });

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      screen.position.set(0, -0.04, 0.052);
      plc.add(screen);

      group.add(plc);

      // Set user interactive metadata
      const selectBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
      selectBox.position.set(0, 0.65, 0);
      selectBox.userData = { type: "DosingSkid", name: "Automatic Chemical Dosing Skid (DS-01)" };
      group.add(selectBox);
      this.interactables.push(selectBox);

      this.scene.add(group);
    };

    // Instantiate premium accessories on the roof platform (y = 8.0) near CT-01 and CT-02!
    createSandFilter(-6.5, 8.0, -17.5);
    createDosingSkid(5.2, 8.0, -15.8);
    const _0x450a68 = (_0x47255d, _0x4fa30b, _0x58ef12) => {
      const _0x229478 = new THREE.Group();
      
      const _0x5d7a93 = this.materials.darkMetal;
      const _0x81106b = this.materials.chillerBody;
      const _0x22512b = this.materials.compressor;
      const _0xbb76bd = this.materials.aluminum;
      const _0x81c456 = this.materials.copper;
      const _0x1de086 = new THREE.MeshStandardMaterial({ color: 0x645b4a, metalness: 0.7, roughness: 0.4 });

      const insulBlue = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, metalness: 0.1, roughness: 0.7 });
      const insulGreen = new THREE.MeshStandardMaterial({ color: 0x064e3b, metalness: 0.1, roughness: 0.7 });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.08 });
      const ledGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const ledRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const ledYellow = new THREE.MeshBasicMaterial({ color: 0xeab308 });

      // 1. Skid Base
      const skidL = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.12), _0x5d7a93);
      skidL.position.set(0, 0.08, 0.54); skidL.castShadow = true;
      _0x229478.add(skidL);
      const skidR = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.12), _0x5d7a93);
      skidR.position.set(0, 0.08, -0.54); skidR.castShadow = true;
      _0x229478.add(skidR);

      [-1.2, -0.4, 0.4, 1.2].forEach(bx => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 1.08), _0x5d7a93);
        beam.position.set(bx, 0.08, 0);
        _0x229478.add(beam);
      });

      [[-1.38, -0.48], [1.38, -0.48], [-1.38, 0.48], [1.38, 0.48]].forEach(([fx, fz]) => {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 8), _0x5d7a93);
        foot.position.set(fx, -0.02, fz);
        _0x229478.add(foot);
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.09, 8), _0xbb76bd);
        bolt.position.set(fx, 0.045, fz);
        _0x229478.add(bolt);
      });

      // 2. Evaporator Shell (CHW side, insulated blue) - Smaller (radius 0.39)
      const evapShell = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32), insulBlue);
      evapShell.rotation.z = Math.PI / 2;
      evapShell.position.set(0, 0.57, -0.45);
      evapShell.castShadow = true;
      _0x229478.add(evapShell);

      for (let s = 0; s < 5; s++) {
        const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.395, 0.395, 0.028, 32), _0xbb76bd);
        strap.rotation.z = Math.PI / 2;
        strap.position.set(-0.95 + s * 0.5, 0.57, -0.45);
        _0x229478.add(strap);
      }

      // CHW Nozzles (2 stubs left-side! Y is 0.54 matching the smaller shell center)
      const ewGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.28, 12);
      [[-1.48, 0.54, -0.6], [-1.48, 0.54, -0.3]].forEach(pos => {
        const nozzle = new THREE.Mesh(ewGeo, _0x81106b);
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.set(...pos);
        _0x229478.add(nozzle);
      });

      const evapGlassOverlay = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.54, 32),
        new THREE.MeshStandardMaterial({ color: 0xbfd7ea, transparent: true, opacity: 0.16, roughness: 0.95 }));
      evapGlassOverlay.rotation.z = Math.PI / 2;
      evapGlassOverlay.position.set(0, 0.57, -0.45);
      _0x229478.add(evapGlassOverlay);

      // 3. Condenser Shell (CW side, insulated green) - Larger (radius 0.44)
      const condShell = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.52, 32), insulGreen);
      condShell.rotation.z = Math.PI / 2;
      condShell.position.set(0, 0.62, 0.45);
      condShell.castShadow = true;
      _0x229478.add(condShell);

      for (let s = 0; s < 5; s++) {
        const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.028, 32), _0xbb76bd);
        strap.rotation.z = Math.PI / 2;
        strap.position.set(-0.95 + s * 0.5, 0.62, 0.45);
        _0x229478.add(strap);
      }

      // CW nozzles (left-side! Y is 0.58 matching the larger shell center)
      const cwGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.28, 12);
      [[-1.48, 0.58, 0.6], [-1.48, 0.58, 0.3]].forEach(pos => {
        const nozzle = new THREE.Mesh(cwGeo, _0x81106b);
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.set(...pos);
        _0x229478.add(nozzle);
      });

      // Nozzle flanges (left-side! Y is 0.54 for Evap and 0.58 for Cond)
      const nozzFlangeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
      [[-1.62, 0.54, -0.6], [-1.62, 0.54, -0.3], [-1.62, 0.58, 0.6], [-1.62, 0.58, 0.3]].forEach(pos => {
        const fl = new THREE.Mesh(nozzFlangeGeo, _0x81106b);
        fl.rotation.z = Math.PI / 2;
        fl.position.set(...pos);
        _0x229478.add(fl);
      });

      // Saddle supports between vessels (swapped saddle geometries/positions)
      [-0.76, 0.76].forEach(sx => {
        const saddleE = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.72), _0x5d7a93);
        saddleE.position.set(sx, 0.26, -0.45);
        _0x229478.add(saddleE);
        const saddleC = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.82), _0x5d7a93);
        saddleC.position.set(sx, 0.28, 0.45);
        _0x229478.add(saddleC);
      });

      // 4. Galvanized Steel Structural Support End Plates & Spherical Domed covers (Water Boxes)
      [-1.3, 1.3].forEach(px => {
        // Support plate profile wrapping both vessels (widened to 1.6 in Z to cover both centers)
        const supportPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 1.6), _0x5d7a93);
        supportPlate.position.set(px, 0.58, 0);
        supportPlate.castShadow = true;
        _0x229478.add(supportPlate);

        // Circular water box heads (swapped radii and Y centers)
        const waterBoxEvap = new THREE.Mesh(new THREE.CylinderGeometry(0.395, 0.395, 0.12, 24), _0x81106b);
        waterBoxEvap.rotation.z = Math.PI / 2;
        waterBoxEvap.position.set(px + Math.sign(px) * 0.08, 0.57, -0.45);
        _0x229478.add(waterBoxEvap);

        const waterBoxCond = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.12, 24), _0x81106b);
        waterBoxCond.rotation.z = Math.PI / 2;
        waterBoxCond.position.set(px + Math.sign(px) * 0.08, 0.62, 0.45);
        _0x229478.add(waterBoxCond);
        
        // Spherical domed covers (swapped radii and Y centers)
        const domeEvap = new THREE.Mesh(
          new THREE.SphereGeometry(0.395, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          _0x81106b
        );
        domeEvap.rotation.z = px > 0 ? Math.PI / 2 : -Math.PI / 2;
        domeEvap.position.set(px + Math.sign(px) * 0.14, 0.57, -0.45);
        _0x229478.add(domeEvap);

        const domeCond = new THREE.Mesh(
          new THREE.SphereGeometry(0.455, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          _0x81106b
        );
        domeCond.rotation.z = px > 0 ? Math.PI / 2 : -Math.PI / 2;
        domeCond.position.set(px + Math.sign(px) * 0.14, 0.62, 0.45);
        _0x229478.add(domeCond);

        // Flange bolt rings (swapped bolt circle radii and Y centers)
        for (let b = 0; b < 12; b++) {
          const angle = (b / 12) * Math.PI * 2;
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), _0xbb76bd);
          bolt.rotation.z = Math.PI / 2;
          bolt.position.set(px + Math.sign(px) * 0.14, 0.57 + Math.cos(angle) * 0.36, -0.45 + Math.sin(angle) * 0.36);
          _0x229478.add(bolt);

          const boltC = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), _0xbb76bd);
          boltC.rotation.z = Math.PI / 2;
          boltC.position.set(px + Math.sign(px) * 0.14, 0.62 + Math.cos(angle) * 0.42, 0.45 + Math.sin(angle) * 0.42);
          _0x229478.add(boltC);
        }
      });

      // 5. Compressor Assembly & Pipes (elevated to y = 1.65 to resolve overlaps!)
      const compressor = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.44, 20), _0x22512b);
      compressor.rotation.z = Math.PI / 2;
      compressor.position.set(-0.5, 1.65, 0);
      _0x229478.add(compressor);

      const igvCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.13, 20), _0xbb76bd);
      igvCap.rotation.z = Math.PI / 2;
      igvCap.position.set(-0.77, 1.65, 0);
      _0x229478.add(igvCap);

      const igvBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.08), _0xbb76bd);
      igvBox.position.set(-0.76, 1.91, 0.08);
      _0x229478.add(igvBox);

      const compVolute = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.36, 20), _0x22512b);
      compVolute.rotation.z = Math.PI / 2;
      compVolute.position.set(-0.1, 1.65, 0);
      _0x229478.add(compVolute);

      const sealBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.28), this.materials.hxPlate);
      sealBox.position.set(-0.3, 1.43, -0.22);
      _0x229478.add(sealBox);

      const diffuserGeo = new THREE.CylinderGeometry(0.24, 0.27, 0.32, 20);
      const diffuser = new THREE.Mesh(diffuserGeo, _0x22512b);
      diffuser.rotation.z = Math.PI / 2;
      diffuser.position.set(0.22, 1.65, 0);
      _0x229478.add(diffuser);

      // Clean Suction Connection (Riser + YZ Elbow + Horizontal Stub: NO shell intersections!)
      // Evaporator shell top is now at y=0.57 + 0.39 = 0.96.
      // So riser height is increased to 0.55 and positioned at y=1.235 to perfectly align.
      const suctionRiser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.55, 16),
        _0x22512b
      );
      suctionRiser.position.set(-0.77, 1.235, -0.45);
      _0x229478.add(suctionRiser);

      const suctionElbow = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.13, 16, 24, Math.PI / 2),
        _0x22512b
      );
      suctionElbow.rotation.y = -Math.PI / 2;
      suctionElbow.position.set(-0.77, 1.51, -0.3);
      _0x229478.add(suctionElbow);

      const suctionStub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.3, 16),
        _0x22512b
      );
      suctionStub.rotation.x = Math.PI / 2;
      suctionStub.position.set(-0.77, 1.66, -0.15);
      _0x229478.add(suctionStub);

      // Clean Discharge Connection (Vertical stub + Elbow 1 + Horizontal pipe + Elbow 2 + Vertical pipe + Expander)
      const dischargeRiser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.075, 16),
        _0x22512b
      );
      dischargeRiser.position.set(-0.1, 1.8075, 0);
      _0x229478.add(dischargeRiser);

      const dischargeElbow1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.09, 16, 24, Math.PI / 2),
        _0x22512b
      );
      dischargeElbow1.rotation.y = -Math.PI / 2;
      dischargeElbow1.position.set(-0.1, 1.845, 0.12);
      _0x229478.add(dischargeElbow1);

      const dischargeHoriz = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.21, 16),
        _0x22512b
      );
      dischargeHoriz.rotation.x = Math.PI / 2;
      dischargeHoriz.position.set(-0.1, 1.965, 0.225);
      _0x229478.add(dischargeHoriz);

      const dischargeElbow2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.09, 16, 24, Math.PI / 2),
        _0x22512b
      );
      dischargeElbow2.rotation.x = Math.PI;
      dischargeElbow2.rotation.y = -Math.PI / 2;
      dischargeElbow2.position.set(-0.1, 1.965, 0.45);
      _0x229478.add(dischargeElbow2);

      const dischargeVert = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.125, 16),
        _0x22512b
      );
      dischargeVert.position.set(-0.1, 1.7825, 0.45);
      _0x229478.add(dischargeVert);

      // Condenser shell top is now at y=0.62 + 0.44 = 1.06.
      // So expander height is shortened to 0.66 and positioned at y=1.39 to perfectly align.
      const dischargeExpander = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.2, 0.66, 16),
        _0x22512b
      );
      dischargeExpander.position.set(-0.1, 1.39, 0.45);
      _0x229478.add(dischargeExpander);

      // 6. Motor Barrel (ribbed, elevated to y = 1.65!)
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x2d3566, metalness: 0.72, roughness: 0.35 });
      const motorBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 1.05, 20), motorMat);
      motorBarrel.rotation.z = Math.PI / 2;
      motorBarrel.position.set(0.9, 1.65, 0);
      motorBarrel.castShadow = true;
      _0x229478.add(motorBarrel);

      // Motor cooling ribs
      const steelRibMat = new THREE.MeshStandardMaterial({ color: 0x1e2952, metalness: 0.72, roughness: 0.35 });
      for (let r = 0; r < 10; r++) {
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.248, 0.022, 20), steelRibMat);
        rib.rotation.z = Math.PI / 2;
        rib.position.set(0.4 + r * 0.115, 1.65, 0);
        _0x229478.add(rib);
      }

      // Motor flanges
      const flangeMat = new THREE.MeshStandardMaterial({ color: 0x1c6e38, metalness: 0.8, roughness: 0.3 });
      [0.36, 1.44].forEach(fx => {
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 20), flangeMat);
        fl.rotation.z = Math.PI / 2;
        fl.position.set(fx, 1.65, 0);
        _0x229478.add(fl);
      });

      const motorJunctionBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.14), _0x5d7a93);
      motorJunctionBox.position.set(0.9, 1.93, 0.2);
      _0x229478.add(motorJunctionBox);

      const couplingShield = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 16), _0xbb76bd);
      couplingShield.rotation.z = Math.PI / 2;
      couplingShield.position.set(0.37, 1.65, 0);
      _0x229478.add(couplingShield);

      // 7. Vertical Oil Separator Vessel (relocated outward to z = 1.05 to avoid condenser collision!)
      const oilSeparator = new THREE.Group();
      oilSeparator.position.set(-0.6, 0.72, 1.05);
      
      const separatorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.68, 12), _0x5d7a93);
      separatorBody.castShadow = true;
      oilSeparator.add(separatorBody);
      
      const separatorDomeT = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        _0x5d7a93
      );
      separatorDomeT.position.y = 0.34;
      oilSeparator.add(separatorDomeT);
      
      const separatorDomeB = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        _0x5d7a93
      );
      separatorDomeB.rotation.x = Math.PI;
      separatorDomeB.position.y = -0.34;
      oilSeparator.add(separatorDomeB);

      // Support brackets (lengthened to 0.60 in Z and positioned to reach condenser shell center at z = 0.45!)
      const sepBracketT = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.60), _0xbb76bd);
      sepBracketT.position.set(0.08, 0.2, -0.30);
      oilSeparator.add(sepBracketT);
      const sepBracketB = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.60), _0xbb76bd);
      sepBracketB.position.set(0.08, -0.2, -0.30);
      oilSeparator.add(sepBracketB);

      _0x229478.add(oilSeparator);

      // Top rectangular valve header boxes (elevated slightly for compressor base clearance)
      const valveBoxL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.35), _0x5d7a93);
      valveBoxL.position.set(-1.0, 1.18, 0);
      valveBoxL.castShadow = true;
      _0x229478.add(valveBoxL);

      const valveBoxR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.35), _0x5d7a93);
      valveBoxR.position.set(1.0, 1.18, 0);
      valveBoxR.castShadow = true;
      _0x229478.add(valveBoxR);

      // 8. Oil/refrigerant lines (piping loops, elevated for compressor clearance!)
      const oilLineV = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), _0x81c456);
      oilLineV.position.set(-0.5, 1.32, -0.26);
      _0x229478.add(oilLineV);
      const oilLineH = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3), _0x81c456);
      oilLineH.rotation.x = Math.PI / 2;
      oilLineH.position.set(-0.5, 1.57, -0.43);
      _0x229478.add(oilLineH);

      const liqLineV = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48), _0x81c456);
      liqLineV.position.set(0.36, 1.29, 0.24);
      _0x229478.add(liqLineV);
      const liqLineH = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), _0x81c456);
      liqLineH.rotation.x = Math.PI / 2;
      liqLineH.position.set(0.36, 1.53, 0.4);
      _0x229478.add(liqLineH);

      // Liquid line solenoid
      const solenoid = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.16), _0x1de086);
      solenoid.rotation.z = Math.PI / 2;
      solenoid.position.set(-0.4, 0.18, -0.05);
      _0x229478.add(solenoid);
      const solenoidBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), this.materials.copper);
      solenoidBox.position.set(-0.4, 0.18, -0.12);
      _0x229478.add(solenoidBox);

      // Expansion device (relocated away from the support plate to x = -0.8!)
      const expDevice = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 12), _0xbb76bd);
      expDevice.position.set(-0.8, 1.15, 0.1);
      _0x229478.add(expDevice);
      const expBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), this.materials.hxPlate);
      expBox.position.set(-0.8, 0.75, 0.1);
      _0x229478.add(expBox);
      const expStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46), this.materials.copper);
      expStem.position.set(-0.74, 0.95, 0.04);
      _0x229478.add(expStem);

      // Sight glass & filter-drier
      const sightGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.16, 8), this.materials.copper);
      sightGlass.position.set(0.45, 0.97, 0.3);
      _0x229478.add(sightGlass);
      const sightStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26), this.materials.copper);
      sightStem.position.set(0.45, 1.18, 0.3);
      _0x229478.add(sightStem);

      // 9. Starter Control Cabinet (relocated to front-facing side of evaporator to prevent collision!)
      const cabShell = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.14), this.materials.controlPanel);
      cabShell.position.set(-0.3, 1.0, -0.97);
      cabShell.castShadow = true;
      _0x229478.add(cabShell);

      const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.23),
        new THREE.MeshBasicMaterial({ map: this.textures.chillerScreen }));
      screenMesh.position.set(-0.3, 1.1, -1.042);
      screenMesh.rotation.y = Math.PI; // facing -Z (backward)
      _0x229478.add(screenMesh);

      // Indicator LEDs lined up horizontally on the front
      const ledsGroup = [];
      [[-0.45, 0x22c5b0], [-0.37, 0x22c5b0], [-0.29, 0xfbbf24], [-0.21, 0x22c5b0]].forEach(([x_pos, col]) => {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8),
          new THREE.MeshBasicMaterial({ color: col }));
        led.position.set(x_pos, 1.3, -1.042);
        _0x229478.add(led);
        ledsGroup.push(led);
      });
      if (!this.chillerLeds) this.chillerLeds = [];
      this.chillerLeds.push(ledsGroup);

      const estopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
      estopBtn.rotation.x = Math.PI / 2;
      estopBtn.position.set(-0.12, 1.3, -1.042);
      _0x229478.add(estopBtn);

      // Pedestal mounting support underneath the cabinet
      const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.52, 0.1), this.materials.darkMetal);
      lowerPanel.position.set(-0.3, 0.35, -0.97);
      _0x229478.add(lowerPanel);

      for (let sl = 0; sl < 6; sl++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.01), _0xbb76bd);
        slat.position.set(-0.3, 0.18 + sl * 0.06, -1.022);
        _0x229478.add(slat);
      }

      const cabLed = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x22c5b0 }));
      cabLed.position.set(-0.3, 0.5, -1.022);
      _0x229478.add(cabLed);

      // 10. Nameplate (shifted right to x = 0.5 to prevent cabinet overlap!)
      const npCanvas = document.createElement("canvas");
      npCanvas.width = 512; npCanvas.height = 128;
      const npCtx = npCanvas.getContext("2d");
      npCtx.fillStyle = "#0f172a"; npCtx.fillRect(0, 0, 512, 128);
      npCtx.strokeStyle = "#38bdf8"; npCtx.lineWidth = 4;
      npCtx.strokeRect(3, 3, 506, 122);
      npCtx.fillStyle = "#38bdf8"; npCtx.font = "bold 30px monospace";
      npCtx.textAlign = "center"; npCtx.textBaseline = "middle";
      npCtx.fillText(_0x58ef12, 256, 46);
      npCtx.fillStyle = "#94a3b8"; npCtx.font = "18px monospace";
      npCtx.fillText("Water-Cooled Centrifugal  800 RT", 256, 95);
      const npTex = new THREE.CanvasTexture(npCanvas);
      const npMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.27),
        new THREE.MeshBasicMaterial({ map: npTex }));
      npMesh.position.set(0.5, 0.24, -0.92);
      npMesh.rotation.y = Math.PI; // facing -Z
      _0x229478.add(npMesh);

      _0x229478.position.set(_0x47255d, 0, _0x4fa30b);

      // Nozzle connections registered on the LEFT water box cap!
      const _chillerId = _0x58ef12.split(" ")[0];
      registerNozzleAnchor(_chillerId, "CHWS_Out", _0x229478, [-1.62, 0.54, -0.6], [-1, 0, 0]);
      registerNozzleAnchor(_chillerId, "CHWR_In", _0x229478, [-1.62, 0.54, -0.3], [-1, 0, 0]);
      registerNozzleAnchor(_chillerId, "CWS_In", _0x229478, [-1.62, 0.58, 0.3], [-1, 0, 0]);
      registerNozzleAnchor(_chillerId, "CWR_Out", _0x229478, [-1.62, 0.58, 0.6], [-1, 0, 0]);

      // Bounding box for selection click detection covers all parts
      const _0x533b84 = new THREE.Mesh(new THREE.BoxGeometry(3.24, 2.1, 1.8),
        new THREE.MeshBasicMaterial({ visible: false }));
      _0x533b84.position.set(0, 1.05, 0);
      _0x533b84.userData = { type: "Chiller", name: _0x58ef12 };
      _0x229478.add(_0x533b84);
      this.interactables.push(_0x533b84);
      this.scene.add(_0x229478);
    };
    _0x450a68(-4, 1, "CH-01 (800 RT)");
    _0x450a68(4, 1, "CH-02 (800 RT)");
    const _0x3f65fe = new THREE.MeshStandardMaterial({
      color: 3621201,
      metalness: 0.78,
      roughness: 0.38
    });
    const _0x2e6eaa = new THREE.MeshStandardMaterial({
      color: 13751771,
      metalness: 0.5,
      roughness: 0.4
    });
    const _0x5a88d0 = new THREE.MeshStandardMaterial({
      color: 2042167,
      metalness: 0.12,
      roughness: 0.92
    });
    const _0x5b054e = new THREE.MeshStandardMaterial({
      color: 9147550,
      metalness: 0.08,
      roughness: 0.92
    });
    const _0x2c9961 = new THREE.MeshStandardMaterial({
      color: 1332013,
      metalness: 0.6,
      roughness: 0.35
    });
    const _0x4ba6aa = (_0x2b1095, _0x17c557, _0x426224, _0x1969c0) => {
      const _0x467d33 = new THREE.Group();
      
      const _0x538e87 = this.materials.ironPump;
      const _0x3594e8 = this.materials.aluminum;
      const motorBodyMat = _0x1969c0
        ? this.materials.pumpMotor
        : new THREE.MeshStandardMaterial({ color: 0x065f46, metalness: 0.6, roughness: 0.35 });
      const _0x3f65fe = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.78, roughness: 0.38 });
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.12, roughness: 0.92 });
      const couplingMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.4, roughness: 0.3 });

      // 1. Skid Base
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.13, 1.55), baseMat);
      skid.position.set(0, 0.065, -0.08);
      skid.castShadow = skid.receiveShadow = true;
      _0x467d33.add(skid);

      [-0.23, 0.23].forEach(bx => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.022, 1.52), _0x3594e8);
        rail.position.set(bx, 0.152, -0.08);
        _0x467d33.add(rail);
        const webL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.062, 1.52), _0x3594e8);
        webL.position.set(bx, 0.122, -0.08);
        _0x467d33.add(webL);
      });

      [[-0.25, -0.58], [-0.25, 0.43], [0.25, -0.58], [0.25, 0.43]].forEach(([fx, fz]) => {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.068, 12), _0x3594e8);
        pad.position.set(fx, 0.034, fz);
        _0x467d33.add(pad);
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.09, 8), _0x3594e8);
        bolt.position.set(fx, 0.045, fz);
        _0x467d33.add(bolt);
      });

      // 2. Pump Volute
      const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.235, 0.27, 28), _0x3f65fe);
      volute.rotation.x = Math.PI / 2;
      volute.position.set(0, 0.35, 0.24);
      volute.castShadow = true;
      _0x467d33.add(volute);

      const volutePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.022, 28), _0x3f65fe);
      volutePlate.rotation.x = Math.PI / 2;
      volutePlate.position.set(0, 0.35, 0.375);
      _0x467d33.add(volutePlate);

      const backPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.205, 0.028, 24), _0x3f65fe);
      backPlate.rotation.x = Math.PI / 2;
      backPlate.position.set(0, 0.35, 0.098);
      _0x467d33.add(backPlate);

      // Volute braces
      [-0.1, 0.12].forEach(bz => {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.085, 0.062), _0x3594e8);
        brace.position.set(0, 0.215, 0.24 + bz);
        _0x467d33.add(brace);
      });

      // Drain/purge port
      const drainPort = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.042, 8), _0x3594e8);
      drainPort.rotation.z = Math.PI / 2;
      drainPort.position.set(0.255, 0.195, 0.24);
      _0x467d33.add(drainPort);

      // Impeller hub bolts (visible through face plate)
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const boltHole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.038, 6), _0x3594e8);
        boltHole.rotation.x = Math.PI / 2;
        boltHole.position.set(Math.cos(angle) * 0.238, 0.35 + Math.sin(angle) * 0.238, 0.395);
        _0x467d33.add(boltHole);
      }

      // Suction stub (top)
      const suctionStub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3), _0x3f65fe);
      suctionStub.position.set(0, 0.695, 0.3);
      _0x467d33.add(suctionStub);

      const suctionFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.124, 0.124, 0.02, 14), _0x3594e8);
      suctionFlange.position.set(0, 0.85, 0.3);
      _0x467d33.add(suctionFlange);

      // Suction inlet (horizontal)
      const suctionInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.078, 0.095, 14), _0x3f65fe);
      suctionInlet.rotation.x = Math.PI / 2;
      suctionInlet.position.set(0, 0.32, 0.615);
      _0x467d33.add(suctionInlet);

      const suctionRubber = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.078, 14), baseMat);
      suctionRubber.rotation.x = Math.PI / 2;
      suctionRubber.position.set(0, 0.32, 0.713);
      _0x467d33.add(suctionRubber);

      const suctionConnFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.065, 16), _0x3594e8);
      suctionConnFlange.rotation.x = Math.PI / 2;
      suctionConnFlange.position.set(0, 0.32, 0.812);
      _0x467d33.add(suctionConnFlange);

      // 3. Bearing housing between pump and coupling
      const bearingHsg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.19, 18), _0x3594e8);
      bearingHsg.rotation.x = Math.PI / 2;
      bearingHsg.position.set(0, 0.35, -0.225);
      _0x467d33.add(bearingHsg);

      const bearingCap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.042, 8), _0x3594e8);
      bearingCap1.rotation.x = Math.PI / 2;
      bearingCap1.position.set(0, 0.35, -0.195);
      _0x467d33.add(bearingCap1);

      const bearingCap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.042, 8), _0x3594e8);
      bearingCap2.rotation.x = Math.PI / 2;
      bearingCap2.position.set(0, 0.35, -0.258);
      _0x467d33.add(bearingCap2);

      // 4. Coupling Safety Guard
      const couplingGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.026, 12), _0x3594e8);
      couplingGuard.rotation.x = Math.PI / 2;
      couplingGuard.position.set(0, 0.35, -0.225);
      _0x467d33.add(couplingGuard);

      const couplingHub = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.038, 16), _0x3594e8);
      couplingHub.rotation.x = Math.PI / 2;
      couplingHub.position.set(0, 0.35, 0.122);
      _0x467d33.add(couplingHub);

      const couplingShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.055, 8), _0x3594e8);
      couplingShaft.position.set(0, 0.455, 0.012);
      _0x467d33.add(couplingShaft);

      // Yellow coupling spider
      const spider = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), couplingMat);
      spider.rotation.x = Math.PI / 2;
      spider.position.set(0, 0.35, -0.118);
      _0x467d33.add(spider);

      // 5. Motor Barrel
      const motorBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.52, 20), motorBodyMat);
      motorBarrel.rotation.x = Math.PI / 2;
      motorBarrel.position.set(0, 0.35, -0.555);
      motorBarrel.castShadow = true;
      _0x467d33.add(motorBarrel);

      // Motor cooling fins
      for (let r = 0; r < 10; r++) {
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20), motorBodyMat);
        rib.rotation.x = Math.PI / 2;
        rib.position.set(0, 0.35, -0.308 - r * 0.048);
        _0x467d33.add(rib);
      }

      // Motor end flanges
      const mFlange1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.052, 20), _0x3594e8);
      mFlange1.rotation.x = Math.PI / 2;
      mFlange1.position.set(0, 0.35, -0.306);
      _0x467d33.add(mFlange1);

      const mFlange2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.052, 20), _0x3594e8);
      mFlange2.rotation.x = Math.PI / 2;
      mFlange2.position.set(0, 0.35, -0.803);
      _0x467d33.add(mFlange2);

      // Fan shroud and fan end
      const fanShroudEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.14, 20),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.5, roughness: 0.55 }));
      fanShroudEnd.rotation.x = Math.PI / 2;
      fanShroudEnd.position.set(0, 0.35, -0.9);
      _0x467d33.add(fanShroudEnd);

      const fanEndFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.153, 0.013, 20),
        new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.55, roughness: 0.5 }));
      fanEndFlange.rotation.x = Math.PI / 2;
      fanEndFlange.position.set(0, 0.35, -0.833);
      _0x467d33.add(fanEndFlange);

      // Junction Box
      const jBox = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.095, 0.17), _0x3594e8);
      jBox.position.set(0, 0.513, -0.555);
      _0x467d33.add(jBox);

      const jBoxLid = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.016, 0.175), _0x3594e8);
      jBoxLid.position.set(0, 0.563, -0.555);
      _0x467d33.add(jBoxLid);

      // Conduit
      const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.038, 8), _0x3594e8);
      conduit.position.set(0, 0.53, -0.49);
      _0x467d33.add(conduit);
      const conduitRing = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.007, 8, 12), _0x3594e8);
      conduitRing.position.set(0, 0.558, -0.49);
      _0x467d33.add(conduitRing);

      // VFD indicator (color band on motor)
      const indicatorCol = _0x1969c0 ? 0x3b82f6 : 0x22c55e;
      const indicator = new THREE.Mesh(new THREE.CylinderGeometry(0.154, 0.154, 0.032, 20),
        new THREE.MeshStandardMaterial({ color: indicatorCol, metalness: 0.3, roughness: 0.6 }));
      indicator.rotation.x = Math.PI / 2;
      indicator.position.set(0, 0.35, -0.445);
      _0x467d33.add(indicator);

      // Safety label plate
      const labelPlate = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.058, 0.095),
        new THREE.MeshStandardMaterial({ color: 0xe59419, metalness: 0.3, roughness: 0.7 }));
      labelPlate.position.set(-0.153, 0.35, -0.61);
      _0x467d33.add(labelPlate);

      // 6. Discharge elbow (vertical)
      const dischargeElbow = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.115, 14), _0x3594e8);
      dischargeElbow.position.set(0, 0.93, 0.3);
      _0x467d33.add(dischargeElbow);

      const elbowTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), _0x3594e8);
      elbowTop.position.set(0, 1.01, 0.3);
      _0x467d33.add(elbowTop);

      const dischargeRiser = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.068, 14), baseMat);
      dischargeRiser.position.set(0, 1.082, 0.3);
      _0x467d33.add(dischargeRiser);

      const dischargeFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.065, 14), _0x3594e8);
      dischargeFlange.position.set(0, 1.168, 0.3);
      _0x467d33.add(dischargeFlange);

      // Discharge stub/tee
      const dischStub = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.19, 8), _0x3594e8);
      dischStub.rotation.z = Math.PI / 2;
      dischStub.position.set(0.112, 1.168, 0.3);
      _0x467d33.add(dischStub);

      const dischTeeRing = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.011, 8, 14), _0x3594e8);
      dischTeeRing.rotation.y = Math.PI / 2;
      dischTeeRing.position.set(0.24, 1.168, 0.3);
      _0x467d33.add(dischTeeRing);

      // 7. Mini pressure gauges (canvas)
      const makeGauge = (x, y, z, rotY, val01) => {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = rotY;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), _0x3594e8);
        stem.position.y = 0.045; g.add(stem);
        const gc = document.createElement("canvas");
        gc.width = 64; gc.height = 64;
        const gCtx = gc.getContext("2d");
        gCtx.fillStyle = "#fff"; gCtx.fillRect(0, 0, 64, 64);
        gCtx.strokeStyle = "#000"; gCtx.lineWidth = 3;
        gCtx.beginPath(); gCtx.arc(32, 32, 28, 0, Math.PI * 2); gCtx.stroke();
        const angle = Math.PI * 0.75 + val01 * Math.PI * 1.5;
        gCtx.strokeStyle = "#ef4444"; gCtx.lineWidth = 3;
        gCtx.beginPath(); gCtx.moveTo(32, 32);
        gCtx.lineTo(32 + Math.cos(angle) * 22, 32 + Math.sin(angle) * 22); gCtx.stroke();
        const gFace = new THREE.Mesh(new THREE.CircleGeometry(0.033, 16),
          new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc) }));
        gFace.position.set(0.034, 0.1, 0); gFace.rotation.y = Math.PI / 2; g.add(gFace);
        const gCase = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.023, 10),
          new THREE.MeshStandardMaterial({ color: 0xcab08a, metalness: 0.5 }));
        gCase.rotation.z = Math.PI / 2; gCase.position.set(0.012, 0.1, 0); g.add(gCase);
        return g;
      };

      _0x467d33.add(makeGauge(-0.115, 0.415, 0.73, Math.PI / 3, 0.35));
      _0x467d33.add(makeGauge(0.115, 0.795, 0.3, -Math.PI / 2, 0.72));

      _0x467d33.position.set(_0x2b1095, 0, _0x17c557);

      registerNozzleAnchor(_0x426224, "Suction_In", _0x467d33, [0, 0.32, 0.88], [0, 0, 1]);
      registerNozzleAnchor(_0x426224, "Discharge_Out", _0x467d33, [0, 1.18, 0.3], [0, 1, 0]);

      const _0x309b16 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.35, 1.65),
        new THREE.MeshBasicMaterial({ visible: false }));
      _0x309b16.position.y = 0.65;
      _0x309b16.userData = { type: "Pump", name: _0x426224 };
      _0x467d33.add(_0x309b16);
      this.interactables.push(_0x309b16);
      this.scene.add(_0x467d33);
    };
    _0x4ba6aa(-6.5, -7, "CHWP-01", true);
    _0x4ba6aa(-5, -7, "CHWP-02", true);
    _0x4ba6aa(-3.5, -7, "CHWP-03", true);
    _0x4ba6aa(1.5, -7, "CWP-01", false);
    _0x4ba6aa(3, -7, "CWP-02", false);
    _0x4ba6aa(4.5, -7, "CWP-03", false);
    const _0xec8aca = new THREE.MeshStandardMaterial({
      color: 1981066,
      metalness: 0.72,
      roughness: 0.32
    });
    const _0x437fc2 = new THREE.MeshStandardMaterial({
      color: 13358561,
      metalness: 0.86,
      roughness: 0.2
    });
    const _0x1c12dd = new THREE.MeshStandardMaterial({
      color: 3621201,
      metalness: 0.88,
      roughness: 0.22
    });
    const _0x294b13 = new THREE.MeshStandardMaterial({
      color: 1920728,
      metalness: 0.7,
      roughness: 0.3
    });
    const _0x271341 = new THREE.MeshStandardMaterial({
      color: 1013358,
      metalness: 0.7,
      roughness: 0.3
    });
    const _0x37fcbd = (_0x45eb1c, _0xc48f44) => {
      const _0x2528f4 = new THREE.Group();
      [0.46, -0.46].forEach(_0x2614f0 => {
        const _0x3f0ee2 = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.052, 0.22), _0x1c12dd);
        _0x3f0ee2.position.set(0, 0.026, _0x2614f0);
        _0x2528f4.add(_0x3f0ee2);
        [-0.26, 0.26].forEach(_0x2416f5 => {
          const _0x5c6e8e = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 8), _0x1c12dd);
          _0x5c6e8e.position.set(_0x2416f5, -0.05, _0x2614f0);
          _0x2528f4.add(_0x5c6e8e);
        });
      });
      const _0x526514 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.46, 0.11), _0xec8aca);
      _0x526514.position.set(0, 0.78, 0.49);
      _0x2528f4.add(_0x526514);
      for (let _0x2b9ea6 = 0; _0x2b9ea6 < 3; _0x2b9ea6++) {
        const _0x5bbfb7 = new THREE.Mesh(new THREE.BoxGeometry(0.036, 1.28, 0.04), _0xec8aca);
        _0x5bbfb7.position.set(-0.27 + _0x2b9ea6 * 0.27, 0.78, 0.486);
        _0x2528f4.add(_0x5bbfb7);
      }
      const _0xf852bf = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.46, 0.09), _0xec8aca);
      _0xf852bf.position.set(0, 0.78, -0.49);
      _0x2528f4.add(_0xf852bf);
      const _0x4dcd8a = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.3, 0.82), _0x437fc2);
      _0x4dcd8a.position.set(0, 0.78, 0);
      _0x2528f4.add(_0x4dcd8a);
      for (let _0x5da98e = 0; _0x5da98e < 13; _0x5da98e++) {
        const _0x2a9080 = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.013, 0.84), new THREE.MeshStandardMaterial({
          color: 9741240,
          metalness: 0.88,
          roughness: 0.18
        }));
        _0x2a9080.position.set(0, 0.09 + _0x5da98e * 0.11, 0);
        _0x2528f4.add(_0x2a9080);
      }
      for (let _0x597151 = 0; _0x597151 < 8; _0x597151++) {
        const _0x45bda7 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 1.28, 0.84), new THREE.MeshStandardMaterial({
          color: 1710638,
          metalness: 0.1,
          roughness: 0.9
        }));
        _0x45bda7.position.set(-0.3 + _0x597151 * 0.085, 0.78, 0);
        _0x2528f4.add(_0x45bda7);
      }
      const _0x43d7cf = new THREE.BoxGeometry(0.052, 0.052, 1.1);
      [-0.38, 0.38].forEach(_0x577b32 => {
        const _0x32a8e4 = new THREE.Mesh(_0x43d7cf, _0x1c12dd);
        _0x32a8e4.position.set(_0x577b32, 1.6, 0);
        _0x2528f4.add(_0x32a8e4);
        const _0x78d262 = new THREE.Mesh(_0x43d7cf, _0x1c12dd);
        _0x78d262.position.set(_0x577b32, 0.03, 0);
        _0x2528f4.add(_0x78d262);
      });
      [[-0.31, 0.22], [-0.31, 1.34], [0.31, 0.22], [0.31, 1.34]].forEach(([_0x11f58c, _0x42fa3]) => {
        const _0x1fe8f0 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 10), _0x1c12dd);
        _0x1fe8f0.rotation.x = Math.PI / 2;
        _0x1fe8f0.position.set(_0x11f58c, _0x42fa3, 0);
        _0x2528f4.add(_0x1fe8f0);
        [0.51, -0.51].forEach(_0x310adf => {
          const _0x33913d = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.052, 6), _0x1c12dd);
          _0x33913d.rotation.x = Math.PI / 2;
          _0x33913d.position.set(_0x11f58c, _0x42fa3, _0x310adf);
          _0x2528f4.add(_0x33913d);
        });
      });
      [{
        p: [-0.2, 1.12, 0.55],
        m: _0x294b13
      }, {
        p: [-0.2, 0.44, 0.55],
        m: _0x294b13
      }, {
        p: [0.2, 1.12, 0.55],
        m: _0x271341
      }, {
        p: [0.2, 0.44, 0.55],
        m: _0x271341
      }].forEach(({
        p: [_0x22e42f, _0x474c14, _0x3d0fc1],
        m: _0x36d6c4
      }) => {
        const _0x5c0232 = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.18, 12), _0x36d6c4);
        _0x5c0232.rotation.x = Math.PI / 2;
        _0x5c0232.position.set(_0x22e42f, _0x474c14, _0x3d0fc1 + 0.09);
        _0x2528f4.add(_0x5c0232);
        const _0x383de0 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.024, 12), _0x36d6c4);
        _0x383de0.rotation.x = Math.PI / 2;
        _0x383de0.position.set(_0x22e42f, _0x474c14, _0x3d0fc1 + 0.19);
        _0x2528f4.add(_0x383de0);
        for (let _0xb2e11e = 0; _0xb2e11e < 8; _0xb2e11e++) {
          const _0x99d39a = _0xb2e11e / 8 * Math.PI * 2;
          const _0x4bc3ab = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.046, 6), _0x1c12dd);
          _0x4bc3ab.rotation.x = Math.PI / 2;
          _0x4bc3ab.position.set(_0x22e42f + Math.cos(_0x99d39a) * 0.068, _0x474c14 + Math.sin(_0x99d39a) * 0.068, _0x3d0fc1 + 0.19);
          _0x2528f4.add(_0x4bc3ab);
        }
      });
      const _0x3e0813 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.092, 0.009), new THREE.MeshStandardMaterial({
        color: 16498468,
        metalness: 0.6,
        roughness: 0.4
      }));
      _0x3e0813.position.set(0, 0.78, 0.552);
      _0x2528f4.add(_0x3e0813);
      _0x2528f4.position.set(_0x45eb1c, 0, _0xc48f44);
      registerNozzleAnchor("PHX-01", "CHWS_In", _0x2528f4, [-0.2, 1.12, 0.74], [0, 0, 1]);
      registerNozzleAnchor("PHX-01", "CHWR_Out", _0x2528f4, [-0.2, 0.44, 0.74], [0, 0, 1]);
      registerNozzleAnchor("PHX-01", "CWS_In", _0x2528f4, [0.2, 1.12, 0.74], [0, 0, 1]);
      registerNozzleAnchor("PHX-01", "CWR_Out", _0x2528f4, [0.2, 0.44, 0.74], [0, 0, 1]);
      const _0x58debe = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.6, 1.28), new THREE.MeshBasicMaterial({
        visible: false
      }));
      _0x58debe.position.y = 0.78;
      _0x58debe.userData = {
        type: "PHX",
        name: "Plate Heat Exchanger (PHX-01)"
      };
      _0x2528f4.add(_0x58debe);
      this.interactables.push(_0x58debe);
      this.scene.add(_0x2528f4);
    };
    _0x37fcbd(7.5, -9);
    // ================================================================
    // PRIMARY PIPING NETWORK — CENTRAL AISLE PIPE RACK DESIGN
    // 4 headers horizontal side-by-side on common supports above central aisle.
    // All at y=4.5, z-spaced 0.4m apart: CHWR=-3.4, CHWS=-3.8, CWR=-4.2, CWS=-4.6
    // ================================================================
    this.scene.updateMatrixWorld(true);

    const HR = {
      CHWR: { y: 4.5, z: -3.4, xMin: -12.0, xMax: 8.5, mat: this.materials.pipeCHWR, r: 0.17 },
      CHWS: { y: 4.5, z: -3.8, xMin: -12.0, xMax: 8.5, mat: this.materials.pipeCHWS, r: 0.17 },
      CWR:  { y: 4.5, z: -4.2, xMin: -7.5, xMax: 8.5, mat: this.materials.pipeCWR,  r: 0.14 },
      CWS:  { y: 4.5, z: -4.6, xMin: -7.5, xMax: 8.5, mat: this.materials.pipeCWS,  r: 0.14 },
    };
    const BR = 0.10;
    const pipe = (pts, mat, r = BR, flowType = "main") => _0xf475aa(pts, mat, r, flowType);



    // ── Main headers (horizontal, side-by-side on common rack) ───────
    Object.values(HR).forEach(h => {
      pipe([[h.xMin, h.y, h.z], [h.xMax, h.y, h.z]], h.mat, h.r);
    });

    // ── Chillers → Headers ─────────────────────────────────────────────
    // Spaced vertical risers horizontally in X, and elevated branches to y=5.1 to bypass walkway headers!
    [
      { id: "CH-01", rxWS: -6.12, rxWR: -6.32, rxCWS: -6.52, rxCWR: -6.72 },
      { id: "CH-02", rxWS:  1.88, rxWR:  1.68, rxCWS:  1.48, rxCWR:  1.28 },
    ].forEach(({ id, rxWS, rxWR, rxCWS, rxCWR }) => {
      const a = nozzleAnchors[id];

      // CHWS (Chilled Water Supply): upper nozzle, riser at rxWS, bypass at y=5.1
      const chws = asWorldPoint(a.CHWS_Out);
      pipe([
        chws,
        [rxWS, chws.y, chws.z],
        [rxWS, 5.1, chws.z],
        [rxWS, 5.1, HR.CHWS.z],
        [rxWS, HR.CHWS.y, HR.CHWS.z]
      ], HR.CHWS.mat, BR, "chiller");

      // CHWR (Chilled Water Return): lower nozzle, riser at rxWR, bypass at y=5.1
      const chwr = asWorldPoint(a.CHWR_In);
      pipe([
        [rxWR, HR.CHWR.y, HR.CHWR.z],
        [rxWR, 5.1, HR.CHWR.z],
        [rxWR, 5.1, chwr.z],
        [rxWR, chwr.y, chwr.z],
        chwr
      ], HR.CHWR.mat, BR, "chiller");

      // CWS (Cooling Water Supply): upper nozzle, riser at rxCWS, bypass at y=5.1
      const cws = asWorldPoint(a.CWS_In);
      pipe([
        [rxCWS, HR.CWS.y, HR.CWS.z],
        [rxCWS, 5.1, HR.CWS.z],
        [rxCWS, 5.1, cws.z],
        [rxCWS, cws.y, cws.z],
        cws
      ], HR.CWS.mat, BR, "chiller");

      // CWR (Cooling Water Return): lower nozzle, riser at rxCWR, bypass at y=5.1
      const cwr = asWorldPoint(a.CWR_Out);
      pipe([
        cwr,
        [rxCWR, cwr.y, cwr.z],
        [rxCWR, 5.1, cwr.z],
        [rxCWR, 5.1, HR.CWR.z],
        [rxCWR, HR.CWR.y, HR.CWR.z]
      ], HR.CWR.mat, BR, "chiller");
    });

    // ── CHW Pumps (CHWP) ─────────────────────────────────────────────
    // Suction manifold at y=2.5, z=-5.5 (south of pump nozzles at z=-6.12).
    // Feed leg drops from CHWR header west end (x=-7.0) down to manifold.
    // Discharge rises from pump then sweeps south to CHWS header.
    const CHWP_MAN_Y = 2.5, CHWP_MAN_Z = -5.5;
    pipe([
      [-7.0, HR.CHWR.y, HR.CHWR.z],
      [-7.0, 3.9, HR.CHWR.z],
      [-7.0, 3.9, CHWP_MAN_Z],
      [-7.0, CHWP_MAN_Y, CHWP_MAN_Z],
      [-3.0, CHWP_MAN_Y, CHWP_MAN_Z],
    ], HR.CHWR.mat);

    ["CHWP-01", "CHWP-02", "CHWP-03"].forEach(id => {
      const a = nozzleAnchors[id];
      const s = asWorldPoint(a.Suction_In);
      const d = asWorldPoint(a.Discharge_Out);
      pipe([[s.x, CHWP_MAN_Y, CHWP_MAN_Z], [s.x, s.y, CHWP_MAN_Z], [s.x, s.y, s.z]], HR.CHWR.mat);
      pipe([
        d,
        [d.x, 3.9, d.z],
        [d.x, 3.9, HR.CHWS.z],
        [d.x, HR.CHWS.y, HR.CHWS.z]
      ], HR.CHWS.mat);
    });

    // ── CW Pumps (CWP) ──────────────────────────────────────────────
    // Suction manifold at y=2.5, z=-5.5 fed from CWS header east end (x=5.5).
    // Discharge rises then sweeps south to CWR header.
    const CWP_MAN_Y = 2.5, CWP_MAN_Z = -5.5;
    pipe([
      [5.5, HR.CWS.y, HR.CWS.z],
      [5.5, HR.CWS.y, CWP_MAN_Z],
      [5.5, CWP_MAN_Y, CWP_MAN_Z],
      [1.2, CWP_MAN_Y, CWP_MAN_Z],
    ], HR.CWS.mat);

    ["CWP-01", "CWP-02", "CWP-03"].forEach(id => {
      const a = nozzleAnchors[id];
      const s = asWorldPoint(a.Suction_In);
      const d = asWorldPoint(a.Discharge_Out);
      pipe([[s.x, CWP_MAN_Y, CWP_MAN_Z], [s.x, s.y, CWP_MAN_Z], [s.x, s.y, s.z]], HR.CWS.mat);
      pipe([
        d,
        [d.x, 3.9, d.z],
        [d.x, 3.9, HR.CWR.z],
        [d.x, HR.CWR.y, HR.CWR.z]
      ], HR.CWR.mat);
    });

    // ── Cooling Towers — outdoor headers + individual CT branches ─────
    // Two outdoor headers side-by-side at same height y = 8.3:
    //   CWR outdoor: y = 8.3, z = -14.0
    //   CWS outdoor: y = 8.3, z = -14.6
    // Separate risers climb the back wall: CWR at x=-0.5, CWS at x=0.5
    const CT_ROOF_Y = 10.8;
    const CT_HDR_Y = 8.3;
    const CT_OUT_CWR_Z = -14.0;
    const CT_OUT_CWS_Z = -14.6;

    // CWR indoor→outdoor riser
    // Rises at x=-0.5, runs under the headers at y=3.9 to z=-13, then climbs directly to outdoor header at y=8.3
    pipe([
      [-0.5, HR.CWR.y, HR.CWR.z],
      [-0.5, 3.9, HR.CWR.z],
      [-0.5, 3.9, -13],
      [-0.5, CT_HDR_Y, -13],
      [-0.5, CT_HDR_Y, CT_OUT_CWR_Z],
    ], HR.CWR.mat);
    // CWR outdoor header (extended to include Sand Filter SF-01, Dosing Skid DS-01, and FC-HX-01)
    pipe([[-6.5, CT_HDR_Y, CT_OUT_CWR_Z], [8.5, CT_HDR_Y, CT_OUT_CWR_Z]], HR.CWR.mat, HR.CWR.r);

    // CWS outdoor→indoor riser
    // Starts at CWS outdoor header, goes up to y=9.3 to bypass CWR header, runs along roof to z=-13, then drops directly to y=4.5
    pipe([
      [0.5, CT_HDR_Y, CT_OUT_CWS_Z],
      [0.5, 9.3, CT_OUT_CWS_Z],
      [0.5, 9.3, -13],
      [0.5, HR.CWS.y, -13],
      [0.5, HR.CWS.y, HR.CWS.z],
    ], HR.CWS.mat);
    // CWS outdoor header (extended to include Sand Filter SF-01, Dosing Skid DS-01, and FC-HX-01)
    pipe([[-6.5, CT_HDR_Y, CT_OUT_CWS_Z], [8.5, CT_HDR_Y, CT_OUT_CWS_Z]], HR.CWS.mat, HR.CWS.r);

    // Individual CT branches from outdoor headers
    [
      { id: "CT-01", ctX: -3.5 },
      { id: "CT-02", ctX:  1.0 },
    ].forEach(({ id, ctX }) => {
      const a = nozzleAnchors[id];
      const cwrN = asWorldPoint(a.CWR_In);   // world: (ctX, 10.3, -15.4)
      const cwsN = asWorldPoint(a.CWS_Out);  // world: (ctX,  8.3, -15.4)

      // CWR: from CWR outdoor header, rises to 10.3 and runs horizontally to CT nozzle
      pipe([[ctX, CT_HDR_Y, CT_OUT_CWR_Z], [ctX, 10.3, CT_OUT_CWR_Z], cwrN], HR.CWR.mat);
      // CWS: CT nozzle straight along Z out to CWS outdoor header
      pipe([cwsN, [ctX, CT_HDR_Y, CT_OUT_CWS_Z]], HR.CWS.mat);
    });

    // ── Sand Filter & Chemical Dosing Skid Piping Connections ───────────
    // 1. Sand Filter Side-stream loop (Bypass filter water loop)
    // CWS Inlet from CWS header to pump inlet
    pipe([
      [-6.37, 8.3, -14.6],
      [-5.78, 8.3, -14.6],
      [-5.78, 8.3, -17.2],
      [-5.78, 8.2, -17.2]
    ], HR.CWS.mat, 0.032);

    // CWR Outlet from Sand Filter top riser to CWR header
    pipe([
      [-6.07, 8.95, -17.7],
      [-6.07, 8.95, -14.0],
      [-6.07, 8.3, -14.0]
    ], HR.CWR.mat, 0.032);

    // 2. Chemical Dosing Capillary Injection Tubes
    // Biocide tube from Pump 1 (left) into CWR header
    pipe([
      [4.88, 8.855, -16.18],
      [4.88, 8.95, -16.18],
      [4.88, 8.95, -14.0],
      [4.88, 8.38, -14.0]
    ], this.materials.copper, 0.008);

    // Inhibitor tube from Pump 2 (right) into CWR header
    pipe([
      [5.52, 8.855, -16.18],
      [5.52, 8.95, -16.18],
      [5.52, 8.95, -14.0],
      [5.52, 8.38, -14.0]
    ], this.materials.copper, 0.008);

    // Injection connection nozzles
    [4.88, 5.52].forEach(cx => {
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), this.materials.copper);
      stub.position.set(cx, 8.34, -14.0);
      this.scene.add(stub);
    });

    // ── Plate Heat Exchanger (PHX-01) ──────────────────────────────────
    // PHX at x=7.5, z=-9. Nozzles face +Z at world z=-8.26.
    // Run branch lines horizontally under headers at y=3.9, and connect vertically from below!
    {
      const phx = nozzleAnchors["PHX-01"];

      // CHWS (Chilled Water Supply): upper nozzle at x=7.3, y=1.12
      const chws_n = asWorldPoint(phx.CHWS_In);
      pipe([
        [chws_n.x, HR.CHWS.y, HR.CHWS.z],
        [7.15, HR.CHWS.y, HR.CHWS.z],
        [7.15, 3.9, HR.CHWS.z],
        [7.15, 3.9, -8.11],
        [7.15, chws_n.y, -8.11],
        chws_n
      ], HR.CHWS.mat);

      // CHWR (Chilled Water Return): lower nozzle at x=7.3, y=0.44
      const chwr_n = asWorldPoint(phx.CHWR_Out);
      pipe([
        chwr_n,
        [6.90, chwr_n.y, -7.86],
        [6.90, 3.9, -7.86],
        [6.90, 3.9, HR.CHWR.z],
        [6.90, HR.CHWR.y, HR.CHWR.z]
      ], HR.CHWR.mat);

      // CWS (Cooling Water Supply) and CWR (Cooling Water Return) branch lines removed per user request:
      // "然後版熱 幫我取消深綠淺綠那兩隻 正常設計不會再連回冷卻水系統"
      /*
      // CWS (Cooling Water Supply): upper nozzle at x=7.7, y=1.12
      const cws_n = asWorldPoint(phx.CWS_In);
      pipe([
        [cws_n.x, HR.CWS.y, HR.CWS.z],
        [7.85, HR.CWS.y, HR.CWS.z],
        [7.85, 3.9, HR.CWS.z],
        [7.85, 3.9, -8.11],
        [7.85, cws_n.y, -8.11],
        cws_n
      ], HR.CWS.mat);

      // CWR (Cooling Water Return): lower nozzle at x=7.7, y=0.44
      const cwr_n = asWorldPoint(phx.CWR_Out);
      pipe([
        cwr_n,
        [8.10, cwr_n.y, -7.86],
        [8.10, 3.9, -7.86],
        [8.10, 3.9, HR.CWR.z],
        [8.10, HR.CWR.y, HR.CWR.z]
      ], HR.CWR.mat);
      */
    }
        const _0x1c43ac = document.createElement("canvas");
    _0x1c43ac.width = 256;
    _0x1c43ac.height = 64;
    const _0x3addd6 = _0x1c43ac.getContext("2d");
    _0x3addd6.fillStyle = "rgba(8, 12, 20, 0.85)";
    _0x3addd6.beginPath();
    _0x3addd6.roundRect(0, 0, 256, 64, 12);
    _0x3addd6.fill();
    _0x3addd6.strokeStyle = "#38bdf8";
    _0x3addd6.lineWidth = 3;
    _0x3addd6.stroke();
    _0x3addd6.fillStyle = "#ffffff";
    _0x3addd6.font = "bold 16px \"Segoe UI\", sans-serif";
    _0x3addd6.textAlign = "center";
    _0x3addd6.textBaseline = "middle";
    _0x3addd6.fillText("↑ 往屋頂冷卻水塔 (Rooftop CT)", 128, 32);
    const _0x27d61b = new THREE.CanvasTexture(_0x1c43ac);
    const _0x3b19f0 = new THREE.SpriteMaterial({
      map: _0x27d61b,
      transparent: true
    });
    const _0x49ff26 = new THREE.Sprite(_0x3b19f0);
    _0x49ff26.position.set(1.75, 5.8, -12.5);
    _0x49ff26.scale.set(3, 0.75, 1);
    this.scene.add(_0x49ff26);
    const _0x8c343d = new THREE.Group();
    _0x8c343d.position.set(-9, 0, -8);
    const _0x321ff3 = new THREE.MeshStandardMaterial({
      color: 12131356,
      metalness: 0.58,
      roughness: 0.42
    });
    const _0x4570bb = new THREE.MeshStandardMaterial({
      color: 3621201,
      metalness: 0.82,
      roughness: 0.3
    });
    const _0x212fc0 = this.materials.aluminum;
    const _0x3d3bc7 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 22, 1, true), _0x4570bb);
    _0x3d3bc7.position.y = 0.3;
    _0x8c343d.add(_0x3d3bc7);
    const _0x43ce8f = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 22), _0x4570bb);
    _0x43ce8f.position.y = 0.025;
    _0x8c343d.add(_0x43ce8f);
    for (let _0x35e3c9 = 0; _0x35e3c9 < 4; _0x35e3c9++) {
      const _0x10df6a = _0x35e3c9 / 4 * Math.PI * 2 + Math.PI / 4;
      const _0x14df0b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 8), _0x4570bb);
      _0x14df0b.position.set(Math.cos(_0x10df6a) * 0.38, 0.05, Math.sin(_0x10df6a) * 0.38);
      _0x8c343d.add(_0x14df0b);
    }
    const _0x28ddb7 = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.018, 8, 22), _0x4570bb);
    _0x28ddb7.rotation.x = Math.PI / 2;
    _0x28ddb7.position.y = 0.6;
    _0x8c343d.add(_0x28ddb7);
    const _0x234cee = 1.375;
    const _0x45daee = 0.36;
    const _0x187314 = 1.55;
    const _0x59dc0d = new THREE.Mesh(new THREE.CylinderGeometry(_0x45daee, _0x45daee, _0x187314, 28), _0x321ff3);
    _0x59dc0d.position.y = _0x234cee;
    _0x59dc0d.castShadow = true;
    _0x8c343d.add(_0x59dc0d);
    const _0x4185ee = new THREE.Mesh(new THREE.SphereGeometry(_0x45daee, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), _0x321ff3);
    _0x4185ee.position.y = _0x234cee + _0x187314 / 2;
    _0x8c343d.add(_0x4185ee);
    const _0x1e4439 = new THREE.Mesh(new THREE.SphereGeometry(_0x45daee, 22, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), _0x321ff3);
    _0x1e4439.rotation.x = Math.PI;
    _0x1e4439.position.y = _0x234cee - _0x187314 / 2;
    _0x8c343d.add(_0x1e4439);
    const _0x8e76 = new THREE.TorusGeometry(_0x45daee + 0.005, 0.013, 8, 28);
    [_0x234cee + _0x187314 / 2, _0x234cee - _0x187314 / 2].forEach(_0x397077 => {
      const _0x53321d = new THREE.Mesh(_0x8e76, _0x4570bb);
      _0x53321d.rotation.x = Math.PI / 2;
      _0x53321d.position.y = _0x397077;
      _0x8c343d.add(_0x53321d);
    });
    const _0x14d38d = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 12), _0x4570bb);
    _0x14d38d.rotation.x = Math.PI / 2;
    _0x14d38d.position.set(0, 0.82, _0x45daee + 0.11);
    _0x8c343d.add(_0x14d38d);
    const _0x37888a = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.022, 12), _0x4570bb);
    _0x37888a.rotation.x = Math.PI / 2;
    _0x37888a.position.set(0, 0.82, _0x45daee + 0.236);
    _0x8c343d.add(_0x37888a);
    const _0x1c8996 = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.092, 0.115), _0x4570bb);
    _0x1c8996.position.set(0, 0.82, _0x45daee + 0.315);
    _0x8c343d.add(_0x1c8996);
    const _0x48c8c9 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), _0x4570bb);
    _0x48c8c9.position.set(0, 0.916, _0x45daee + 0.315);
    _0x8c343d.add(_0x48c8c9);
    const _0x42d60e = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.016, 0.016), _0x4570bb);
    _0x42d60e.position.set(0, 0.971, _0x45daee + 0.315);
    _0x8c343d.add(_0x42d60e);
    const _0xb8e62d = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.13, 10), _0x4570bb);
    _0xb8e62d.rotation.z = Math.PI / 2;
    _0xb8e62d.position.set(_0x45daee + 0.065, 1.95, 0);
    _0x8c343d.add(_0xb8e62d);
    const _0xa7d5e8 = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.04, 0.14, 12), _0x4570bb);
    _0xa7d5e8.rotation.z = Math.PI / 2;
    _0xa7d5e8.position.set(_0x45daee + 0.165, 1.95, 0);
    _0x8c343d.add(_0xa7d5e8);
    const _0x21798d = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 12), _0x212fc0);
    _0x21798d.rotation.z = Math.PI / 2;
    _0x21798d.position.set(_0x45daee + 0.258, 1.95, 0);
    _0x8c343d.add(_0x21798d);
    const _0x549405 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.015), _0x4570bb);
    _0x549405.position.set(_0x45daee + 0.21, 2.002, 0);
    _0x8c343d.add(_0x549405);
    const _0x112784 = _0x234cee + _0x187314 / 2 + _0x45daee;
    const _0x38fdc8 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10), _0x4570bb);
    _0x38fdc8.position.set(0, _0x112784 + 0.05, 0);
    _0x8c343d.add(_0x38fdc8);
    const _0x470084 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.036, 8), _0x212fc0);
    _0x470084.position.set(0, _0x112784 + 0.12, 0);
    _0x8c343d.add(_0x470084);
    const _0x54dc93 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10), _0x4570bb);
    _0x54dc93.rotation.z = Math.PI / 2;
    _0x54dc93.position.set(_0x45daee + 0.04, 1.65, 0.07);
    _0x8c343d.add(_0x54dc93);
    const _0x241348 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.048, 16), _0x212fc0);
    _0x241348.rotation.z = Math.PI / 2;
    _0x241348.position.set(_0x45daee + 0.088, 1.65, 0.07);
    _0x8c343d.add(_0x241348);
    const _0x168a43 = document.createElement("canvas");
    _0x168a43.width = 128;
    _0x168a43.height = 128;
    const _0x1c1911 = _0x168a43.getContext("2d");
    _0x1c1911.fillStyle = "#ffffff";
    _0x1c1911.beginPath();
    _0x1c1911.arc(64, 64, 60, 0, Math.PI * 2);
    _0x1c1911.fill();
    _0x1c1911.strokeStyle = "#000";
    _0x1c1911.lineWidth = 2.5;
    _0x1c1911.beginPath();
    _0x1c1911.arc(64, 64, 54, Math.PI * 0.75, Math.PI * 2.25);
    _0x1c1911.stroke();
    for (let _0x409fb9 = 0; _0x409fb9 < 11; _0x409fb9++) {
      const _0x384980 = Math.PI * 0.75 + _0x409fb9 / 10 * Math.PI * 1.5;
      _0x1c1911.strokeStyle = "#000";
      _0x1c1911.lineWidth = _0x409fb9 % 5 === 0 ? 2.5 : 1.5;
      _0x1c1911.beginPath();
      _0x1c1911.moveTo(64 + Math.cos(_0x384980) * 46, 64 + Math.sin(_0x384980) * 46);
      _0x1c1911.lineTo(64 + Math.cos(_0x384980) * (_0x409fb9 % 5 === 0 ? 53 : 50), 64 + Math.sin(_0x384980) * (_0x409fb9 % 5 === 0 ? 53 : 50));
      _0x1c1911.stroke();
    }
    _0x1c1911.strokeStyle = "#ef4444";
    _0x1c1911.lineWidth = 6;
    _0x1c1911.beginPath();
    _0x1c1911.arc(64, 64, 50, Math.PI * 1.85, Math.PI * 2.25);
    _0x1c1911.stroke();
    const _0x4179f4 = Math.PI * 0.75 + Math.PI * 0.48 * 1.5;
    _0x1c1911.strokeStyle = "#dc2626";
    _0x1c1911.lineWidth = 4;
    _0x1c1911.beginPath();
    _0x1c1911.moveTo(64, 64);
    _0x1c1911.lineTo(64 + Math.cos(_0x4179f4) * 44, 64 + Math.sin(_0x4179f4) * 44);
    _0x1c1911.stroke();
    _0x1c1911.fillStyle = "#333";
    _0x1c1911.beginPath();
    _0x1c1911.arc(64, 64, 5, 0, Math.PI * 2);
    _0x1c1911.fill();
    const _0x2a4651 = new THREE.CanvasTexture(_0x168a43);
    const _0x5b060f = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshBasicMaterial({
      map: _0x2a4651
    }));
    _0x5b060f.position.set(_0x45daee + 0.116, 1.65, 0.07);
    _0x5b060f.rotation.y = Math.PI / 2;
    _0x8c343d.add(_0x5b060f);
    const _0x387403 = new THREE.Mesh(new THREE.CylinderGeometry(_0x45daee + 0.006, _0x45daee + 0.006, 0.088, 28), new THREE.MeshStandardMaterial({
      color: 16498468,
      metalness: 0.55,
      roughness: 0.38
    }));
    _0x387403.position.y = 1.62;
    _0x8c343d.add(_0x387403);
    const _0x4408fc = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8), _0x4570bb);
    _0x4408fc.rotation.x = Math.PI / 2;
    _0x4408fc.position.set(0, _0x234cee - _0x187314 / 2 + 0.065, _0x45daee + 0.045);
    _0x8c343d.add(_0x4408fc);
    const _0xb58ac = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 8), _0x212fc0);
    _0xb58ac.rotation.x = Math.PI / 2;
    _0xb58ac.position.set(0, _0x234cee - _0x187314 / 2 + 0.065, _0x45daee + 0.1);
    _0x8c343d.add(_0xb58ac);
    const _0x2ba791 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.88, 1.1), new THREE.MeshBasicMaterial({
      visible: false
    }));
    _0x2ba791.position.y = 1.35;
    _0x2ba791.userData = {
      type: "ExpansionTank",
      name: "Pressurized Expansion Tank (500L)"
    };
    _0x8c343d.add(_0x2ba791);
    this.interactables.push(_0x2ba791);
    this.scene.add(_0x8c343d);
    _0xf475aa([
      [-8.64, 0.82, -7.93],
      [-8.25, 0.82, -7.93],
      [-8.25, 1.55, -8.85],
      [-8.25, 5.1,  -8.85],
      [-7.5,  5.1,  -8.85],
      [-7.5,  5.1,  -3.4],
      [-7.5,  4.5,  -3.4],
    ], this.materials.pipeCHWR, 0.06);

    // ══════════════════════════════════════════════════════════════════
    // TES-01  Thermal Energy Storage Tank  (蓄冷冰水槽)
    // Position: (-11.5, 0, -8.0)  — left side of expansion tank indoor, shortest connection to headers
    // ══════════════════════════════════════════════════════════════════
    (() => {
      const tx = -11.5, ty = 0, tz = -8.0;
      const tg = new THREE.Group();
      tg.position.set(tx, ty, tz);

      // --- materials ---
      const tesBodyMat  = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, metalness: 0.55, roughness: 0.45 });
      const tesInsulMat = new THREE.MeshStandardMaterial({ color: 0x0e5f86, metalness: 0.35, roughness: 0.70 });
      const tesFlanMat  = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
      const tesStrapMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.60, roughness: 0.50 });
      const tesGaugeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const tesGaugeNdl = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });

      const R = 0.65, H = 2.6;    // cylinder radius & height
      const midY = H / 2 + R * 0.5; // vertical center including domes

      // 1. Main cylinder body
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 32), tesBodyMat);
      cyl.position.y = midY;
      cyl.castShadow = true;
      tg.add(cyl);

      // 2. Top dome
      const domeTop = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI*2, 0, Math.PI/2), tesBodyMat);
      domeTop.position.y = midY + H / 2;
      domeTop.castShadow = true;
      tg.add(domeTop);

      // 3. Bottom dome
      const domeBot = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2), tesBodyMat);
      domeBot.rotation.x = Math.PI;
      domeBot.position.y = midY - H / 2;
      domeBot.castShadow = true;
      tg.add(domeBot);

      // 4. Insulation bands (5 horizontal straps around the cylinder)
      [0.35, 0.75, 1.30, 1.85, 2.25].forEach(by => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.020, 8, 32), tesStrapMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = by;
        tg.add(band);
      });

      // 5. Support base skirt ring
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.18, 32, 1, true), tesFlanMat);
      skirt.position.y = 0.09;
      tg.add(skirt);

      // 6. Base plate
      const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.06, 32), tesFlanMat);
      basePlate.position.y = 0.03;
      tg.add(basePlate);

      // 7. Flange collars at weld seams
      [midY - H/2, midY + H/2].forEach(fy => {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.025, R + 0.025, 0.045, 32), tesFlanMat);
        flange.position.y = fy;
        tg.add(flange);
      });

      // 8. Top nozzle (CHWS outlet — cold water out)
      const nzTop = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12), tesFlanMat);
      nzTop.position.set(0, midY + H/2 + R + 0.11, 0);
      tg.add(nzTop);
      const nzTopFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.028, 12), tesFlanMat);
      nzTopFlange.position.set(0, midY + H/2 + R + 0.24, 0);
      tg.add(nzTopFlange);

      // 9. Side nozzle (CHWR inlet — warm water in)
      const nzSide = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 12), tesFlanMat);
      nzSide.rotation.z = Math.PI / 2;
      nzSide.position.set(R + 0.12, midY - 0.4, 0);
      tg.add(nzSide);
      const nzSideFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.028, 12), tesFlanMat);
      nzSideFlange.rotation.z = Math.PI / 2;
      nzSideFlange.position.set(R + 0.264, midY - 0.4, 0);
      tg.add(nzSideFlange);

      // 10. Ladder rungs (3 rungs on the right side)
      const rungMat = tesFlanMat;
      [-0.2, -0.65].forEach(railZ => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.018, H * 0.7, 0.018), rungMat);
        rail.position.set(R + 0.08, midY, railZ);
        tg.add(rail);
      });
      [0.5, 1.0, 1.5, 2.0].forEach(ry => {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.5), rungMat);
        rung.position.set(R + 0.08, ry, -0.425);
        tg.add(rung);
      });

      // 11. Pressure gauge on side
      const gaugeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.028, 16), tesGaugeMat);
      gaugeBody.rotation.z = Math.PI / 2;
      gaugeBody.position.set(R + 0.04, midY + 0.3, 0.18);
      tg.add(gaugeBody);
      const gaugeStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 8), tesFlanMat);
      gaugeStem.rotation.z = Math.PI / 2;
      gaugeStem.position.set(R - 0.01, midY + 0.3, 0.18);
      tg.add(gaugeStem);
      // needle
      const gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.008, 0.004), tesGaugeNdl);
      gaugeNeedle.rotation.z = -0.4;
      gaugeNeedle.position.set(R + 0.04, midY + 0.3, 0.168);
      tg.add(gaugeNeedle);

      // 12. Invisible select box
      const tesBox = new THREE.Mesh(
        new THREE.BoxGeometry(R*2 + 0.3, midY + H/2 + R*0.5 + 0.4, R*2 + 0.3),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      tesBox.position.y = (midY + H/2 + R*0.5 + 0.4) / 2;
      tesBox.userData = {
        type: "TESTank",
        name: "Thermal Energy Storage Tank (TES-01)",
        subtitle: "CHILLED WATER TES — 30 m³ / 8,000 GAL"
      };
      tg.add(tesBox);
      this.interactables.push(tesBox);

      this.scene.add(tg);

      // ── TES Piping: left side of expansion tank position ──────────────
      // TES at world (-11.5, 0, -8.0).
      // Connected directly to extended CHWS/CHWR headers (which now go to X=-12.0)
      const tesTopNozzleY = ty + midY + H / 2 + R + 0.22;
      const tesSideNozzleY = ty + midY - 0.4;
      const tesSideNozzleX = tx + R + 0.25;  // east face nozzle

      // CHWS: Top nozzle → rise vertically to high bypass Y=5.1 → run along Z → drop vertically onto CHWS header top
      _0xf475aa([
        [tx,     tesTopNozzleY,  tz],
        [tx,     5.1,            tz],
        [tx,     5.1,            HR.CHWS.z],
        [tx,     HR.CHWS.y,      HR.CHWS.z]
      ], this.materials.pipeCHWS, 0.058);

      // CHWR: Side nozzle ← rise vertically next to tank to high bypass Y=5.1 ← run along Z ← drop vertically from CHWR header top
      _0xf475aa([
        [tesSideNozzleX, HR.CHWR.y,      HR.CHWR.z],
        [tesSideNozzleX, 5.1,            HR.CHWR.z],
        [tesSideNozzleX, 5.1,            tz],
        [tesSideNozzleX, tesSideNozzleY, tz]
      ], this.materials.pipeCHWR, 0.058);

      // Motorized isolation valve on CHWS vertical drop (蓄冷時開關)
      const tValveActMat  = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.55, roughness: 0.35 });
      const tValveBodyMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.80, roughness: 0.30 });
      const tvBody = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.17, 12), tValveBodyMat);
      tvBody.position.set(tx, 4.1, tz);
      this.scene.add(tvBody);
      const tvAct = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15), tValveActMat);
      tvAct.position.set(tx, 4.31, tz);
      this.scene.add(tvAct);
    })();

    // ══════════════════════════════════════════════════════════════════
    // FC-HX-01  Free Cooling Plate Heat Exchanger  (自然冷卻換熱器)
    // Position: (7.5, 0, -12.0)  — north of PHX-01
    // ══════════════════════════════════════════════════════════════════
    (() => {
      const fx = 7.5, fy = 0, fz = -12.0;
      const fg = new THREE.Group();
      fg.position.set(fx, fy, fz);

      // --- materials ---
      const fcFrameMat   = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.30 });
      const fcPlateMat   = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.35 });
      const fcNozzleMat  = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.80, roughness: 0.28 });
      const fcBoltMat    = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.90, roughness: 0.22 });

      // Frame dimensions
      const W = 0.80, H2 = 1.55, D = 1.10;

      // 1. Front clamping plate
      const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(W, H2, 0.06), fcFrameMat);
      frontPlate.position.set(0, H2/2 + 0.06, D/2);
      frontPlate.castShadow = true;
      fg.add(frontPlate);

      // 2. Back clamping plate
      const backPlate = new THREE.Mesh(new THREE.BoxGeometry(W, H2, 0.06), fcFrameMat);
      backPlate.position.set(0, H2/2 + 0.06, -D/2);
      backPlate.castShadow = true;
      fg.add(backPlate);

      // 3. Four guide bars connecting front & back
      [[-W/2 + 0.04, H2 + 0.06], [-W/2 + 0.04, 0.09], [W/2 - 0.04, H2 + 0.06], [W/2 - 0.04, 0.09]].forEach(([bx, by]) => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, D - 0.04, 10), fcFrameMat);
        bar.rotation.x = Math.PI / 2;
        bar.position.set(bx, by, 0);
        fg.add(bar);
      });

      // 4. Heat exchange plate stack (18 corrugated plates)
      for (let p = 0; p < 18; p++) {
        const pz = -D/2 + 0.06 + p * (D - 0.12) / 17;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, H2 - 0.12, 0.018), fcPlateMat);
        plate.position.set(0, H2/2 + 0.06, pz);
        fg.add(plate);
      }

      // 5. Base frame
      const baseLeft  = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, D + 0.1), fcFrameMat);
      baseLeft.position.set(-W/2 + 0.025, 0.06, 0);
      fg.add(baseLeft);
      const baseRight = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, D + 0.1), fcFrameMat);
      baseRight.position.set(W/2 - 0.025, 0.06, 0);
      fg.add(baseRight);

      // 6. Four nozzle stubs + flanges (CHW side top/bot, CW side top/bot)
      const nozzleData = [
        { pos: [W/2 + 0.12, H2 * 0.75,  D/2], rotZ: Math.PI/2, label: 'CHWS' },
        { pos: [W/2 + 0.12, H2 * 0.25,  D/2], rotZ: Math.PI/2, label: 'CHWR' },
        { pos: [W/2 + 0.12, H2 * 0.75, -D/2], rotZ: Math.PI/2, label: 'CWS'  },
        { pos: [W/2 + 0.12, H2 * 0.25, -D/2], rotZ: Math.PI/2, label: 'CWR'  },
      ];
      nozzleData.forEach(nd => {
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.20, 12), fcNozzleMat);
        stub.rotation.z = nd.rotZ;
        stub.position.set(nd.pos[0], nd.pos[1], nd.pos[2]);
        fg.add(stub);
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), fcBoltMat);
        fl.rotation.z = nd.rotZ;
        fl.position.set(nd.pos[0] + 0.12, nd.pos[1], nd.pos[2]);
        fg.add(fl);
      });

      // 7. Label plate
      const labelPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.10, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.9 })
      );
      labelPlate.position.set(0, H2 + 0.15, D/2 + 0.035);
      fg.add(labelPlate);

      // 8. Invisible select box
      const fchxBox = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.55, H2 + 0.4, D + 0.2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      fchxBox.position.set(W/4, (H2 + 0.4)/2, 0);
      fchxBox.userData = {
        type: "FreeCoolingHX",
        name: "Free Cooling Heat Exchanger (FC-HX-01)",
        subtitle: "FREE COOLING PLATE HX — 1,500 kW"
      };
      fg.add(fchxBox);
      this.interactables.push(fchxBox);
      this.scene.add(fg);

      // ── FC-HX-01 Piping ───────────────────────────────────────────────
      // CHW side: animated flow (y=3.9 underpipe) — same as PHX-01
      // CW side: STATIC (solidMat) — normally no flow, only active in Free Cooling mode
      //          Pipes penetrate back wall → connect to outdoor CW header

      const NX   = fx + W/2 + 0.22;   // ~7.92  world nozzle x-tip
      const CHZ  = fz + D/2;           // ~-11.45 CHW face
      const CWZ  = fz - D/2;           // ~-12.55 CW face
      const CHWS_X = 8.15;
      const CHWR_X = 8.40;

      // CHW supply: Header → x-lane → y=3.9 → south → drop to nozzle  (animated flow)
      _0xf475aa([
        [CHWS_X, HR.CHWS.y, HR.CHWS.z],
        [CHWS_X, 3.9,        HR.CHWS.z],
        [CHWS_X, 3.9,        CHZ],
        [CHWS_X, fy + H2 * 0.75, CHZ],
        [NX,     fy + H2 * 0.75, CHZ]
      ], this.materials.pipeCHWS, 0.058);

      // CHW return: nozzle → x-lane → y=3.9 → north → rise to header  (animated flow)
      _0xf475aa([
        [NX,     fy + H2 * 0.25, CHZ],
        [CHWR_X, fy + H2 * 0.25, CHZ],
        [CHWR_X, 3.9,             CHZ],
        [CHWR_X, 3.9,             HR.CHWR.z],
        [CHWR_X, HR.CHWR.y,       HR.CHWR.z]
      ], this.materials.pipeCHWR, 0.058);

      // CW supply (standby): nozzle → thru wall → rise outdoor → CT supply header
      _0xf475aa([
        [NX, fy + H2 * 0.75, CWZ],
        [NX, fy + H2 * 0.75, -14.6],
        [NX, 8.3,             -14.6]
      ], this.materials.pipeCWS, 0.055, "fchx_cw");

      // CW return (standby): CT return header → down thru wall → nozzle
      _0xf475aa([
        [NX, 8.3,             -14.0],
        [NX, fy + H2 * 0.25, -14.0],
        [NX, fy + H2 * 0.25, CWZ]
      ], this.materials.pipeCWR, 0.055, "fchx_cw");

      // Motorized valves on CHW vertical drops near nozzle height
      const addValve = (x, y, z) => {
        const vbm = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.80, roughness: 0.30 });
        const vam = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.55, roughness: 0.35 });
        const vb = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.17, 12), vbm);
        vb.position.set(x, y, z);
        this.scene.add(vb);
        const va = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15), vam);
        va.position.set(x, y + 0.21, z);
        this.scene.add(va);
      };
      addValve(CHWS_X, fy + H2 * 0.75 + 0.3, CHZ);
      addValve(CHWR_X, fy + H2 * 0.25 + 0.3, CHZ);

      // Standby status label — shown on CW pipe above back wall penetration
      const fcLabelCanvas = document.createElement('canvas');
      fcLabelCanvas.width = 260; fcLabelCanvas.height = 58;
      const fcCtx = fcLabelCanvas.getContext('2d');
      fcCtx.fillStyle = 'rgba(10, 25, 10, 0.88)';
      fcCtx.roundRect(0, 0, 260, 58, 10);
      fcCtx.fill();
      fcCtx.strokeStyle = '#22c55e'; fcCtx.lineWidth = 2; fcCtx.stroke();
      fcCtx.fillStyle = '#22c55e';
      fcCtx.font = 'bold 13px monospace';
      fcCtx.textAlign = 'center'; fcCtx.textBaseline = 'middle';
      fcCtx.fillText('FREE COOLING — STANDBY', 130, 19);
      fcCtx.fillStyle = '#9ca3af'; fcCtx.font = '11px monospace';
      fcCtx.fillText('自然冷卻 | 閥門全關 | 待機中', 130, 40);
      const fcSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(fcLabelCanvas), transparent: true
      }));
      fcSprite.position.set(NX, 4.2, -12.6);
      fcSprite.scale.set(3.0, 0.68, 1);
      this.scene.add(fcSprite);
      this.fcSprite = fcSprite;
    })();
  },



  
  updateLiveValues() {
    if (typeof APP !== 'undefined' && APP.utilityLoss) {
      APP.creepTempToAmbient();
    }
    
    document.querySelectorAll(".live-val").forEach(_0x3cf1ba => {
      let _0x83b194 = parseFloat(_0x3cf1ba.getAttribute("data-base"));
      let _0x235b56 = parseFloat(_0x3cf1ba.getAttribute("data-var"));
      
      // For utility loss, force variance to 0 for cooling/flow/cop
      if (typeof APP !== 'undefined' && APP.utilityLoss) {
        if (_0x3cf1ba.id === 'hud_val_cooling' || _0x3cf1ba.id === 'hud_val_flow' || _0x3cf1ba.id === 'hud_val_cop') {
          _0x235b56 = 0;
        }
      }

      let _0x5cf04a = _0x83b194 + (Math.random() * _0x235b56 * 2 - _0x235b56);
      let _0x4b832b = _0x83b194 > 100 ? 0 : 1;
      _0x3cf1ba.innerText = _0x5cf04a.toFixed(_0x4b832b);
    });

    // Send live telemetry to portal parent window
    if (window.parent && window.parent !== window) {
      const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? parseFloat(el.innerText) : 0;
      };
      window.parent.postMessage({
        type: 'telemetry',
        module: 'chiller-plant',
        data: {
          chws: getVal('hud_val_chws'),
          chwr: getVal('hud_val_chwr'),
          cws: getVal('hud_val_cws'),
          cwr: getVal('hud_val_cwr'),
          cooling: getVal('hud_val_cooling'),
          flow: getVal('hud_val_flow'),
          cop: getVal('hud_val_cop')
        }
      }, '*');
    }
  },

  calculateChiller() {
    const _0x427816 = parseFloat(document.getElementById("calc_load").value) || 3000;
    const _0x30fb24 = parseFloat(document.getElementById("calc_dt_chw").value) || 6;
    const _0x54a5b1 = parseFloat(document.getElementById("calc_dt_cw").value) || 5;
    const _0xc59ebd = parseFloat(document.getElementById("calc_cop").value) || 6;
    const _0x204358 = parseInt(document.getElementById("calc_n").value) || 2;
    const _0x3bfb81 = _0x427816 / 3.517;
    const _0xaabcd1 = _0x3bfb81 / _0x204358;
    const _0x22dc51 = _0x427816 / (_0x30fb24 * 4.18) * 3.6;
    const _0xbdacd5 = _0x427816 * (1 + 1 / _0xc59ebd);
    const _0x25a055 = _0xbdacd5 / (_0x54a5b1 * 4.18) * 3.6;
    document.getElementById("res_total_rt").innerText = _0x3bfb81.toFixed(0);
    document.getElementById("res_unit_rt").innerText = _0xaabcd1.toFixed(0);
    document.getElementById("res_chw_flow").innerText = _0x22dc51.toFixed(0);
    document.getElementById("res_cw_flow").innerText = _0x25a055.toFixed(0);

    // Send simulation sizing result to portal
    if (window.parent && window.parent !== window) {
      const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? parseFloat(el.innerText) : 0;
      };
      window.parent.postMessage({
        type: 'sizing_result',
        module: 'chiller-plant',
        data: {
          total_rt: getVal('res_total_rt'),
          unit_rt: getVal('res_unit_rt'),
          chw_flow: getVal('res_chw_flow'),
          cw_flow: getVal('res_cw_flow')
        }
      }, '*');
    }
  }
,
  onMouseMove(_0x2c2a30) {
    this.mouse.x = _0x2c2a30.clientX / window.innerWidth * 2 - 1;
    this.mouse.y = -(_0x2c2a30.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const _0x359eed = this.raycaster.intersectObjects(this.interactables, true);
    const _0x428254 = document.getElementById("hover-tooltip");
    if (_0x359eed.length > 0) {
      document.body.style.cursor = "pointer";
      _0x428254.style.opacity = 1;
      _0x428254.innerText = _0x359eed[0].object.userData.name;
      _0x428254.style.left = _0x2c2a30.clientX + "px";
      _0x428254.style.top = _0x2c2a30.clientY + "px";
    } else {
      document.body.style.cursor = "grab";
      _0x428254.style.opacity = 0;
    }
  },
  onClick(_0x3c67ba) {
    this.mouse.x = _0x3c67ba.clientX / window.innerWidth * 2 - 1;
    this.mouse.y = -(_0x3c67ba.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const _0x4fba77 = this.raycaster.intersectObjects(this.interactables, true);
    if (_0x4fba77.length > 0) {
      this.showDetail(_0x4fba77[0].object.userData);
    }
  },
  showDetail(_0x5798c3) {
    this.selectedObject = _0x5798c3;
    document.getElementById("hud-detail").classList.add("active");
    document.getElementById("detail-title").innerText = _0x5798c3.name;
    document.getElementById("detail-content-chiller").style.display = _0x5798c3.type === "Chiller" ? "block" : "none";
    document.getElementById("detail-content-pump").style.display = _0x5798c3.type === "Pump" ? "block" : "none";
    document.getElementById("detail-content-hx").style.display = _0x5798c3.type === "PHX" ? "block" : "none";
    document.getElementById("detail-content-tank").style.display = _0x5798c3.type === "ExpansionTank" ? "block" : "none";
    document.getElementById("detail-content-ct").style.display = _0x5798c3.type === "CoolingTower" ? "block" : "none";
    
    // TES-01 and FC-HX-01
    const tesDom  = document.getElementById("detail-content-tes");
    const fchxDom = document.getElementById("detail-content-fchx");
    if (tesDom)  tesDom.classList.toggle("hidden",  _0x5798c3.type !== "TESTank");
    if (fchxDom) fchxDom.classList.toggle("hidden", _0x5798c3.type !== "FreeCoolingHX");
    
    if (_0x5798c3.type === "Chiller") {
      document.getElementById("detail-subtitle").innerText = "WATER-COOLED CENTRIFUGAL";
      const statusEl = document.getElementById("chiller-load-status");
      if (statusEl) {
        if (this.freeCoolingActive) {
          statusEl.className = "text-amber-400 flex items-center gap-1 font-bold bg-amber-500/10 px-2 py-0.5 rounded text-[9px] border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)]";
          statusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> 待機中 / 自然冷卻';
        } else {
          statusEl.className = "text-sky-300 flex items-center gap-1 font-bold bg-sky-500/10 px-2 py-0.5 rounded text-[9px] border border-sky-500/20 shadow-[0_0_8px_rgba(14,165,233,0.2)]";
          statusEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span> 負載運轉中';
        }
      }
    }
    if (_0x5798c3.type === "Pump") {
      document.getElementById("detail-subtitle").innerText = "IN-LINE CENTRIFUGAL PUMP";
    }
    if (_0x5798c3.type === "CoolingTower") {
      document.getElementById("detail-subtitle").innerText = "INDUCED DRAFT COOLING TOWER";
    }
    if (_0x5798c3.type === "PHX") {
      document.getElementById("detail-subtitle").innerText = "PLATE HEAT EXCHANGER";
    }
    if (_0x5798c3.type === "ExpansionTank") {
      document.getElementById("detail-subtitle").innerText = "PRESSURIZED EXPANSION TANK";
    }
    if (_0x5798c3.type === "TESTank") {
      document.getElementById("detail-subtitle").innerText = "THERMAL ENERGY STORAGE — TES-01";
    }
    if (_0x5798c3.type === "FreeCoolingHX") {
      document.getElementById("detail-subtitle").innerText = "FREE COOLING HEAT EXCHANGER — FC-HX-01";
      const statusBadge = document.getElementById("fchx-status-badge");
      const valvePct = document.getElementById("fchx-valve-pct");
      const valveBar = document.getElementById("fchx-valve-bar");
      if (statusBadge && valvePct && valveBar) {
        if (this.freeCoolingActive) {
          statusBadge.className = "text-emerald-300 flex items-center gap-1 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[9px] border border-emerald-500/20";
          statusBadge.innerText = "ACTIVE (運行中)";
          valvePct.className = "text-emerald-400 font-bold";
          valvePct.innerText = "100% (全開)";
          valveBar.style.width = "100%";
          valveBar.className = "h-full bg-emerald-500 transition-all duration-500";
        } else {
          statusBadge.className = "text-slate-400 flex items-center gap-1 font-bold bg-slate-800/50 px-2 py-0.5 rounded text-[9px] border border-slate-700";
          statusBadge.innerText = "STANDBY (待命)";
          valvePct.className = "text-orange-400 font-bold";
          valvePct.innerText = "0% (全關)";
          valveBar.style.width = "0%";
          valveBar.className = "h-full bg-orange-500 transition-all duration-500";
        }
      }
    }
  },
  closeDetail() {
    this.selectedObject = null;
    document.getElementById("hud-detail").classList.remove("active");
  },
  toggleFreeCooling() {
    this.freeCoolingActive = !this.freeCoolingActive;
    
    const btn = document.getElementById("btn_free_cooling");
    if (btn) {
      btn.classList.toggle("active", this.freeCoolingActive);
      if (this.freeCoolingActive) {
        btn.style.boxShadow = "0 0 15px rgba(34, 197, 94, 0.6)";
        btn.style.borderColor = "#22c55e";
        btn.style.color = "#22c55e";
      } else {
        btn.style.boxShadow = "";
        btn.style.borderColor = "";
        btn.style.color = "";
      }
    }

    // 更新 live-val 的 data-base 與 data-var，模擬真實冬季低溫 Free Cooling
    const valMap = this.freeCoolingActive ? {
      "hud_val_chws": { base: 10.0, var: 0.15 },
      "hud_val_chwr": { base: 15.0, var: 0.2 },
      "hud_val_cws": { base: 8.5, var: 0.2 },
      "hud_val_cwr": { base: 12.5, var: 0.2 },
      "hud_val_cooling": { base: 600, var: 3 },
      "hud_val_flow": { base: 450, var: 5 },
      "hud_val_cop": { base: 0.0, var: 0.0 },
      "hud_val_fla": { base: 0.0, var: 0.0 },
      "hud_val_igv": { base: 0.0, var: 0.0 },
      "hud_val_evap_press": { base: 550, var: 2 },
      "hud_val_cond_press": { base: 560, var: 2 },
      "hud_val_wb": { base: 7.5, var: 0.2 }
    } : {
      "hud_val_chws": { base: 12.0, var: 0.2 },
      "hud_val_chwr": { base: 18.0, var: 0.3 },
      "hud_val_cws": { base: 28.5, var: 0.4 },
      "hud_val_cwr": { base: 34.0, var: 0.5 },
      "hud_val_cooling": { base: 850, var: 5 },
      "hud_val_flow": { base: 510, var: 10 },
      "hud_val_cop": { base: 6.2, var: 0.1 },
      "hud_val_fla": { base: 75.5, var: 2 },
      "hud_val_igv": { base: 68.0, var: 1.5 },
      "hud_val_evap_press": { base: 350, var: 5 },
      "hud_val_cond_press": { base: 820, var: 8 },
      "hud_val_wb": { base: 26.5, var: 0.2 }
    };

    Object.entries(valMap).forEach(([id, cfg]) => {
      const el = document.getElementById(id);
      if (el) {
        el.setAttribute("data-base", cfg.base);
        el.setAttribute("data-var", cfg.var);
      }
    });

    // 重新繪製看板與 Chiller 螢幕
    this.updateFcSprite();
    this.updateChillerScreen();
    
    // 更新 Chiller 運轉狀態 LED
    this.updateChillerLeds();

    // 更新 Chiller 詳情面板 (如果當前開啟的話)
    if (this.selectedObject) {
      this.showDetail(this.selectedObject);
    }
  },

  updateChillerScreen() {
    if (!this.textures.chillerScreen || !this.textures.chillerScreen.image) return;
    const canvas = this.textures.chillerScreen.image;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#010c1a";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#0c2d48";
    ctx.fillRect(0, 0, 512, 42);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 20px monospace";
    ctx.fillText("● CHILLER CONTROL UNIT v4.1", 14, 28);
    
    // 獲取目前 live 或是根據 Free Cooling 狀態顯示
    const chws = document.getElementById("hud_val_chws")?.innerText || "12.0";
    const chwr = document.getElementById("hud_val_chwr")?.innerText || "18.0";
    const cws = document.getElementById("hud_val_cws")?.innerText || "28.5";
    const cwr = document.getElementById("hud_val_cwr")?.innerText || "34.0";
    
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 30px monospace";
    ctx.fillText(`CHWS: ${chws}°C   CHWR: ${chwr}°C`, 20, 90);
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`CWS:  ${cws}°C   CWR: ${cwr}°C`, 20, 135);
    
    if (this.freeCoolingActive) {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "20px monospace";
      ctx.fillText("COP: 0.00   LOAD: 0.0%", 20, 180);
      ctx.fillStyle = "#f59e0b"; // 橘黃色待命狀態
      ctx.font = "bold 18px monospace";
      ctx.fillText("● COMPRESSOR OFF — FREE COOLING ACTIVE", 20, 225);
    } else if (this.utilityLoss) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 18px monospace";
      ctx.fillText("● SYSTEM FAULT — UTILITY LOSS", 20, 225);
    } else {
      const cop = "6.20";
      const fla = "75.5";
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "20px monospace";
      ctx.fillText(`COP: ${cop}   LOAD: ${fla}%`, 20, 180);
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 18px monospace";
      ctx.fillText("● COMPRESSOR RUNNING — AUTO MODE", 20, 225);
    }
    this.textures.chillerScreen.needsUpdate = true;
  },

  updateChillerLeds() {
    if (!this.chillerLeds) return;
    this.chillerLeds.forEach(ledsGroup => {
      if (this.freeCoolingActive) {
        // 在 Free Cooling 模式下，冰機關閉，所有綠色 LED 熄滅或變橘色
        ledsGroup[0].material.color.setHex(0x1e293b);
        ledsGroup[1].material.color.setHex(0x1e293b);
        ledsGroup[2].material.color.setHex(0xf97316); // 橘色待機
        ledsGroup[3].material.color.setHex(0x1e293b);
      } else {
        // 恢復正常運轉綠燈
        ledsGroup[0].material.color.setHex(0x22c5b0);
        ledsGroup[1].material.color.setHex(0x22c5b0);
        ledsGroup[2].material.color.setHex(0xfbbf24);
        ledsGroup[3].material.color.setHex(0x22c5b0);
      }
    });
  },

  updateFcSprite() {
    if (!this.fcSprite || !this.fcSprite.material.map || !this.fcSprite.material.map.image) return;
    const canvas = this.fcSprite.material.map.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 260, 58);
    
    if (this.freeCoolingActive) {
      ctx.fillStyle = 'rgba(10, 35, 10, 0.92)';
      ctx.roundRect(0, 0, 260, 58, 10);
      ctx.fill();
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.stroke();
      
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 4;
      ctx.fillText('FREE COOLING — RUNNING', 130, 19);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#a7f3d0'; ctx.font = '11px monospace';
      ctx.fillText('自然冷卻 | 閥門開啟 | 運行中', 130, 40);
    } else {
      ctx.fillStyle = 'rgba(15, 20, 25, 0.88)';
      ctx.roundRect(0, 0, 260, 58, 10);
      ctx.fill();
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2; ctx.stroke();
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('FREE COOLING — STANDBY', 130, 19);
      ctx.fillStyle = '#64748b'; ctx.font = '11px monospace';
      ctx.fillText('自然冷卻 | 閥門全關 | 待機中', 130, 40);
    }
    this.fcSprite.material.map.needsUpdate = true;
  },
  toggleLeftHud() {
    this.leftHudVisible = !this.leftHudVisible;
    this.updateHudState();
  },
  updateHudState() {
    const hud = document.getElementById("hud-left");
    const btn = document.getElementById("btn_toggle_hud");
    if (hud) hud.classList.toggle("active", this.leftHudVisible);
    if (btn) btn.classList.toggle("active", this.leftHudVisible);
  },
  toggleSimPanel() {
    this.simPanelOpen = !this.simPanelOpen;
    document.getElementById("sim-modal-overlay").classList.toggle("active", this.simPanelOpen);
  },
  
  applyCoupledData(data) {
    this.utilityLoss = data.mepScenario === 'utilityFail';
    this.coupledLoad = data.whitespaceLoad || 1200;
    
    const coolingEl = document.getElementById('hud_val_cooling');
    const flowEl = document.getElementById('hud_val_flow');
    const copEl = document.getElementById('hud_val_cop');
    const chwsEl = document.getElementById('hud_val_chws');
    const chwrEl = document.getElementById('hud_val_chwr');
    const cwsEl = document.getElementById('hud_val_cws');
    const cwrEl = document.getElementById('hud_val_cwr');
    
    if (this.utilityLoss) {
      // In utility loss, force cooling and flow to zero
      if (coolingEl) coolingEl.setAttribute('data-base', '0');
      if (flowEl) flowEl.setAttribute('data-base', '0');
      if (copEl) copEl.setAttribute('data-base', '0');
      
      // Let temperatures slowly creep towards ambient room temperature (30.0 C)
      this.creepTempToAmbient();
    } else {
      // Normal operation: link cooling capacity and flow rate to Whitespace IT Load
      const coolingRT = this.coupledLoad / 3.517;
      const flowRate = coolingRT * 0.6;
      
      if (coolingEl) coolingEl.setAttribute('data-base', coolingRT.toFixed(0));
      if (flowEl) flowEl.setAttribute('data-base', flowRate.toFixed(0));
      if (copEl) copEl.setAttribute('data-base', '6.2');
      
      // Restore default temperatures
      if (chwsEl) chwsEl.setAttribute('data-base', '12.0');
      if (chwrEl) chwrEl.setAttribute('data-base', '18.0');
      if (cwsEl) cwsEl.setAttribute('data-base', '28.5');
      if (cwrEl) cwrEl.setAttribute('data-base', '34.0');
    }
  },

  creepTempToAmbient() {
    const chwsEl = document.getElementById('hud_val_chws');
    const chwrEl = document.getElementById('hud_val_chwr');
    const cwsEl = document.getElementById('hud_val_cws');
    const cwrEl = document.getElementById('hud_val_cwr');
    
    const creep = (el, target, step) => {
      if (!el) return;
      let curr = parseFloat(el.getAttribute('data-base')) || target;
      if (curr < target) curr = Math.min(target, curr + step);
      if (curr > target) curr = Math.max(target, curr - step);
      el.setAttribute('data-base', curr.toFixed(1));
    };
    
    // Ambient room temp is 30.0 C
    creep(chwsEl, 30.0, 0.4);
    creep(chwrEl, 30.0, 0.3);
    creep(cwsEl, 30.0, 0.2);
    creep(cwrEl, 30.0, 0.2);
  },
  setCamera(viewName) {
    document.querySelectorAll(".btn-tool").forEach(btn => {
      if (btn.id !== "btn_sim") {
        btn.classList.remove("active");
      }
    });
    if (document.getElementById("cam_" + viewName)) {
      document.getElementById("cam_" + viewName).classList.add("active");
    }
    let pos;
    let target;
    if (viewName === "overview") {
      pos = new THREE.Vector3(12, 10, 14);
      target = new THREE.Vector3(0, 1.5, -1);
    } else if (viewName === "chiller") {
      pos = new THREE.Vector3(-7.2, 2.8, -3.2);
      target = new THREE.Vector3(-4, 1.2, 1);
    } else if (viewName === "pump") {
      pos = new THREE.Vector3(-1.0, 2.2, -4.8);
      target = new THREE.Vector3(2.5, 0.6, -6.8);
    } else if (viewName === "hx") {
      pos = new THREE.Vector3(10.5, 2.5, -7.0);
      target = new THREE.Vector3(7.5, 1.0, -9.0);
    } else if (viewName === "piping") {
      pos = new THREE.Vector3(5, 8, -1);
      target = new THREE.Vector3(0, 3.5, -5.5);
    } else if (viewName === "ct") {
      pos = new THREE.Vector3(-7.5, 13.5, -10.5);
      target = new THREE.Vector3(-1.5, 9.5, -16.5);
    }
    if (pos && target) {
      this.tweenCamera(pos, target);
    }
  },
  tweenCamera(targetPosition, targetLookAt) {
    if (window.TWEEN) {
      TWEEN.removeAll();
      new TWEEN.Tween(this.camera.position).to(targetPosition, 1200).easing(TWEEN.Easing.Cubic.InOut).start();
      new TWEEN.Tween(this.controls.target).to(targetLookAt, 1200).easing(TWEEN.Easing.Cubic.InOut).onUpdate(() => {
        this.controls.update();
      }).start();
    } else {
      this.camera.position.copy(targetPosition);
      this.controls.target.copy(targetLookAt);
      this.controls.update();
    }
  },
  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },
  animate() {
    requestAnimationFrame(() => this.animate());
    if (window.TWEEN) {
      TWEEN.update();
    }
    if (!this.flowOffset) this.flowOffset = 0;
    if (!this.utilityLoss) {
      this.flowOffset -= 0.007; // flow fluid animation moves when power is on!
      
      // Rotate cooling tower fan blades dynamically!
      this.coolingTowerFans.forEach(fan => {
        fan.rotation.y += 0.06;
      });
    }
    this.pipeMaterials.forEach(mat => {
      if (mat.map) {
        let shouldFlow = true;
        
        if (this.freeCoolingActive) {
          // Free Cooling active: chillers stop flowing
          if (mat.userData && mat.userData.flowType === "chiller") {
            shouldFlow = false;
          }
        } else {
          // Normal mode: FC-HX CW pipes do not flow
          if (mat.userData && mat.userData.flowType === "fchx_cw") {
            shouldFlow = false;
          }
        }
        
        if (this.utilityLoss) {
          shouldFlow = false;
        }

        if (shouldFlow) {
          if (mat.flowOffset === undefined) mat.flowOffset = 0;
          mat.flowOffset -= 0.007;
          mat.map.offset.y = mat.flowOffset;
        }
      }
    });
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