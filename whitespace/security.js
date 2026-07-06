(function() {
    // 1. 禁用右鍵選單
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // 2. 禁用常見開發者快捷鍵 (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S, Ctrl+P)
    document.addEventListener('keydown', function(e) {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's' || e.key === 'P' || e.key === 'p'))
        ) {
            e.preventDefault();
            return false;
        }
    });

    // 3. 無限 debugger 迴圈防護 (當開發者工具打開時，會不斷卡在斷點)
    function devtoolsDetector() {
        let before = new Date().getTime();
        debugger;
        let after = new Date().getTime();
        // 如果執行 debugger 的時間超過 100ms，代表 DevTools 被打開了並卡住了
        if (after - before > 100) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:24px;color:#333;background:#f8fafc;">⚠️ 系統安全防護：偵測到開發者工具已開啟，頁面已鎖定。</div>';
        }
    }

    // 定期執行偵測 (使用 setTimeout 以免阻斷主執行緒)
    setInterval(function() {
        // 手機裝置容易因為效能波動導致誤判，因此略過此檢查
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
        devtoolsDetector();
    }, 1000);

    // 4. 偵測視窗大小改變 (舊方法的優化，防止單獨視窗開啟的 DevTools)
    var devtoolsOpen = false;
    setInterval(function() {
        // 手機裝置的瀏覽器網址列、導覽列會造成 outer/inner 差異極大，極易誤判，因此略過此檢查
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
        
        // 新增優化：如果是在 iframe 中運行，outerWidth 和 innerWidth 寬差為側邊欄寬度，會造成誤判，因此略過
        if (window !== window.top) return;
        
        var threshold = 160;
        var widthDiff = window.outerWidth - window.innerWidth;
        var heightDiff = window.outerHeight - window.innerHeight;
        if (widthDiff > threshold || heightDiff > threshold) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:24px;color:#333;background:#f8fafc;">⚠️ 系統安全防護：請關閉開發者工具。</div>';
            }
        } else {
            devtoolsOpen = false;
        }
    }, 1000);

})();
