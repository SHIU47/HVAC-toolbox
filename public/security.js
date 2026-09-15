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

    // 注意：debugger 偵測與視窗大小偵測已移除
    // 原因：在 file:// 協議或離線環境下，debugger 執行時間本就較長
    // 容易產生誤判，將正常頁面清空。
})();