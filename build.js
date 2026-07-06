const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR = __dirname;
const TEMP_DIR = path.join(__dirname, 'dist-source');
const DIST_DIR = path.join(__dirname, 'dist');

// 需要複製到暫存區以進行打包的檔案（server.js 不放在 asar 內，打包後另行複製到 resources/）
const FILES_TO_COPY = [
  'whitespace.html',
  'style.css',
  'app.js',
  'fanwall.js',
  'security.js',
  'main.js',
  'preload.js'
];

function clean() {
  console.log('正在清理舊的暫存目錄...');
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

function copyFiles() {
  console.log('正在複製檔案至暫存建置目錄...');
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  FILES_TO_COPY.forEach(file => {
    const srcPath = path.join(SRC_DIR, file);
    const destPath = path.join(TEMP_DIR, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`複製成功: ${file}`);
    } else {
      console.warn(`警告: 找不到檔案 - ${file}`);
    }
  });

  // 複製執行時期所需的 node_modules（非開發工具）到暫存目錄
  // 這些模組會被一起打包進 app.asar 供主行程使用
  const RUNTIME_MODULES = ['node-machine-id'];
  const srcModules = path.join(SRC_DIR, 'node_modules');
  const destModules = path.join(TEMP_DIR, 'node_modules');
  if (!fs.existsSync(destModules)) {
    fs.mkdirSync(destModules, { recursive: true });
  }
  RUNTIME_MODULES.forEach(mod => {
    const srcMod = path.join(srcModules, mod);
    const destMod = path.join(destModules, mod);
    if (fs.existsSync(srcMod)) {
      fs.cpSync(srcMod, destMod, { recursive: true });
      console.log(`複製 node_module 成功: ${mod}`);
    } else {
      console.warn(`警告: 找不到 node_module - ${mod}`);
    }
  });

  // 建立一個在 dist-source 內的簡化版 package.json。
  // 它不需要 devDependencies，以避免打包不必要的開發工具進 app.asar。
  const packageJson = {
    name: "verarubin-digitaltwin",
    version: "1.0.0",
    main: "main.js",
    private: true,
    dependencies: {
      "node-machine-id": "*"
    }
  };
  fs.writeFileSync(
    path.join(TEMP_DIR, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  console.log('在暫存目錄中建立生產環境 package.json 完成');
}


function obfuscate() {
  console.log('開始執行 JavaScript 代碼混淆...');
  const jsFiles = ['app.js', 'fanwall.js', 'security.js', 'main.js', 'preload.js'];

  jsFiles.forEach(file => {
    const filePath = path.join(TEMP_DIR, file);
    if (fs.existsSync(filePath)) {
      console.log(`正在混淆 ${file}...`);
      const originalCode = fs.readFileSync(filePath, 'utf8');
      
      // 混淆設定參數
      // app.js 與 fanwall.js 包含 Three.js 與重度計算，控制流平坦化設為 false 以防效能衝擊。
      // security.js 為安全偵測，開啟 debugProtection。
      const obfuscationOptions = {
        compact: true,
        controlFlowFlattening: false, // 確保 3D 渲染與模擬流暢性
        deadCodeInjection: false,
        debugProtection: file === 'security.js', 
        debugProtectionInterval: file === 'security.js' ? 4000 : 0,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        numbersToExpressions: false,
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 0.8
      };

      const obfuscationResult = JavaScriptObfuscator.obfuscate(originalCode, obfuscationOptions);
      fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf8');
      console.log(`混淆 ${file} 完成`);
    }
  });
}

function buildApp() {
  console.log('正在使用 electron-packager 封裝 Electron 應用程式...');
  try {
    execSync('npx electron-packager dist-source AI_DC_Simulator --platform=win32 --arch=x64 --asar --out=dist --overwrite', {
      cwd: SRC_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
      }
    });
    console.log('打包建置成功！產出目錄已放置於 dist/ 目錄下。');
  } catch (error) {
    console.error('electron-packager 打包過程中發生錯誤:', error);
    throw error;
  }
}

// 打包完成後，將明文 server.js 複製到 dist/resources/ 目錄（asar 外部）
// 如此 main.js 才能用 child_process.fork 直接載入它（asar 不支援 fork）
function copyServerOutsideAsar() {
  const serverSrc = path.join(SRC_DIR, 'server.js');
  const resourcesDir = path.join(DIST_DIR, 'AI_DC_Simulator-win32-x64', 'resources');
  const serverDest = path.join(resourcesDir, 'server.js');
  if (fs.existsSync(serverSrc)) {
    fs.copyFileSync(serverSrc, serverDest);
    console.log('server.js 已複製到 dist/resources/（asar 外部）。');
  } else {
    console.warn('警告: 找不到 server.js，計算服務將無法在打包版本中運行！');
  }
}

function run() {
  try {
    clean();
    copyFiles();
    obfuscate();
    buildApp();
    copyServerOutsideAsar();
  } catch (error) {
    console.error('建置流程失敗:', error);
    process.exit(1);
  } finally {
    console.log('清理暫存工作目錄...');
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  }
}

run();
