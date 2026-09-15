const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'whitespace', 'whitespace.html');
let content = fs.readFileSync(filePath, 'utf8');

const errorHandlerScript = `
    <!-- 錯誤偵測輔助工具 -->
    <script>
        window.onerror = function(message, source, lineno, colno, error) {
            const div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.top = '0';
            div.style.left = '0';
            div.style.right = '0';
            div.style.backgroundColor = '#ef4444';
            div.style.color = '#ffffff';
            div.style.padding = '20px';
            div.style.zIndex = '999999';
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '14px';
            div.style.whiteSpace = 'pre-wrap';
            div.style.borderBottom = '4px solid #b91c1c';
            div.innerHTML = '🚨 <strong>偵測到執行期錯誤：</strong><br>' + 
                            '訊息: ' + message + '<br>' +
                            '檔案: ' + source + '<br>' +
                            '行號: ' + lineno + '，列號: ' + colno + '<br>' +
                            '堆疊資訊:<br>' + (error ? error.stack : '無堆疊資訊');
            document.body.appendChild(div);
            return false;
        };
        window.addEventListener('unhandledrejection', function(event) {
            const div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.top = '0';
            div.style.left = '0';
            div.style.right = '0';
            div.style.backgroundColor = '#f97316';
            div.style.color = '#ffffff';
            div.style.padding = '20px';
            div.style.zIndex = '999999';
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '14px';
            div.style.whiteSpace = 'pre-wrap';
            div.style.borderBottom = '4px solid #c2410c';
            div.innerHTML = '🚨 <strong>偵測到未處理的 Promise 拒絕：</strong><br>' + 
                            '原因: ' + (event.reason ? (event.reason.stack || event.reason.message || event.reason) : '未知');
            document.body.appendChild(div);
        });
    </script>
`;

if (!content.includes('<!-- 錯誤偵測輔助工具 -->')) {
    content = content.replace('<head>', '<head>' + errorHandlerScript);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Injected error handler script into public/whitespace/whitespace.html");
} else {
    console.log("Error handler script already exists in public/whitespace/whitespace.html");
}
