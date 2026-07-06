const http = require('http');

const PORT = 3000;

function calculatePUE(data) {
  const itLoad = data.whitespaceLoad || 1200;
  const chillerPower = data.chillerPower || (itLoad * 0.12);
  
  // 原本 app.js 的多組件 PUE 熱工模型公式
  const upsLoss = itLoad * 0.0417; // 96% 效率
  const distLoss = itLoad * 0.015; // 1.5% 配電損失
  const crahFan = itLoad * 0.2 * 0.06; // CRAH 負荷
  const cduPower = 2.0; // CDU 功耗
  const pumpPower = itLoad * 0.03; // 幫浦轉速功耗
  const towerPower = itLoad * 0.01; // 水塔風扇功耗
  const infraPower = 50.0; // 標準輔助功耗
  
  const totalPower = itLoad + upsLoss + distLoss + crahFan + cduPower + chillerPower + pumpPower + towerPower + infraPower;
  const calculatedPUE = itLoad > 0 ? (totalPower / itLoad) : 1.0;
  
  return {
    success: true,
    pue: parseFloat(calculatedPUE.toFixed(3)),
    totalPower: parseFloat(totalPower.toFixed(1)),
    itLoad: itLoad,
    chillerPower: chillerPower
  };
}

const server = http.createServer((req, res) => {
  // 支援 CORS 跨域請求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/calculate-pue') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const result = calculatePUE(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'JSON 解析失敗' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '路徑不存在' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PUE 計算伺服器已啟動：http://127.0.0.1:${PORT}`);
});
