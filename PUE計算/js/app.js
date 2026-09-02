/**
 * app.js - 5-Step Application Controller with Routing Guard (V20)
 */
(function(window) {
    'use strict';

    const App = {
        currentStep: 1,
        totalSteps: 5,

        init() {
            let restored = false;
            // 嘗試從 localStorage 還原先前暫存工作階段
            if (window.AppStore && typeof window.AppStore.loadAutoSave === 'function') {
                restored = window.AppStore.loadAutoSave();
            }

            // 還原舊專案後，sizing[].catalog 是產生當下的靜態快照，新增/更新
            // device_catalog 廠商資料不會自動反映到已存的專案裡，需主動刷新。
            if (restored && window.AppStore && typeof window.AppStore.refreshDeviceCatalogs === 'function') {
                window.AppStore.refreshDeviceCatalogs();
            }

            if (!restored) {
                if (window.BUILTIN_WEATHER_DATA && window.BUILTIN_WEATHER_DATA['桃園 (Taoyuan Pilot)']) {
                    const data = window.BUILTIN_WEATHER_DATA['桃園 (Taoyuan Pilot)'];
                    window.AppStore.updateSite({
                        selectedCity: '桃園 (Taoyuan Pilot)',
                        stationName: data.stationInfo.location,
                        country: data.stationInfo.country,
                        lat: data.stationInfo.lat,
                        lon: data.stationInfo.lon,
                        elev: data.stationInfo.elev,
                        isRealEpw: true,
                        hourly: data.hourlyData
                    });
                } else {
                    window.AppStore.calculate();
                }
            }

            this.bindEvents();
            // v33: renderStep() 之後只掃描 #stepContent 容器內的圖示(見下方 renderStep)，
            // 頁首(儲存/開啟/重置)的圖示是寫在 index.html 裡、不在 #stepContent 內，
            // 只有這裡的全頁掃描做得到，且只需要在啟動時做一次。
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
            this.renderStep(1);
            this.updateStickyBar();

            window.AppStore.subscribe(() => {
                this.updateStickyBar();
            });
        },

        exportProjectFile() {
            const jsonStr = window.AppStore.serializeProject();
            const cityName = window.AppStore.state.site.selectedCity || 'Project';
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PUE_Project_${cityName}_${dateStr}.json`;
            a.click();
        },

        importProjectFile(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const ok = window.AppStore.deserializeProject(e.target.result);
                if (ok) {
                    this.renderStep(this.currentStep);
                    this.updateStickyBar();
                    alert('✅ 專案檔載入成功！');
                } else {
                    alert('❌ 專案檔格式錯誤，無法載入。');
                }
                event.target.value = '';
            };
            reader.readAsText(file);
        },

        resetProject() {
            if (confirm('確定要清除所有自訂配置並重置為預設範例專案嗎？')) {
                window.AppStore.resetProject();
                location.reload();
            }
        },

        bindEvents() {
            document.querySelectorAll('.step-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const step = parseInt(e.currentTarget.getAttribute('data-step'), 10);
                    if (step) this.goToStep(step);
                });
            });
        },

        goToStep(stepNum) {
            if (stepNum < 1 || stepNum > this.totalSteps) return;

            // B-7 fix: 任何步驟跳轉至 Step 5 都須通過 N+1 驗證
            if (stepNum === 5) {
                const check = window.AppStore.canProceedStep4();
                if (!check.ok) {
                    alert('⚠️ 尚有冷卻設備選型容量未達 N+1 規範，請先修正後方可檢視 Dashboard！');
                    return;
                }
            }

            this.currentStep = stepNum;
            this.renderStep(stepNum);
            this.updateStepperUI();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        nextStep() {
            this.goToStep(this.currentStep + 1);
        },

        prevStep() {
            this.goToStep(this.currentStep - 1);
        },

        renderStep(stepNum) {
            const container = document.getElementById('stepContent');
            if (!container) return;

            const viewHallSuObj = window.ViewHallSU || window.ViewHallSu;

            if (stepNum === 1 && window.ViewWeather) {
                window.ViewWeather.render(container);
            } else if (stepNum === 2 && viewHallSuObj) {
                viewHallSuObj.render(container);
            } else if (stepNum === 3 && window.ViewCorePod) {
                window.ViewCorePod.render(container);
            } else if (stepNum === 4 && window.ViewCooling) {
                window.ViewCooling.render(container);
            } else if (stepNum === 5 && window.ViewDashboard) {
                window.ViewDashboard.render(container);
            } else {
                container.innerHTML = '<div class="p-8 bg-red-50 border-2 border-red-400 rounded-2xl text-red-900 font-bold text-center">'
                    + '⚠️ 視圖模組 (Step ' + stepNum + ') 載入異常，請確認相關 JS 檔案是否已正確引入。'
                    + '</div>';
            }
            // v30 設計系統: 各 view 以 innerHTML 動態插入 data-lucide 圖示標籤，每次換頁都要重新掃描轉換成 SVG
            // v33: 限定只掃描剛換頁的 #stepContent 容器，不必每次都連同固定不變的
            // 頁首(儲存/開啟/重置按鈕圖示)一起重新掃描整份文件，減少換頁閃爍。
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons({ nodes: [container] });
            }
        },

        updateStepperUI() {
            document.querySelectorAll('.step-btn').forEach(btn => {
                const step = parseInt(btn.getAttribute('data-step'), 10);
                const circle = btn.querySelector('.step-circle');
                const title = btn.querySelector('.step-title');

                if (step === this.currentStep) {
                    btn.className = 'step-btn flex items-center gap-2 px-3 py-2 rounded-lg transition bg-brand-50 text-brand-800 border border-brand-200 font-semibold';
                    if (circle) circle.className = 'step-circle w-6 h-6 rounded-md bg-brand-600 text-white flex items-center justify-center text-xs font-semibold';
                    if (title) title.className = 'step-title text-xs font-semibold text-brand-800';
                } else if (step < this.currentStep) {
                    btn.className = 'step-btn flex items-center gap-2 px-3 py-2 rounded-lg transition text-primary hover:bg-border-subtle font-medium';
                    if (circle) circle.className = 'step-circle w-6 h-6 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold';
                    if (title) title.className = 'step-title text-xs font-medium text-primary';
                } else {
                    btn.className = 'step-btn flex items-center gap-2 px-3 py-2 rounded-lg transition text-secondary hover:bg-border-subtle font-medium';
                    if (circle) circle.className = 'step-circle w-6 h-6 rounded-md bg-border text-secondary flex items-center justify-center text-xs font-semibold';
                    if (title) title.className = 'step-title text-xs font-medium text-secondary';
                }
            });
        },

        updateStickyBar() {
            const res = window.AppStore.state.results.overall;
            const pEl = document.getElementById('stickyPue');
            const wEl = document.getElementById('stickyWue');
            const itEl = document.getElementById('stickyIt');
            const fcEl = document.getElementById('stickyFc');

            if (pEl) pEl.innerText = res.annualPue;
            if (wEl) wEl.innerText = res.annualWue + ' L/kWh';
            if (itEl) itEl.innerText = (res.totalItKw / 1000).toFixed(2) + ' MW';
            if (fcEl) fcEl.innerText = res.fcHoursPct + '%';
        }
    };

    window.App = App;
    document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
