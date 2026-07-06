const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 使用 SHA256 / MD5 計算出固定的 32-byte Key 與 16-byte IV
const SECRET_KEY = crypto.createHash('sha256').update('Foxconn-AIdatacenter').digest(); 
const IV = crypto.createHash('md5').update('Foxconn-AIdatacenter').digest(); 

function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('NVIDIA Vera Rubin NVL72 授權碼產生器 (管理員專用)');
    console.log('用法: node generate_license.js <機器碼/MachineId> [有效天數, 預設 365]');
    console.log('範例: node generate_license.js XXX-YYY-ZZZ 90');
    process.exit(1);
  }

  const machineId = args[0].trim();
  const days = parseInt(args[1] || '365', 10);
  
  if (isNaN(days) || days <= 0) {
    console.error('錯誤: 有效天數必須是正整數！');
    process.exit(1);
  }

  // 計算到期日期 (格式: YYYY-MM-DD)
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  const expiryStr = expiryDate.toISOString().split('T')[0];

  // 封裝授權 JSON
  const licenseData = JSON.stringify({
    machineId: machineId,
    expiry: expiryStr
  });

  const licenseKey = encrypt(licenseData);

  console.log('\n==================================================');
  console.log(' 授權資訊生成成功！');
  console.log('--------------------------------------------------');
  console.log(`機器代碼: ${machineId}`);
  console.log(`有效天數: ${days} 天`);
  console.log(`有效期限: ${expiryStr}`);
  console.log('--------------------------------------------------');
  console.log('授權金鑰 (請傳送給使用者，貼入 APP 啟用輸入框):');
  console.log(licenseKey);
  console.log('==================================================\n');

  // 同時在目前目錄生成一個測試用的 license.dat，方便本機直接測試
  fs.writeFileSync(path.join(__dirname, 'license.dat'), licenseKey, 'utf8');
  console.log('已自動在目前目錄輸出測試用 [license.dat] 檔案。\n');
}

main();
