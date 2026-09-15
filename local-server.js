const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 5000;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    // 解碼網址以支援中文檔名 (e.g. PCW計算.html)
    const decodedUrl = decodeURIComponent(req.url);
    let filePath = path.join(DIST_DIR, decodedUrl === '/' ? 'index.html' : decodedUrl);
    
    // 安全檢查：防目錄遍歷
    if (!filePath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end('403 Forbidden');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 若找不到檔案，嘗試將其視為目錄尋找 index.html
                const fallbackPath = path.join(filePath, 'index.html');
                fs.readFile(fallbackPath, (err2, htmlContent) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>404 Not Found (找不到網頁)</h1>', 'utf-8');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(htmlContent, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 HVAC Pro 本地伺服器已成功啟動！`);
    console.log(`🔗 網址：http://localhost:${PORT}/index.html`);
    console.log(`==================================================`);
    console.log(`正在為您自動開啟瀏覽器...`);
    
    // 在 Windows 下自動開啟預設瀏覽器
    exec(`start http://localhost:${PORT}/index.html`, (err) => {
        if (err) {
            console.log(`無法自動開啟瀏覽器，請手動複製網址到瀏覽器開啟。`);
        }
    });
});
