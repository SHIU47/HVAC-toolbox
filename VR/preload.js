const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 獲取目前授權狀態與機器碼
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  // 送出金鑰進行驗證並儲存
  verifyLicense: (key) => ipcRenderer.invoke('verify-license', key),
  // 監聽授權狀態改變事件
  onLicenseStatusChange: (callback) => ipcRenderer.on('license-status-change', (event, data) => callback(data))
});
