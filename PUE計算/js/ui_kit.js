/**
 * ui_kit.js - v30 設計系統共用元件小函式
 * 集中管理狀態徽章/圖示/卡片的樣式字串，取代各 view 檔案各自寫死顏色 class 的作法。
 * 語意化 token (brand/danger/warn/border/surface...) 定義於 index.html 的 tailwind.config。
 */
(function(window) {
    'use strict';

    const UIKit = {
        // v33: XSS 防護 — 專案檔可從檔案匯入(見 App.importProjectFile)，設備名稱/型號等
        // 使用者可控字串在拼進 innerHTML 字串樣板前一律要跑這個，避免被竄改的 JSON
        // 專案檔(例如型號名稱夾帶 <script> 或跳出 onclick="...'+x+'..." 字串邊界)在
        // 開啟專案時執行任意程式碼。用於一般 HTML 內容位置 (標籤內文、屬性值)。
        escapeHTML(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        // 用於嵌在 onclick="EquipmentDesigner.fn('...'+x+'...')" 這種「HTML屬性裡的
        // 單引號JS字串常值」雙層情境 — 瀏覽器先把 HTML 屬性值解碼(還原 &quot;/&#39;等
        // HTML實體)、才把解碼後的文字交給 JS 引擎解析執行，所以順序必須是：
        //   1) 先做 JS 字串跳脫(反斜線、單引號) — 讓解碼後的 JS 仍是合法、值不變的字串常值
        //   2) 再做 HTML 屬性跳脫 — 讓這段文字不會提前跳出 onclick="..." 或整個標籤
        // 只用 escapeHTML 不夠：它把 ' 轉成 &#39;，瀏覽器解析屬性時照樣還原成 '，
        // 對「單引號JS字串常值」這層攻擊面沒有任何防護。
        escapeJsAttr(str) {
            const jsEscaped = String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return this.escapeHTML(jsEscaped);
        },

        // 狀態徽章: success(綠) / warning(黃, 尚未設定) / danger(紅, 不合格) / neutral(灰)
        badge(text, variant, iconName) {
            const variants = {
                success: 'bg-brand-50 text-brand-700 border-brand-200',
                warning: 'bg-warn-50 text-warn-600 border-amber-200',
                danger: 'bg-danger-50 text-danger-600 border-red-200',
                neutral: 'bg-border-subtle text-secondary border-border'
            };
            const cls = variants[variant] || variants.neutral;
            const icon = iconName ? `<i data-lucide="${iconName}" class="w-3 h-3"></i>` : '';
            return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${cls}">${icon}${text}</span>`;
        },

        // 三態設計狀態燈號 (v27/v25 規劃的灰/紅/綠): 'unconfigured' | 'fail' | 'pass'
        statusBadge(status, textMap) {
            const labels = textMap || { unconfigured: '尚未選型', fail: '容量不足', pass: '滿足 N+1' };
            if (status === 'pass') return this.badge(labels.pass, 'success', 'check-circle-2');
            if (status === 'fail') return this.badge(labels.fail, 'danger', 'x-circle');
            return this.badge(labels.unconfigured, 'neutral', 'circle-dashed');
        },

        icon(name, sizeClass) {
            return `<i data-lucide="${name}" class="${sizeClass || 'w-4 h-4'}"></i>`;
        },

        // 圖示置於柔和色底圓角方塊中 (Linear/Stripe 常見的「圖示徽章」樣式，取代裸圖示)
        iconBadge(name, variant, sizeClass) {
            const variants = {
                brand: 'bg-brand-50 text-brand-600',
                neutral: 'bg-border-subtle text-secondary',
                danger: 'bg-danger-50 text-danger-600',
                warn: 'bg-warn-50 text-warn-600',
                info: 'bg-sky-50 text-sky-600',
                violet: 'bg-violet-50 text-violet-600'
            };
            const cls = variants[variant] || variants.neutral;
            const box = sizeClass || 'w-7 h-7';
            const ic = sizeClass ? 'w-4.5 h-4.5' : 'w-4 h-4';
            return `<span class="inline-flex items-center justify-center ${box} rounded-md ${cls} shrink-0"><i data-lucide="${name}" class="${ic}"></i></span>`;
        },

        // 依 PUE 數值分級的顏色點 (供表格快速掃視用): <1.10 佳 / 1.10-1.20 普通 / >1.20 待改善
        pueDot(pue) {
            const v = parseFloat(pue);
            const cls = v < 1.10 ? 'bg-brand-500' : (v <= 1.20 ? 'bg-warn-500' : 'bg-danger-500');
            return `<span class="inline-block w-1.5 h-1.5 rounded-full ${cls} mr-1.5"></span>`;
        },

        // 柔和多層陰影 (取代「純邊框零陰影」的扁平感，也取代原本過重的 shadow-sm/md)
        SOFT_SHADOW: 'shadow-[0_1px_2px_rgba(24,24,27,0.04),0_4px_12px_-2px_rgba(24,24,27,0.05)]',
        HERO_SHADOW: 'shadow-[0_1px_2px_rgba(24,24,27,0.04),0_8px_24px_-4px_rgba(31,99,84,0.08)]',

        // 統一卡片外框 class：border + 柔和陰影組合出層次感，而非二選一
        cardClass(extra) {
            return `bg-surface border border-border rounded-lg ${this.SOFT_SHADOW} ${extra || ''}`.trim();
        },

        // 按鈕變體: primary / secondary / ghost / destructive
        buttonClass(variant) {
            const variants = {
                primary: `bg-brand-600 hover:bg-brand-700 text-white border border-brand-600 ${this.SOFT_SHADOW} hover:shadow-[0_2px_4px_rgba(24,24,27,0.06),0_8px_16px_-4px_rgba(31,99,84,0.18)]`,
                secondary: 'bg-surface hover:bg-border-subtle text-primary border border-border',
                ghost: 'bg-transparent hover:bg-border-subtle text-secondary border border-transparent',
                destructive: 'bg-surface hover:bg-danger-50 hover:text-danger-600 text-secondary border border-border'
            };
            const base = 'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 inline-flex items-center gap-1.5';
            return `${base} ${variants[variant] || variants.secondary}`;
        },

        // 數字滾動跳動動畫 (Magic UI 風格的低調微互動): 對指定元素從 0 或當前值滾到 target
        countUp(el, target, opts) {
            if (!el) return;
            const decimals = opts?.decimals ?? 3;
            const duration = opts?.duration ?? 900;
            const suffix = opts?.suffix ?? '';
            const start = 0;
            const t0 = performance.now();
            const ease = t => 1 - Math.pow(1 - t, 3); // ease-out cubic
            function tick(now) {
                const p = Math.min(1, (now - t0) / duration);
                const val = start + (target - start) * ease(p);
                el.textContent = val.toFixed(decimals) + suffix;
                if (p < 1) requestAnimationFrame(tick);
                else el.textContent = target.toFixed(decimals) + suffix;
            }
            requestAnimationFrame(tick);
        },

        // 換頁/重新渲染後呼叫，把 data-lucide 標籤轉成實際 SVG。
        // v33: 傳入 container 時只掃描該容器，避免每次都重新掃描整份文件；
        // 不傳則維持掃全頁(例如啟動時的一次性全頁掃描)。
        refreshIcons(container) {
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons(container ? { nodes: [container] } : undefined);
            }
        }
    };

    window.UIKit = UIKit;
})(typeof window !== 'undefined' ? window : global);
