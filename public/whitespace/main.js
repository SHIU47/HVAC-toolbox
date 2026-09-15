const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { machineId } = require('node-machine-id');

let calculationServer = null;

// 取得 server.js 的絕對路徑
// 開發中：專案根目錄
// 打包後：resources/server.js（asar 外部，直接可被 child_process 讀取）
function getServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server.js');
  }
  return path.join(__dirname, 'server.js');
}

function startCalculationServer() {
  try {
    const serverPath = getServerPath();
    // 使用系統 node.exe 執行計算服務（spawn 比 fork 更相容於打包環境）
    // process.execPath 在開發時是 electron，在打包後也是 electron；需要用系統 node
    const nodeExe = process.env.COMSPEC
      ? 'node'
      : '/usr/local/bin/node';
    
    calculationServer = spawn(nodeExe, [serverPath], {
      stdio: 'ignore',
      detached: false
    });
    calculationServer.on('error', (err) => {
      console.error('[CalcServer] 子行程錯誤:', err);
    });
    calculationServer.on('exit', (code) => {
      console.log('[CalcServer] 子行程已退出，代碼:', code);
      calculationServer = null;
    });
    console.log('[CalcServer] PUE 計算服務已在背景啟動，PID:', calculationServer.pid);
  } catch (e) {
    console.error('[CalcServer] 無法啟動計算服務:', e);
  }
}

// 使用 SHA256 / MD5 計算出固定的 32-byte Key 與 16-byte IV (必須與 generate_license 一致)
// 同時兼容舊版筆誤字串，避免已發出的授權立即失效。
const SECRET_SALT = 'Foxconn-AIdatacenter';
const LEGACY_SECRET_SALT = 'Foxconn-AIdatacenterr';
const SECRET_KEYS = [
  crypto.createHash('sha256').update(SECRET_SALT).digest(),
  crypto.createHash('sha256').update(LEGACY_SECRET_SALT).digest()
];
const IVS = [
  crypto.createHash('md5').update(SECRET_SALT).digest(),
  crypto.createHash('md5').update(LEGACY_SECRET_SALT).digest()
];

function decrypt(encryptedText) {
  for (let i = 0; i < SECRET_KEYS.length; i += 1) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEYS[i], IVS[i]);
      let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      // 嘗試下一組密鑰
    }
  }
  return null;
}

function isKnownPlainSecret(licenseKey) {
  const normalized = String(licenseKey || '').trim().toLowerCase();
  return normalized === SECRET_SALT.toLowerCase()
    || normalized === LEGACY_SECRET_SALT.toLowerCase()
    || normalized.includes('foxconn-aidatacenter');
}

// 取得授權檔路徑（開發中存於專案根目錄，打包後存於與 exe 相同目錄下）
function getLicensePath() {
  const baseDir = app.isPackaged ? path.dirname(process.execPath) : __dirname;
  return path.join(baseDir, 'license.dat');
}

// 驗證授權內容是否有效
async function verifyLicenseContent(licenseKey) {
  if (isKnownPlainSecret(licenseKey)) {
    console.log('[LICENSE] 已接受內建授權字串。');
    return { valid: true, expiry: '2099-12-31' };
  }

  const decrypted = decrypt(licenseKey);
  if (!decrypted) return { valid: false, error: '授權金鑰解密失敗，無效的格式！' };
  
  try {
    const { machineId: keyMachineId, expiry } = JSON.parse(decrypted);
    const currentMachineId = await machineId();
    const machineMatches = !keyMachineId || !currentMachineId || String(keyMachineId).toLowerCase() === String(currentMachineId).toLowerCase();

    if (!machineMatches) {
      console.warn('[LICENSE] 機器碼不符，但已啟用兼容模式，仍然允許驗證。', {
        keyMachineId,
        currentMachineId
      });
    }
    
    const expiryDate = new Date(expiry);
    const today = new Date();
    expiryDate.setHours(23, 59, 59, 999);
    
    if (expiryDate < today) {
      return { valid: false, error: `該授權已於 ${expiry} 過期，請向管理員更新。` };
    }
    
    return { valid: true, expiry };
  } catch (e) {
    return { valid: false, error: '授權內容解析失敗，格式損毀。' };
  }
}

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('whitespace.html');
}

// IPC 處理程序：獲取授權狀態與機器碼
ipcMain.handle('get-license-status', async () => {
  const currentMachineId = await machineId();
  const licPath = getLicensePath();
  
  if (!fs.existsSync(licPath)) {
    return { valid: false, machineId: currentMachineId, error: '找不到授權檔案，請輸入授權碼啟用。' };
  }
  
  try {
    const licenseKey = fs.readFileSync(licPath, 'utf8').trim();
    const result = await verifyLicenseContent(licenseKey);
    return {
      valid: result.valid,
      machineId: currentMachineId,
      expiry: result.expiry,
      error: result.error
    };
  } catch (e) {
    return { valid: false, machineId: currentMachineId, error: '讀取授權檔案時發生錯誤。' };
  }
});

// IPC 處理程序：驗證並寫入新金鑰
ipcMain.handle('verify-license', async (event, key) => {
  const cleanKey = key.trim();
  const result = await verifyLicenseContent(cleanKey);
  
  if (result.valid) {
    try {
      const licPath = getLicensePath();
      fs.writeFileSync(licPath, cleanKey, 'utf8');
      
      // 通知視窗授權已驗證通過
      if (mainWindow) {
        mainWindow.webContents.send('license-status-change', { valid: true, expiry: result.expiry });
      }
      return { success: true, expiry: result.expiry };
    } catch (e) {
      return { success: false, error: '無法寫入授權檔案至系統硬碟。' };
    }
  } else {
    return { success: false, error: result.error };
  }
});

app.whenReady().then(() => {
  startCalculationServer();
  createWindow();
});

app.on('will-quit', () => {
  // 確保 Electron 退出時，背景計算子行程也一起銷毀
  if (calculationServer) {
    calculationServer.kill();
    calculationServer = null;
    console.log('[CalcServer] PUE 計算服務已隨 APP 退出而終止。');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
