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
    const _0xf475aa = (_0x32807e, _0x25cc91, _0x27d076 = 0.12) => {
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
    const _0x3ddafa = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 0.18), _0x11d5f5);
    _0x3ddafa.position.set(-0.5, 3.5, -11);
    _0x3ddafa.castShadow = true;
    this.scene.add(_0x3ddafa);
    [-6.5, -3.5, -0.5, 2.5, 5.5].forEach(_0x503049 => {
      const _0x57fdc6 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2, 8), _0x55e072);
      _0x57fdc6.position.set(_0x503049, 4.5, -11);
      this.scene.add(_0x57fdc6);
      const _0x53ed96 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.08), _0x11d5f5);
      _0x53ed96.position.set(_0x503049, 3.48, -11);
      this.scene.add(_0x53ed96);
    });
    const _0x5ad146 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 0.14), _0x11d5f5);
    _0x5ad146.position.set(3, 3.5, -9);
    this.scene.add(_0x5ad146);
    [1.5, 3, 4.5].forEach(_0x396a6c => {
      const _0x54ec54 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2, 8), _0x55e072);
      _0x54ec54.position.set(_0x396a6c, 4.5, -9);
      this.scene.add(_0x54ec54);
    });
    const _0x139281 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.14), _0x11d5f5);
    _0x139281.position.set(2, 3.8, -4);
    this.scene.add(_0x139281);
    [-2, 2, 6].forEach(_0x407b12 => {
      const _0x58b572 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.7, 8), _0x55e072);
      _0x58b572.position.set(_0x407b12, 4.65, -4);
      this.scene.add(_0x58b572);
    });
    const _0x2788af = new THREE.Mesh(new THREE.BoxGeometry(15, 0.08, 0.14), _0x11d5f5);
    _0x2788af.position.set(0.4, 4.1, -5);
    this.scene.add(_0x2788af);
    [-6.5, -2, 2.5, 7].forEach(_0x285e12 => {
      const _0x440dfe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 8), _0x55e072);
      _0x440dfe.position.set(_0x285e12, 4.8, -5);
      this.scene.add(_0x440dfe);
    });
    const _0x112265 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.14), _0x11d5f5);
    _0x112265.position.set(2, 4.4, -8);
    this.scene.add(_0x112265);
    [-2, 2, 6].forEach(_0x1656a4 => {
      const _0x5013c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), _0x55e072);
      _0x5013c2.position.set(_0x1656a4, 4.95, -8);
      this.scene.add(_0x5013c2);
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
      const _0x4e31d8 = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.45, 3.72), _0x5dfcf8);
      _0x4e31d8.position.set(0, 0.225, 0);
      _0x21cc43.add(_0x4e31d8);
      const _0x1e7846 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.02, 3.6), _0x41e693);
      _0x1e7846.position.set(0, 0.44, 0);
      _0x21cc43.add(_0x1e7846);
      [[0, 1.875, 3.72, 0.03], [0, -1.875, 3.72, 0.03], [1.875, 0, 0.03, 3.72], [-1.875, 0, 0.03, 3.72]].forEach(([_0x4006a4, _0x95f526, _0x3ba5c7, _0x3fca3f]) => {
        const _0x54acc0 = new THREE.Mesh(new THREE.BoxGeometry(_0x3ba5c7, 0.055, _0x3fca3f), _0x51d7c7);
        _0x54acc0.position.set(_0x4006a4, 0.462, _0x95f526);
        _0x21cc43.add(_0x54acc0);
      });
      [[-1.65, -1.65], [1.65, -1.65], [-1.65, 1.65], [1.65, 1.65]].forEach(([_0xe8415d, _0x4ecd90]) => {
        const _0x338551 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.075, 0.18), new THREE.MeshStandardMaterial({
          color: 2042167,
          metalness: 0.15,
          roughness: 0.88
        }));
        _0x338551.position.set(_0xe8415d, -0.038, _0x4ecd90);
        _0x21cc43.add(_0x338551);
      });
      const _0x14084f = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.18, 8), _0xbb76bd);
      _0x14084f.rotation.z = Math.PI / 2;
      _0x14084f.position.set(1.95, 0.3, 0);
      _0x21cc43.add(_0x14084f);
      const _0x878171 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 8), _0x3d2a90);
      _0x878171.rotation.z = Math.PI / 2;
      _0x878171.position.set(-1.95, 0.14, -0.5);
      _0x21cc43.add(_0x878171);
      [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]].forEach(([_0x33ec82, _0x1e09b9]) => {
        const _0x525580 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.75, 0.09), _0x51d7c7);
        _0x525580.position.set(_0x33ec82, 1.825, _0x1e09b9);
        _0x21cc43.add(_0x525580);
      });
      [[3.44, 0.05, 0.05, 0, 1.25, 1.72], [3.44, 0.05, 0.05, 0, 1.25, -1.72], [0.05, 0.05, 3.44, 1.72, 1.25, 0], [0.05, 0.05, 3.44, -1.72, 1.25, 0]].forEach(([_0x3493f9, _0x5c60c9, _0x58dec9, _0x51d29c, _0x312ddb, _0x5ee5cb]) => {
        const _0x495e71 = new THREE.Mesh(new THREE.BoxGeometry(_0x3493f9, _0x5c60c9, _0x58dec9), _0x51d7c7);
        _0x495e71.position.set(_0x51d29c, _0x312ddb, _0x5ee5cb);
        _0x21cc43.add(_0x495e71);
      });
      for (let _0x263b5d = 0; _0x263b5d < 8; _0x263b5d++) {
        const _0xa05b3e = 0.54 + _0x263b5d * 0.205;
        const _0x5e2ab2 = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.056, 0.12), _0x3d2a90);
        _0x5e2ab2.position.set(0, _0xa05b3e, 1.72);
        _0x5e2ab2.rotation.x = 0.22;
        _0x21cc43.add(_0x5e2ab2);
        const _0x28bc49 = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.056, 0.12), _0x3d2a90);
        _0x28bc49.position.set(0, _0xa05b3e, -1.72);
        _0x28bc49.rotation.x = -0.22;
        _0x21cc43.add(_0x28bc49);
        const _0x2fc975 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.056, 3.38), _0x3d2a90);
        _0x2fc975.position.set(1.72, _0xa05b3e, 0);
        _0x2fc975.rotation.z = -0.22;
        _0x21cc43.add(_0x2fc975);
        const _0x2d61a9 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.056, 3.38), _0x3d2a90);
        _0x2d61a9.position.set(-1.72, _0xa05b3e, 0);
        _0x2d61a9.rotation.z = 0.22;
        _0x21cc43.add(_0x2d61a9);
      }
      const _0x48ca0e = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.78, 0.054), _0x265d85);
      _0x48ca0e.position.set(0, 1.99, 1.725);
      _0x21cc43.add(_0x48ca0e);
      const _0x2b4393 = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.78, 0.054), _0x265d85);
      _0x2b4393.position.set(0, 1.99, -1.725);
      _0x21cc43.add(_0x2b4393);
      const _0x3c26f3 = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.78, 3.42), _0x265d85);
      _0x3c26f3.position.set(1.725, 1.99, 0);
      _0x21cc43.add(_0x3c26f3);
      const _0x20d822 = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.78, 3.42), _0x265d85);
      _0x20d822.position.set(-1.725, 1.99, 0);
      _0x21cc43.add(_0x20d822);
      const _0xa1cd8e = new THREE.Mesh(new THREE.BoxGeometry(3.12, 1.6, 3.12), _0x5315ad);
      _0xa1cd8e.position.set(0, 1.25, 0);
      _0x21cc43.add(_0xa1cd8e);
      for (let _0x56fa14 = 0; _0x56fa14 < 5; _0x56fa14++) {
        const _0x225779 = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.009, 3.06), _0x276914);
        _0x225779.position.set(0, 0.55 + _0x56fa14 * 0.25, 0);
        _0x21cc43.add(_0x225779);
      }
      const _0xb765fb = new THREE.Mesh(new THREE.BoxGeometry(3.36, 0.172, 3.36), _0xbf7494);
      _0xb765fb.position.set(0, 2.274, 0);
      _0x21cc43.add(_0xb765fb);
      for (let _0xaef715 = 0; _0xaef715 < 4; _0xaef715++) {
        const _0x51636f = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 3.18, 10), _0x51d7c7);
        _0x51636f.rotation.z = Math.PI / 2;
        _0x51636f.position.set(0, 2.363, -1.1 + _0xaef715 * 0.72);
        _0x21cc43.add(_0x51636f);
      }
      for (let _0xc62af2 = 0; _0xc62af2 < 4; _0xc62af2++) {
        for (let _0x192fad = 0; _0x192fad < 4; _0x192fad++) {
          const _0x31f060 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.052, 8), new THREE.MeshStandardMaterial({
            color: 959977,
            metalness: 0.38,
            roughness: 0.52
          }));
          _0x31f060.position.set(-1.18 + _0xc62af2 * 0.78, 2.313, -1.18 + _0x192fad * 0.78);
          _0x21cc43.add(_0x31f060);
        }
      }
      const _0x2ab483 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 10), _0xe7011);
      _0x2ab483.rotation.x = Math.PI / 2;
      _0x2ab483.position.set(0, 2.3, 1.92);
      _0x21cc43.add(_0x2ab483);
      const _0x3372e5 = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.116, 0.02, 12), new THREE.MeshStandardMaterial({
        color: 4856346,
        metalness: 0.65,
        roughness: 0.4
      }));
      _0x3372e5.rotation.x = Math.PI / 2;
      _0x3372e5.position.set(0, 2.3, 2.1);
      _0x21cc43.add(_0x3372e5);
      const _0x580d05 = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.062, 12), _0xe7011);
      _0x580d05.rotation.x = Math.PI / 2;
      _0x580d05.position.set(0, 2.3, 2.19);
      _0x21cc43.add(_0x580d05);
      const _0x120f3b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 8), _0xbb76bd);
      _0x120f3b.position.set(0, 2.44, 2.19);
      _0x21cc43.add(_0x120f3b);
      const _0x310d54 = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.011, 8, 14), _0xbb76bd);
      _0x310d54.position.set(0, 2.575, 2.19);
      _0x21cc43.add(_0x310d54);
      const _0x36b044 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.36, 10), _0x2378df);
      _0x36b044.rotation.x = Math.PI / 2;
      _0x36b044.position.set(0, 0.3, 1.92);
      _0x21cc43.add(_0x36b044);
      const _0x1930bf = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.02, 12), new THREE.MeshStandardMaterial({
        color: 1981066,
        metalness: 0.65,
        roughness: 0.4
      }));
      _0x1930bf.rotation.x = Math.PI / 2;
      _0x1930bf.position.set(0, 0.3, 2.1);
      _0x21cc43.add(_0x1930bf);
      const _0x9d0a97 = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.062, 12), _0x2378df);
      _0x9d0a97.rotation.x = Math.PI / 2;
      _0x9d0a97.position.set(0, 0.3, 2.19);
      _0x21cc43.add(_0x9d0a97);
      const _0x4bed48 = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.19, 8), _0xbb76bd);
      _0x4bed48.position.set(0, 0.475, 2.19);
      _0x21cc43.add(_0x4bed48);
      const _0x4f0d30 = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.011, 8, 14), _0xbb76bd);
      _0x4f0d30.position.set(0, 0.63, 2.19);
      _0x21cc43.add(_0x4f0d30);
      const _0x21efdd = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.112, 3.22), new THREE.MeshStandardMaterial({
        color: 1981023,
        metalness: 0.18,
        roughness: 0.72
      }));
      _0x21efdd.position.set(0, 2.203, 0);
      _0x21cc43.add(_0x21efdd);
      const _0x3254b2 = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.054, 3.82), _0x3dca37);
      _0x3254b2.position.set(0, 2.39, 0);
      _0x21cc43.add(_0x3254b2);
      [[3.82, 0.068, 0.068, 0, 2.348, 1.9], [3.82, 0.068, 0.068, 0, 2.348, -1.9], [0.068, 0.068, 3.82, 1.9, 2.348, 0], [0.068, 0.068, 3.82, -1.9, 2.348, 0]].forEach(([_0x83f6ea, _0x47dd62, _0x230b61, _0x100bd1, _0x4c968f, _0xa1cc11]) => {
        const _0x583b34 = new THREE.Mesh(new THREE.BoxGeometry(_0x83f6ea, _0x47dd62, _0x230b61), _0x51d7c7);
        _0x583b34.position.set(_0x100bd1, _0x4c968f, _0xa1cc11);
        _0x21cc43.add(_0x583b34);
      });
      [-1.96, 1.96].forEach(_0x81e4dc => {
        const _0x1b66cb = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.021, 0.021), _0x2db3ca);
        _0x1b66cb.position.set(0, 2.78, _0x81e4dc);
        _0x21cc43.add(_0x1b66cb);
        const _0x59e310 = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.017, 0.017), _0x2db3ca);
        _0x59e310.position.set(0, 2.6, _0x81e4dc);
        _0x21cc43.add(_0x59e310);
        for (let _0x49d98a = 0; _0x49d98a < 5; _0x49d98a++) {
          const _0x5a302c = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.4, 0.021), _0x2db3ca);
          _0x5a302c.position.set(-1.8 + _0x49d98a * 0.9, 2.595, _0x81e4dc);
          _0x21cc43.add(_0x5a302c);
        }
      });
      [-1.96, 1.96].forEach(_0xc6b5d9 => {
        const _0x3a1ef4 = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.021, 3.84), _0x2db3ca);
        _0x3a1ef4.position.set(_0xc6b5d9, 2.78, 0);
        _0x21cc43.add(_0x3a1ef4);
        const _0x109b94 = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.017, 3.84), _0x2db3ca);
        _0x109b94.position.set(_0xc6b5d9, 2.6, 0);
        _0x21cc43.add(_0x109b94);
        for (let _0x19444f = 0; _0x19444f < 5; _0x19444f++) {
          const _0x37bff5 = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.4, 0.021), _0x2db3ca);
          _0x37bff5.position.set(_0xc6b5d9, 2.595, -1.8 + _0x19444f * 0.9);
          _0x21cc43.add(_0x37bff5);
        }
      });
      const _0x9eac39 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 2.5, 0.038), _0x51d7c7);
      _0x9eac39.position.set(1.92, 1.5, 0.18);
      _0x21cc43.add(_0x9eac39);
      const _0x5f3f07 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 2.5, 0.038), _0x51d7c7);
      _0x5f3f07.position.set(1.92, 1.5, -0.18);
      _0x21cc43.add(_0x5f3f07);
      for (let _0x1e7612 = 0; _0x1e7612 < 10; _0x1e7612++) {
        const _0x179704 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.02, 0.38), _0xbb76bd);
        _0x179704.position.set(1.935, 0.3 + _0x1e7612 * 0.22, 0);
        _0x21cc43.add(_0x179704);
      }
      const _0xf66a38 = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.44, 0.65, 30), new THREE.MeshStandardMaterial({
        color: 4937059,
        metalness: 0.55,
        roughness: 0.5
      }));
      _0xf66a38.position.set(0, 2.74, 0);
      _0x21cc43.add(_0xf66a38);
      const _0x223941 = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.3, 0.12, 30), new THREE.MeshStandardMaterial({
        color: 3621201,
        metalness: 0.5,
        roughness: 0.55
      }));
      _0x223941.position.set(0, 2.44, 0);
      _0x21cc43.add(_0x223941);
      const _0x5ced3c = new THREE.Mesh(new THREE.CylinderGeometry(1.31, 1.31, 0.042, 30), new THREE.MeshStandardMaterial({
        color: 3621201,
        metalness: 0.5,
        roughness: 0.52
      }));
      _0x5ced3c.position.set(0, 3.08, 0);
      _0x21cc43.add(_0x5ced3c);
      const _0x55c5a1 = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.058, 0.058), _0x51d7c7);
      _0x55c5a1.position.set(0, 2.83, 0);
      _0x21cc43.add(_0x55c5a1);
      const _0x16734d = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.058, 2.58), _0x51d7c7);
      _0x16734d.position.set(0, 2.83, 0);
      _0x21cc43.add(_0x16734d);
      const _0x56c71e = new THREE.Mesh(new THREE.CylinderGeometry(0.136, 0.136, 0.36, 16), new THREE.MeshStandardMaterial({
        color: 1976635,
        metalness: 0.7,
        roughness: 0.32
      }));
      _0x56c71e.position.set(0, 3.01, 0);
      _0x21cc43.add(_0x56c71e);
      for (let _0x133302 = 0; _0x133302 < 5; _0x133302++) {
        const _0x5411bd = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.146, 0.01, 16), new THREE.MeshStandardMaterial({
          color: 1976635,
          metalness: 0.6,
          roughness: 0.4
        }));
        _0x5411bd.position.set(0, 2.87 + _0x133302 * 0.054, 0);
        _0x21cc43.add(_0x5411bd);
      }
      const _0x2f80e3 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.136, 0.046, 16), _0x51d7c7);
      _0x2f80e3.position.set(0, 3.205, 0);
      _0x21cc43.add(_0x2f80e3);
      const _0x1bbb3d = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.075, 0.13), _0x51d7c7);
      _0x1bbb3d.position.set(0.155, 3.02, 0);
      _0x21cc43.add(_0x1bbb3d);
      const _0x39c564 = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.066, 14), _0x3d2a90);
      _0x39c564.position.set(0, 2.78, 0);
      _0x21cc43.add(_0x39c564);
      for (let _0x3c8f5f = 0; _0x3c8f5f < 6; _0x3c8f5f++) {
        const _0x5e608f = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 1.06), new THREE.MeshStandardMaterial({
          color: 3621201,
          metalness: 0.48,
          roughness: 0.52
        }));
        _0x5e608f.position.set(0, 2.78, 0);
        _0x5e608f.rotation.y = _0x3c8f5f / 6 * Math.PI * 2;
        _0x5e608f.rotation.x = 0.24;
        _0x21cc43.add(_0x5e608f);
      }
      const _0x4eded8 = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.28, 8), _0xbb76bd);
      _0x4eded8.position.set(0, 2.95, 0);
      _0x21cc43.add(_0x4eded8);
      const _0x6350f6 = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.25, 0.04), new THREE.MeshBasicMaterial({
        color: 959977
      }));
      _0x6350f6.position.set(0, 0.68, 1.745);
      _0x21cc43.add(_0x6350f6);
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
    const _0x450a68 = (_0x47255d, _0x4fa30b, _0x58ef12) => {
      const _0x229478 = new THREE.Group();
      const _0x5d7a93 = this.materials.darkMetal;
      const _0x271fde = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.08), _0x5d7a93);
      _0x271fde.position.set(0, 0.07, 0);
      _0x271fde.castShadow = true;
      _0x229478.add(_0x271fde);
      [-0.36, 0, 0.36].forEach(_0x468727 => {
        const _0x21956d = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.09, 0.06), _0x5d7a93);
        _0x21956d.position.set(0, 0.15, _0x468727);
        _0x229478.add(_0x21956d);
      });
      [[-1.28, -0.48], [1.28, -0.48], [-1.28, 0.48], [1.28, 0.48]].forEach(([_0x2e2e9f, _0x56e0bb]) => {
        const _0x4d6214 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 8), _0x5d7a93);
        _0x4d6214.position.set(_0x2e2e9f, -0.02, _0x56e0bb);
        _0x229478.add(_0x4d6214);
      });
      const _0x1be03c = new THREE.MeshStandardMaterial({
        color: 8369107,
        metalness: 0.25,
        roughness: 0.65
      });
      const _0x1be342 = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.52, 32), _0x1be03c);
      _0x1be342.rotation.z = Math.PI / 2;
      _0x1be342.position.set(0, 0.62, 0.3);
      _0x1be342.castShadow = true;
      _0x229478.add(_0x1be342);
      [-0.76, 0.76].forEach(_0xa331a0 => {
        const _0x47663 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.82), _0x5d7a93);
        _0x47663.position.set(_0xa331a0, 0.28, 0.3);
        _0x229478.add(_0x47663);
      });
      const _0x81106b = this.materials.chillerBody;
      [-1.3, 1.3].forEach(_0x315d6c => {
        const _0x2014ee = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.12, 32), _0x81106b);
        _0x2014ee.rotation.z = Math.PI / 2;
        _0x2014ee.position.set(_0x315d6c, 0.62, 0.3);
        _0x229478.add(_0x2014ee);
      });
      const _0x1846e9 = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.18, 32), _0x81106b);
      _0x1846e9.rotation.z = Math.PI / 2;
      _0x1846e9.position.set(1.43, 0.62, 0.3);
      _0x229478.add(_0x1846e9);
      for (let _0x5f05c2 = 0; _0x5f05c2 < 5; _0x5f05c2++) {
        const _0x5155e2 = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.028, 32), this.materials.aluminum);
        _0x5155e2.rotation.z = Math.PI / 2;
        _0x5155e2.position.set(-0.95 + _0x5f05c2 * 0.5, 0.62, 0.3);
        _0x229478.add(_0x5155e2);
      }
      const _0x18b7bf = new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12);
      [[1.36, 0.58, 0.45], [1.36, 0.58, 0.15]].forEach(_0x236900 => {
        const _0x2617e8 = new THREE.Mesh(_0x18b7bf, _0x81106b);
        _0x2617e8.rotation.z = Math.PI / 2;
        _0x2617e8.position.set(_0x236900[0], _0x236900[1], _0x236900[2]);
        _0x229478.add(_0x2617e8);
      });
      const _0x4b99a5 = new THREE.MeshStandardMaterial({
        color: 12573694,
        transparent: true,
        opacity: 0.16,
        roughness: 0.95
      });
      const _0x4346bb = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 2.54, 32), _0x4b99a5);
      _0x4346bb.rotation.z = Math.PI / 2;
      _0x4346bb.position.set(0, 0.62, 0.3);
      _0x229478.add(_0x4346bb);
      const _0x579da2 = new THREE.MeshStandardMaterial({
        color: 9282485,
        metalness: 0.55,
        roughness: 0.42
      });
      const _0x43a891 = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 2.52, 32), _0x579da2);
      _0x43a891.rotation.z = Math.PI / 2;
      _0x43a891.position.set(0, 0.57, -0.3);
      _0x43a891.castShadow = true;
      _0x229478.add(_0x43a891);
      [-0.76, 0.76].forEach(_0x59ec51 => {
        const _0x301dd0 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.72), _0x5d7a93);
        _0x301dd0.position.set(_0x59ec51, 0.26, -0.3);
        _0x229478.add(_0x301dd0);
      });
      [-1.3, 1.3].forEach(_0x29528d => {
        const _0x32a6c7 = new THREE.Mesh(new THREE.CylinderGeometry(0.395, 0.395, 0.12, 32), _0x81106b);
        _0x32a6c7.rotation.z = Math.PI / 2;
        _0x32a6c7.position.set(_0x29528d, 0.57, -0.3);
        _0x229478.add(_0x32a6c7);
      });
      const _0x7aeb97 = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.16, 32), _0x81106b);
      _0x7aeb97.rotation.z = Math.PI / 2;
      _0x7aeb97.position.set(1.41, 0.57, -0.3);
      _0x229478.add(_0x7aeb97);
      for (let _0x231acd = 0; _0x231acd < 5; _0x231acd++) {
        const _0x4dc986 = new THREE.Mesh(new THREE.CylinderGeometry(0.395, 0.395, 0.028, 32), this.materials.aluminum);
        _0x4dc986.rotation.z = Math.PI / 2;
        _0x4dc986.position.set(-0.95 + _0x231acd * 0.5, 0.57, -0.3);
        _0x229478.add(_0x4dc986);
      }
      [[1.36, 0.54, -0.45], [1.36, 0.54, -0.15]].forEach(_0x45105a => {
        const _0x16cb72 = new THREE.Mesh(_0x18b7bf, _0x81106b);
        _0x16cb72.rotation.z = Math.PI / 2;
        _0x16cb72.position.set(_0x45105a[0], _0x45105a[1], _0x45105a[2]);
        _0x229478.add(_0x16cb72);
      });
      const _0x575958 = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
      [[1.25, 0.58, 0.45], [1.25, 0.58, 0.15], [1.25, 0.54, -0.45], [1.25, 0.54, -0.15]].forEach(_0x5ae716 => {
        const _0x147d66 = new THREE.Mesh(_0x575958, _0x81106b);
        _0x147d66.rotation.z = Math.PI / 2;
        _0x147d66.position.set(_0x5ae716[0], _0x5ae716[1], _0x5ae716[2]);
        _0x229478.add(_0x147d66);
      });
      const _0x22512b = this.materials.compressor;
      const _0x485c07 = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.44, 20), _0x22512b);
      _0x485c07.rotation.z = Math.PI / 2;
      _0x485c07.position.set(-0.5, 1.42, 0);
      _0x229478.add(_0x485c07);
      const _0x4cf80f = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.13, 20), this.materials.aluminum);
      _0x4cf80f.rotation.z = Math.PI / 2;
      _0x4cf80f.position.set(-0.77, 1.42, 0);
      _0x229478.add(_0x4cf80f);
      const _0x5ce27d = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.08), this.materials.aluminum);
      _0x5ce27d.position.set(-0.76, 1.68, 0.08);
      _0x229478.add(_0x5ce27d);
      const _0x2cfaf4 = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.36, 20), _0x22512b);
      _0x2cfaf4.rotation.z = Math.PI / 2;
      _0x2cfaf4.position.set(-0.1, 1.42, 0);
      _0x229478.add(_0x2cfaf4);
      const _0x81ece4 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.28), this.materials.hxPlate);
      _0x81ece4.position.set(-0.3, 1.2, -0.22);
      _0x229478.add(_0x81ece4);
      const _0x20d174 = new THREE.CylinderGeometry(0.24, 0.27, 0.32, 20);
      const _0xce995a = new THREE.Mesh(_0x20d174, _0x22512b);
      _0xce995a.rotation.z = Math.PI / 2;
      _0xce995a.position.set(0.22, 1.42, 0);
      _0x229478.add(_0xce995a);
      const _0x3db0d3 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.082, 12, 24, Math.PI * 1.3), _0x22512b);
      _0x3db0d3.rotation.z = Math.PI / 2;
      _0x3db0d3.rotation.y = 0.5;
      _0x3db0d3.position.set(0.36, 1.42, -0.14);
      _0x229478.add(_0x3db0d3);
      const _0x2a8023 = new THREE.MeshStandardMaterial({
        color: 2963272,
        metalness: 0.72,
        roughness: 0.35
      });
      const _0x208788 = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 1.05, 20), _0x2a8023);
      _0x208788.rotation.z = Math.PI / 2;
      _0x208788.position.set(0.9, 1.42, 0);
      _0x208788.castShadow = true;
      _0x229478.add(_0x208788);
      for (let _0x28be9c = 0; _0x28be9c < 10; _0x28be9c++) {
        const _0x441706 = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.248, 0.022, 20), _0x2a8023);
        _0x441706.rotation.z = Math.PI / 2;
        _0x441706.position.set(0.4 + _0x28be9c * 0.115, 1.42, 0);
        _0x229478.add(_0x441706);
      }
      const _0x5e9b87 = new THREE.MeshStandardMaterial({
        color: 1976635,
        metalness: 0.8,
        roughness: 0.3
      });
      [0.36, 1.44].forEach(_0x2f8597 => {
        const _0x59cbb7 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 20), _0x5e9b87);
        _0x59cbb7.rotation.z = Math.PI / 2;
        _0x59cbb7.position.set(_0x2f8597, 1.42, 0);
        _0x229478.add(_0x59cbb7);
      });
      const _0x3c30a0 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.14), _0x5d7a93);
      _0x3c30a0.position.set(0.9, 1.7, 0.2);
      _0x229478.add(_0x3c30a0);
      const _0x29dbe9 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 16), this.materials.aluminum);
      _0x29dbe9.rotation.z = Math.PI / 2;
      _0x29dbe9.position.set(0.37, 1.42, 0);
      _0x229478.add(_0x29dbe9);
      const _0x1de086 = new THREE.MeshStandardMaterial({
        color: 6583435,
        metalness: 0.7,
        roughness: 0.4
      });
      const _0xdf2981 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5), _0x1de086);
      _0xdf2981.position.set(-0.5, 1.09, 0.26);
      _0x229478.add(_0xdf2981);
      const _0x366ed8 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3), _0x1de086);
      _0x366ed8.rotation.x = Math.PI / 2;
      _0x366ed8.position.set(-0.5, 1.34, 0.43);
      _0x229478.add(_0x366ed8);
      const _0x14654f = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.48), _0x1de086);
      _0x14654f.position.set(0.36, 1.06, -0.24);
      _0x229478.add(_0x14654f);
      const _0x283769 = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.28), _0x1de086);
      _0x283769.rotation.x = Math.PI / 2;
      _0x283769.position.set(0.36, 1.3, -0.4);
      _0x229478.add(_0x283769);
      const _0x4ad641 = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.7), _0x1de086);
      _0x4ad641.rotation.z = Math.PI / 2;
      _0x4ad641.position.set(-0.4, 0.18, 0.05);
      _0x229478.add(_0x4ad641);
      const _0x4cd9e7 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), this.materials.copper);
      _0x4cd9e7.position.set(-0.4, 0.18, 0.28);
      _0x229478.add(_0x4cd9e7);
      const _0x267461 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 12), this.materials.aluminum);
      _0x267461.position.set(-1.1, 1.54, -0.1);
      _0x229478.add(_0x267461);
      const _0x464d10 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), this.materials.hxPlate);
      _0x464d10.position.set(-1.1, 1.06, -0.1);
      _0x229478.add(_0x464d10);
      const _0x50fec8 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46), this.materials.copper);
      _0x50fec8.position.set(-1.04, 1.3, -0.04);
      _0x229478.add(_0x50fec8);
      const _0x297bc1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.16, 8), this.materials.copper);
      _0x297bc1.position.set(0.45, 0.97, -0.3);
      _0x229478.add(_0x297bc1);
      const _0x4ac572 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26), this.materials.copper);
      _0x4ac572.position.set(0.45, 1.18, -0.3);
      _0x229478.add(_0x4ac572);
      const _0x15db26 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.82, 0.7), this.materials.controlPanel);
      _0x15db26.position.set(-1.46, 1.12, 0.08);
      _0x229478.add(_0x15db26);
      const _0x353dc3 = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.23), new THREE.MeshBasicMaterial({
        map: this.textures.chillerScreen
      }));
      _0x353dc3.position.set(-1.54, 1.22, 0.08);
      _0x353dc3.rotation.y = Math.PI / 2;
      _0x229478.add(_0x353dc3);
      [[2278750, 0.07], [2278750, -0.01], [16498468, -0.09], [2278750, -0.17]].forEach(([_0x240b05, _0x381cf6]) => {
        const _0x2a2b9c = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshBasicMaterial({
          color: _0x240b05
        }));
        _0x2a2b9c.position.set(-1.54, 1.46, 0.08 + _0x381cf6);
        _0x229478.add(_0x2a2b9c);
      });
      const _0x35d324 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12), new THREE.MeshStandardMaterial({
        color: 15680580,
        roughness: 0.3
      }));
      _0x35d324.rotation.x = Math.PI / 2;
      _0x35d324.position.set(-1.54, 1.46, 0.27);
      _0x229478.add(_0x35d324);
      const _0x176e30 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.6), this.materials.darkMetal);
      _0x176e30.position.set(-1.46, 0.51, 0.08);
      _0x229478.add(_0x176e30);
      for (let _0x14d47c = 0; _0x14d47c < 6; _0x14d47c++) {
        const _0x258a26 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.033, 0.48), this.materials.aluminum);
        _0x258a26.position.set(-1.535, 0.22 + _0x14d47c * 0.1, 0.08);
        _0x229478.add(_0x258a26);
      }
      const _0x494b13 = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), new THREE.MeshBasicMaterial({
        color: 2278750
      }));
      _0x494b13.position.set(-1.535, 0.9, 0.08);
      _0x229478.add(_0x494b13);
      const _0x25a86e = document.createElement("canvas");
      _0x25a86e.width = 512;
      _0x25a86e.height = 128;
      const _0x240380 = _0x25a86e.getContext("2d");
      _0x240380.fillStyle = "#0f172a";
      _0x240380.fillRect(0, 0, 512, 128);
      _0x240380.strokeStyle = "#38bdf8";
      _0x240380.lineWidth = 4;
      _0x240380.strokeRect(3, 3, 506, 122);
      _0x240380.fillStyle = "#38bdf8";
      _0x240380.font = "bold 30px monospace";
      _0x240380.textAlign = "center";
      _0x240380.textBaseline = "middle";
      _0x240380.fillText(_0x58ef12, 256, 46);
      _0x240380.fillStyle = "#94a3b8";
      _0x240380.font = "18px monospace";
      _0x240380.fillText("Water-Cooled Centrifugal  800 RT", 256, 95);
      const _0x2c79f1 = new THREE.CanvasTexture(_0x25a86e);
      const _0x55f7eb = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.27), new THREE.MeshBasicMaterial({
        map: _0x2c79f1
      }));
      _0x55f7eb.position.set(0, 0.24, 0.77);
      _0x229478.add(_0x55f7eb);
      _0x229478.position.set(_0x47255d, 0, _0x4fa30b);
      const _chillerId = _0x58ef12.split(" ")[0];
      registerNozzleAnchor(_chillerId, "CHWS_Out", _0x229478, [1.62, 0.58, 0.45], [1, 0, 0]);
      registerNozzleAnchor(_chillerId, "CHWR_In", _0x229478, [1.62, 0.58, 0.15], [1, 0, 0]);
      registerNozzleAnchor(_chillerId, "CWS_In", _0x229478, [1.62, 0.54, -0.15], [1, 0, 0]);
      registerNozzleAnchor(_chillerId, "CWR_Out", _0x229478, [1.62, 0.54, -0.45], [1, 0, 0]);
      const _0x533b84 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.1, 1.5), new THREE.MeshBasicMaterial({
        visible: false
      }));
      _0x533b84.position.set(0, 1.05, 0);
      _0x533b84.userData = {
        type: "Chiller",
        name: _0x58ef12
      };
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
      const _0x1dbf3b = _0x1969c0 ? this.materials.pumpMotor : _0x2c9961;
      const _0x261633 = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.13, 1.55), _0x5b054e);
      _0x261633.position.set(0, 0.065, -0.08);
      _0x467d33.add(_0x261633);
      [-0.23, 0.23].forEach(_0x269037 => {
        const _0x23247e = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.022, 1.52), _0x538e87);
        _0x23247e.position.set(_0x269037, 0.152, -0.08);
        _0x467d33.add(_0x23247e);
        const _0x2cb35c = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.062, 1.52), _0x538e87);
        _0x2cb35c.position.set(_0x269037, 0.122, -0.08);
        _0x467d33.add(_0x2cb35c);
        const _0x1f4820 = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.022, 1.52), _0x538e87);
        _0x1f4820.position.set(_0x269037, 0.092, -0.08);
        _0x467d33.add(_0x1f4820);
      });
      [[-0.25, -0.58], [-0.25, 0.43], [0.25, -0.58], [0.25, 0.43]].forEach(([_0x34eb5f, _0x459a9e]) => {
        const _0x2f57e6 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.068, 12), _0x538e87);
        _0x2f57e6.position.set(_0x34eb5f, 0.034, _0x459a9e);
        _0x467d33.add(_0x2f57e6);
        const _0xd9b705 = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.09, 8), _0x3594e8);
        _0xd9b705.position.set(_0x34eb5f, 0.045, _0x459a9e);
        _0x467d33.add(_0xd9b705);
      });
      const _0x3023ea = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.235, 0.27, 28), _0x3f65fe);
      _0x3023ea.rotation.x = Math.PI / 2;
      _0x3023ea.position.set(0, 0.35, 0.24);
      _0x467d33.add(_0x3023ea);
      const _0x115ea6 = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.022, 28), _0x3f65fe);
      _0x115ea6.rotation.x = Math.PI / 2;
      _0x115ea6.position.set(0, 0.35, 0.375);
      _0x467d33.add(_0x115ea6);
      const _0x5ec346 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.205, 0.028, 24), _0x3f65fe);
      _0x5ec346.rotation.x = Math.PI / 2;
      _0x5ec346.position.set(0, 0.35, 0.098);
      _0x467d33.add(_0x5ec346);
      [-0.1, 0.12].forEach(_0x45625d => {
        const _0x2c567a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.085, 0.062), _0x538e87);
        _0x2c567a.position.set(0, 0.215, 0.24 + _0x45625d);
        _0x467d33.add(_0x2c567a);
      });
      const _0x1fbbb3 = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.042, 8), _0x3594e8);
      _0x1fbbb3.rotation.z = Math.PI / 2;
      _0x1fbbb3.position.set(0.255, 0.195, 0.24);
      _0x467d33.add(_0x1fbbb3);
      for (let _0x139fc4 = 0; _0x139fc4 < 6; _0x139fc4++) {
        const _0x567cd2 = _0x139fc4 / 6 * Math.PI * 2;
        const _0x4cb193 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.038, 6), _0x3594e8);
        _0x4cb193.rotation.x = Math.PI / 2;
        _0x4cb193.position.set(Math.cos(_0x567cd2) * 0.238, 0.35 + Math.sin(_0x567cd2) * 0.238, 0.395);
        _0x467d33.add(_0x4cb193);
      }
      const _0x513283 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 14), _0x3f65fe);
      _0x513283.position.set(0, 0.695, 0.3);
      _0x467d33.add(_0x513283);
      const _0x327de3 = new THREE.Mesh(new THREE.CylinderGeometry(0.124, 0.124, 0.02, 14), _0x538e87);
      _0x327de3.position.set(0, 0.85, 0.3);
      _0x467d33.add(_0x327de3);
      const _0x33b8fd = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.15, 16), _0x3f65fe);
      _0x33b8fd.rotation.x = Math.PI / 2;
      _0x33b8fd.position.set(0, 0.32, 0.45);
      _0x467d33.add(_0x33b8fd);
      const _0x53c0c4 = new THREE.Mesh(new THREE.CylinderGeometry(0.136, 0.136, 0.02, 16), _0x538e87);
      _0x53c0c4.rotation.x = Math.PI / 2;
      _0x53c0c4.position.set(0, 0.32, 0.52);
      _0x467d33.add(_0x53c0c4);
      const _0x5be05e = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.148, 0.225, 20), _0x538e87);
      _0x5be05e.rotation.x = Math.PI / 2;
      _0x5be05e.position.set(0, 0.35, 0.012);
      _0x467d33.add(_0x5be05e);
      const _0x35e0a8 = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.038, 16), _0x3594e8);
      _0x35e0a8.rotation.x = Math.PI / 2;
      _0x35e0a8.position.set(0, 0.35, 0.122);
      _0x467d33.add(_0x35e0a8);
      const _0x1b58cf = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.055, 8), _0x3594e8);
      _0x1b58cf.position.set(0, 0.455, 0.012);
      _0x467d33.add(_0x1b58cf);
      const _0x3bbd67 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), _0x3594e8);
      _0x3bbd67.rotation.x = Math.PI / 2;
      _0x3bbd67.position.set(0, 0.35, -0.118);
      _0x467d33.add(_0x3bbd67);
      const _0x423ffb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.042, 8), _0x538e87);
      _0x423ffb.rotation.x = Math.PI / 2;
      _0x423ffb.position.set(0, 0.35, -0.195);
      _0x467d33.add(_0x423ffb);
      const _0x247e52 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.026, 12), _0x3594e8);
      _0x247e52.rotation.x = Math.PI / 2;
      _0x247e52.position.set(0, 0.35, -0.225);
      _0x467d33.add(_0x247e52);
      const _0x5f588f = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.042, 8), _0x538e87);
      _0x5f588f.rotation.x = Math.PI / 2;
      _0x5f588f.position.set(0, 0.35, -0.258);
      _0x467d33.add(_0x5f588f);
      const _0x174e57 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.19, 18), _0x3594e8);
      _0x174e57.rotation.x = Math.PI / 2;
      _0x174e57.position.set(0, 0.35, -0.225);
      _0x467d33.add(_0x174e57);
      for (let _0x66cbdb = 0; _0x66cbdb < 3; _0x66cbdb++) {
        const _0x3ab6a3 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.038, 0.058), new THREE.MeshStandardMaterial({
          color: 0
        }));
        _0x3ab6a3.position.set(0.088, 0.35 + (_0x66cbdb - 1) * 0.058, -0.225);
        _0x467d33.add(_0x3ab6a3);
      }
      const _0x53df59 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.52, 20), _0x1dbf3b);
      _0x53df59.rotation.x = Math.PI / 2;
      _0x53df59.position.set(0, 0.35, -0.555);
      _0x467d33.add(_0x53df59);
      for (let _0x568c91 = 0; _0x568c91 < 10; _0x568c91++) {
        const _0x4d5c0f = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20), _0x1dbf3b);
        _0x4d5c0f.rotation.x = Math.PI / 2;
        _0x4d5c0f.position.set(0, 0.35, -0.308 - _0x568c91 * 0.048);
        _0x467d33.add(_0x4d5c0f);
      }
      const _0xd512e4 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.052, 20), _0x538e87);
      _0xd512e4.rotation.x = Math.PI / 2;
      _0xd512e4.position.set(0, 0.35, -0.306);
      _0x467d33.add(_0xd512e4);
      const _0x5b52a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.052, 20), _0x538e87);
      _0x5b52a1.rotation.x = Math.PI / 2;
      _0x5b52a1.position.set(0, 0.35, -0.803);
      _0x467d33.add(_0x5b52a1);
      const _0x5ed009 = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.14, 20), new THREE.MeshStandardMaterial({
        color: 2042167,
        metalness: 0.5,
        roughness: 0.55
      }));
      _0x5ed009.rotation.x = Math.PI / 2;
      _0x5ed009.position.set(0, 0.35, -0.9);
      _0x467d33.add(_0x5ed009);
      const _0x24e0a9 = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.153, 0.013, 20), new THREE.MeshStandardMaterial({
        color: 3621201,
        metalness: 0.55,
        roughness: 0.5
      }));
      _0x24e0a9.rotation.x = Math.PI / 2;
      _0x24e0a9.position.set(0, 0.35, -0.833);
      _0x467d33.add(_0x24e0a9);
      const _0xf8c602 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.095, 0.17), _0x538e87);
      _0xf8c602.position.set(0, 0.513, -0.555);
      _0x467d33.add(_0xf8c602);
      const _0x2b5d6c = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.016, 0.175), _0x3594e8);
      _0x2b5d6c.position.set(0, 0.563, -0.555);
      _0x467d33.add(_0x2b5d6c);
      const _0x5e82b7 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.038, 8), _0x3594e8);
      _0x5e82b7.position.set(0, 0.53, -0.49);
      _0x467d33.add(_0x5e82b7);
      const _0x37b3db = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.007, 8, 12), _0x3594e8);
      _0x37b3db.position.set(0, 0.558, -0.49);
      _0x467d33.add(_0x37b3db);
      const _0x343088 = _0x1969c0 ? 3900150 : 2278750;
      const _0x17cd79 = new THREE.Mesh(new THREE.CylinderGeometry(0.154, 0.154, 0.032, 20), new THREE.MeshStandardMaterial({
        color: _0x343088,
        metalness: 0.3,
        roughness: 0.6
      }));
      _0x17cd79.rotation.x = Math.PI / 2;
      _0x17cd79.position.set(0, 0.35, -0.445);
      _0x467d33.add(_0x17cd79);
      const _0x38e3f0 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.058, 0.095), new THREE.MeshStandardMaterial({
        color: 15067115,
        metalness: 0.3,
        roughness: 0.7
      }));
      _0x38e3f0.position.set(-0.153, 0.35, -0.61);
      _0x467d33.add(_0x38e3f0);
      const _0x51a0e7 = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.078, 0.095, 14), _0x3f65fe);
      _0x51a0e7.rotation.x = Math.PI / 2;
      _0x51a0e7.position.set(0, 0.32, 0.615);
      _0x467d33.add(_0x51a0e7);
      const _0x4ee955 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.078, 14), _0x5a88d0);
      _0x4ee955.rotation.x = Math.PI / 2;
      _0x4ee955.position.set(0, 0.32, 0.713);
      _0x467d33.add(_0x4ee955);
      const _0xd9b22c = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.065, 16), _0x538e87);
      _0xd9b22c.rotation.x = Math.PI / 2;
      _0xd9b22c.position.set(0, 0.32, 0.812);
      _0x467d33.add(_0xd9b22c);
      const _0xda42c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.21, 8), _0x3594e8);
      _0xda42c2.position.set(0, 0.465, 0.812);
      _0x467d33.add(_0xda42c2);
      const _0xebc370 = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.012, 8, 16), _0x3594e8);
      _0xebc370.position.set(0, 0.605, 0.812);
      _0x467d33.add(_0xebc370);
      for (let _0x272386 = 0; _0x272386 < 4; _0x272386++) {
        const _0xe08fd2 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.184), _0x3594e8);
        _0xe08fd2.position.set(0, 0.605, 0.812);
        _0xe08fd2.rotation.z = _0x272386 / 4 * Math.PI * 2;
        _0x467d33.add(_0xe08fd2);
      }
      const _0x1bc354 = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.023, 10), _0x2e6eaa);
      _0x1bc354.position.set(-0.115, 0.415, 0.73);
      _0x1bc354.rotation.z = Math.PI / 3;
      _0x467d33.add(_0x1bc354);
      const _0x497d83 = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.115, 14), _0x538e87);
      _0x497d83.position.set(0, 0.93, 0.3);
      _0x467d33.add(_0x497d83);
      const _0x4499cc = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), _0x538e87);
      _0x4499cc.position.set(0, 1.01, 0.3);
      _0x467d33.add(_0x4499cc);
      const _0x3bc95d = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.068, 14), _0x5a88d0);
      _0x3bc95d.position.set(0, 1.082, 0.3);
      _0x467d33.add(_0x3bc95d);
      const _0x1c5364 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.065, 14), _0x538e87);
      _0x1c5364.position.set(0, 1.168, 0.3);
      _0x467d33.add(_0x1c5364);
      const _0x255987 = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.19, 8), _0x3594e8);
      _0x255987.rotation.z = Math.PI / 2;
      _0x255987.position.set(0.112, 1.168, 0.3);
      _0x467d33.add(_0x255987);
      const _0x2fb40f = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.011, 8, 14), _0x3594e8);
      _0x2fb40f.rotation.y = Math.PI / 2;
      _0x2fb40f.position.set(0.24, 1.168, 0.3);
      _0x467d33.add(_0x2fb40f);
      const _0x54ebe8 = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.023, 10), _0x2e6eaa);
      _0x54ebe8.position.set(0.115, 0.795, 0.3);
      _0x54ebe8.rotation.z = -Math.PI / 2;
      _0x467d33.add(_0x54ebe8);
      _0x467d33.position.set(_0x2b1095, 0, _0x17c557);
      registerNozzleAnchor(_0x426224, "Suction_In", _0x467d33, [0, 0.32, 0.88], [0, 0, 1]);
      registerNozzleAnchor(_0x426224, "Discharge_Out", _0x467d33, [0, 1.18, 0.3], [0, 1, 0]);
      const _0x309b16 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.35, 1.65), new THREE.MeshBasicMaterial({
        visible: false
      }));
      _0x309b16.position.y = 0.65;
      _0x309b16.userData = {
        type: "Pump",
        name: _0x426224
      };
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
    // ANCHOR-DRIVEN PRIMARY PIPING NETWORK
    // ================================================================
    this.scene.updateMatrixWorld(true);
    const HEADER = {
      CHWS: { y: 3.35, z: -11.2, xMin: -7.4, xMax: 8.3, material: this.materials.pipeCHWS },
      CHWR: { y: 5.05, z: -11.85, xMin: -7.4, xMax: 8.3, material: this.materials.pipeCHWR },
      CWS:  { y: 4.2, z: -9.75, xMin: -4.2, xMax: 8.8, material: this.materials.pipeCWS },
      CWR:  { y: 4.65, z: -8.65, xMin: -4.2, xMax: 8.8, material: this.materials.pipeCWR }
    };
    const CHILLER_LANE = {
      CHWS: 0.55,
      CHWR: 0.9,
      CWS: 1.25,
      CWR: 1.6
    };
    const PHX_LANE = {
      CHWS: { x: 6.8, z: -7.55 },
      CHWR: { x: 6.45, z: -7.9 },
      CWS:  { x: 8.15, z: -7.55 },
      CWR:  { x: 8.5, z: -7.9 }
    };
    const CWP_DISCHARGE_LANE = {
      "CWP-01": -7.35,
      "CWP-02": -7.75,
      "CWP-03": -8.15
    };
    const headerPoint = (system, xOverride) => {
      const h = HEADER[system];
      const x = xOverride === undefined ? h.xMin : xOverride;
      return new THREE.Vector3(x, h.y, h.z);
    };
    const routeToHeader = (anchor, system, diameter = 0.24) => {
      const p = asWorldPoint(anchor);
      drawPipeRoute(anchor, headerPoint(system, p.x), HEADER[system].material, diameter);
    };
    const routeChillerNozzle = (anchor, system, diameter = 0.24) => {
      const start = asWorldPoint(anchor);
      const h = HEADER[system];
      const dir = anchor.userData.nozzleDirection.clone();
      const clear = start.clone().add(dir.multiplyScalar(0.5));
      const laneX = clear.x + CHILLER_LANE[system];
      _0xf475aa([
        start,
        clear,
        new THREE.Vector3(laneX, clear.y, clear.z),
        new THREE.Vector3(laneX, h.y, clear.z),
        new THREE.Vector3(laneX, h.y, h.z)
      ], h.material, diameter / 2);
    };
    const routePhxNozzle = (anchor, system, diameter = 0.18) => {
      const start = asWorldPoint(anchor);
      const h = HEADER[system];
      const lane = PHX_LANE[system];
      const clear = start.clone().add(anchor.userData.nozzleDirection.clone().multiplyScalar(0.45));
      _0xf475aa([
        start,
        clear,
        new THREE.Vector3(lane.x, clear.y, clear.z),
        new THREE.Vector3(lane.x, clear.y, lane.z),
        new THREE.Vector3(lane.x, h.y, lane.z),
        new THREE.Vector3(lane.x, h.y, h.z)
      ], h.material, diameter / 2);
    };
    const routePumpDischarge = (anchor, system, laneZ, diameter = 0.24) => {
      const start = asWorldPoint(anchor);
      const h = HEADER[system];
      const clear = start.clone().add(anchor.userData.nozzleDirection.clone().multiplyScalar(0.5));
      _0xf475aa([
        start,
        clear,
        new THREE.Vector3(clear.x, h.y, clear.z),
        new THREE.Vector3(clear.x, h.y, laneZ),
        new THREE.Vector3(clear.x, h.y, h.z)
      ], h.material, diameter / 2);
    };
    Object.keys(HEADER).forEach(system => {
      const h = HEADER[system];
      _0xf475aa([[h.xMin, h.y, h.z], [h.xMax, h.y, h.z]], h.material, 0.12);
    });
    ["CH-01", "CH-02"].forEach(chillerId => {
      const a = nozzleAnchors[chillerId];
      routeChillerNozzle(a.CHWS_Out, "CHWS");
      routeChillerNozzle(a.CHWR_In, "CHWR");
      routeChillerNozzle(a.CWS_In, "CWS");
      routeChillerNozzle(a.CWR_Out, "CWR");
    });
    ["CHWP-01", "CHWP-02", "CHWP-03"].forEach(pumpId => {
      const a = nozzleAnchors[pumpId];
      const sx = asWorldPoint(a.Suction_In).x;
      drawPipeRoute(headerPoint("CHWR", sx), a.Suction_In, this.materials.pipeCHWR, 0.24);
      routePumpDischarge(a.Discharge_Out, "CHWS", -10.45);
    });
    ["CWP-01", "CWP-02", "CWP-03"].forEach(pumpId => {
      const a = nozzleAnchors[pumpId];
      const sx = asWorldPoint(a.Suction_In).x;
      drawPipeRoute(headerPoint("CWS", sx), a.Suction_In, this.materials.pipeCWS, 0.24);
      routePumpDischarge(a.Discharge_Out, "CWR", CWP_DISCHARGE_LANE[pumpId]);
    });
    ["CT-01", "CT-02"].forEach(ctId => {
      const a = nozzleAnchors[ctId];
      routeToHeader(a.CWR_In, "CWR");
      routeToHeader(a.CWS_Out, "CWS");
    });
    const phx = nozzleAnchors["PHX-01"];
    routePhxNozzle(phx.CHWS_In, "CHWS");
    routePhxNozzle(phx.CHWR_Out, "CHWR");
    routePhxNozzle(phx.CWS_In, "CWS");
    routePhxNozzle(phx.CWR_Out, "CWR");
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
      [-8.25, 4.35, -8.85],
      [-8.25, 4.35, -11.85],
      [-7.4, 4.35, -11.85],
      [-7.4, 5.05, -11.85]
    ], this.materials.pipeCHWR, 0.06);
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
    document.getElementById("hud-detail").classList.add("active");
    document.getElementById("detail-title").innerText = _0x5798c3.name;
    document.getElementById("detail-content-chiller").style.display = _0x5798c3.type === "Chiller" ? "block" : "none";
    document.getElementById("detail-content-pump").style.display = _0x5798c3.type === "Pump" ? "block" : "none";
    if (_0x5798c3.type === "Chiller") {
      document.getElementById("detail-subtitle").innerText = "WATER-COOLED CENTRIFUGAL";
    }
    if (_0x5798c3.type === "Pump") {
      document.getElementById("detail-subtitle").innerText = "IN-LINE CENTRIFUGAL PUMP";
    }
    if (_0x5798c3.type === "CoolingTower") {
      document.getElementById("detail-subtitle").innerText = "INDUCED DRAFT COOLING TOWER";
    }
  },
  closeDetail() {
    document.getElementById("hud-detail").classList.remove("active");
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
  setCamera(_0x164c86) {
    document.querySelectorAll(".btn-tool").forEach(_0x1c99c1 => {
      if (_0x1c99c1.id !== "btn_sim") {
        _0x1c99c1.classList.remove("active");
      }
    });
    if (document.getElementById("cam_" + _0x164c86)) {
      document.getElementById("cam_" + _0x164c86).classList.add("active");
    }
    let _0x4e99ef;
    let _0x4cadfe;
    if (_0x164c86 === "overview") {
      _0x4e99ef = new THREE.Vector3(12, 10, 14);
      _0x4cadfe = new THREE.Vector3(0, 1.5, -1);
    } else if (_0x164c86 === "chiller") {
      _0x4e99ef = new THREE.Vector3(0, 5, 7);
      _0x4cadfe = new THREE.Vector3(0, 1.2, 1);
    } else if (_0x164c86 === "pump") {
      _0x4e99ef = new THREE.Vector3(0, 4, 2.5);
      _0x4cadfe = new THREE.Vector3(0, 0.8, -2.5);
    } else if (_0x164c86 === "hx") {
      _0x4e99ef = new THREE.Vector3(10.5, 2.5, 1.5);
      _0x4cadfe = new THREE.Vector3(7.5, 1, -1.5);
    } else if (_0x164c86 === "piping") {
      _0x4e99ef = new THREE.Vector3(5, 8, -1);
      _0x4cadfe = new THREE.Vector3(0, 3.5, -5.5);
    } else if (_0x164c86 === "ct") {
      _0x4e99ef = new THREE.Vector3(4.5, 12, -12.5);
      _0x4cadfe = new THREE.Vector3(-1.25, 9.6, -17.5);
    }
    if (_0x4e99ef && _0x4cadfe) {
      this.tweenCamera(_0x4e99ef, _0x4cadfe);
    }
  },
  tweenCamera(_0x161694, _0x54db51) {
    if (window.TWEEN) {
      TWEEN.removeAll();
      new TWEEN.Tween(this.camera.position).to(_0x161694, 900).easing(TWEEN.Easing.Cubic.Out).start();
      new TWEEN.Tween(this.controls.target).to(_0x54db51, 900).easing(TWEEN.Easing.Cubic.Out).onUpdate(() => {
        this.controls.update();
      }).start();
    } else {
      this.camera.position.copy(_0x161694);
      this.controls.target.copy(_0x54db51);
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
    }
    this.pipeMaterials.forEach(_0x27f2f1 => {
      if (_0x27f2f1.map) {
        _0x27f2f1.map.offset.y = this.flowOffset;
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