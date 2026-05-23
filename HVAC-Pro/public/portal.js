// Unified Data Center Portal Controller

const iframe = document.getElementById('viewport-iframe');
const loader = document.getElementById('loader-overlay');
const loaderText = document.getElementById('loader-text');

// Module titles for loading indicator
const moduleNames = {
    'whitespace': 'GB200 液冷機房 (IT Load Space)',
    'mep-room': '關鍵機電灰區 (Power Room)',
    'chiller-plant': '冰水動力中心 (Cooling Plant)'
};

// Telemetry cache to prevent values from disappearing when switching views
let telemetryCache = {
    whitespace: { load: 1200, supply: 45.0, return: 55.0, pue: 1.266, flow: 165 },
    'mep-room': { grid: 1450, ups: 1250, soc: 100, scenario: 'normal' },
    'chiller-plant': { chws: 12.0, chwr: 18.0, cws: 28.5, cwr: 34.0, cooling: 850, flow: 510, cop: 6.2 }
};

// Global system of systems state object for cross-module coupling
let globalState = {
    whitespaceLoad: 1200,      // Total IT Load in kW
    chillerCOP: 6.2,           // COP of Chiller
    chillerPower: 137,         // Power consumption of Chiller Plant in kW
    mepScenario: 'normal',     // mep-room power scenario
    mepSoc: 100,               // battery state of charge
    waterSupplyTemp: 45.0,     // Secondary chilled water supply temp
    upsUpgraded: false         // UPS capacity upgraded flag
};

// Switch active iframe module
function switchModule(moduleKey) {
    // 1. Update navigation button styles
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-module') === moduleKey) {
            btn.classList.add('active');
        }
    });

    // 2. Activate loader overlay
    loaderText.innerText = `正在連結 ${moduleNames[moduleKey]}...`;
    loader.classList.add('active');

    // 3. Set iframe source (absolute URL to avoid resolution issues in nested iframes)
    const targetSrc = `${window.location.origin}/${moduleKey}/${moduleKey}.html`;
    iframe.src = targetSrc;
}

// Broadcast latest global State to active sub-module iframe
function sendCoupledDataToIframe() {
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'coupled_data',
            data: globalState
        }, '*');
    }
}

// Fades out loader overlay once iframe finishes loading and broadcasts coupling state
iframe.addEventListener('load', () => {
    sendCoupledDataToIframe();
    setTimeout(() => {
        loader.classList.remove('active');
    }, 400); // Subtle delay for smoother visual experience
});

// Map MEP scenarios to human-readable strings and styles
const mepScenarios = {
    'normal': { text: '正常供電 (2N Grid Secured)', color: '#22c55e' },
    'utilityFail': { text: '市電中斷! (UPS Battery Discharge)', color: '#ef4444' },
    'generator': { text: '發電機供電中 (Standby EDG Supplying)', color: '#f97316' },
    'bypass': { text: '旁路維修模式', color: '#fbbf24' }
};

// Listen to postMessage telemetry from the three modules
window.addEventListener('message', (event) => {
    // Safe guard: only accept messages from ourselves
    if (event.source !== iframe.contentWindow) return;

    const msg = event.data;

    // telemetry data from sub-modules
    if (msg.type === 'telemetry') {
        const moduleKey = msg.module;
        const data = msg.data;

        // Cache the incoming data
        telemetryCache[moduleKey] = data;

        // Synchronize incoming data into global state and trigger broadcasts upon change
        if (moduleKey === 'whitespace') {
            if (Math.abs(globalState.whitespaceLoad - data.load) > 1) {
                globalState.whitespaceLoad = data.load;
                sendCoupledDataToIframe();
            }
            globalState.waterSupplyTemp = data.supply;
        } else if (moduleKey === 'mep-room') {
            if (globalState.mepScenario !== data.scenario) {
                globalState.mepScenario = data.scenario;
                sendCoupledDataToIframe();
            }
            globalState.mepSoc = data.soc;
        } else if (moduleKey === 'chiller-plant') {
            globalState.chillerCOP = data.cop || 6.2;
            globalState.chillerPower = (data.cooling * 3.517) / globalState.chillerCOP;
        }

        // Dynamically update portal DOM
        updateDashboard();
    }
    
    // sizing_result updates from sub-modules
    if (msg.type === 'sizing_result') {
        const moduleKey = msg.module;
        const data = msg.data;
        
        if (moduleKey === 'whitespace') {
            globalState.whitespaceLoad = data.total_load; // Update load from whitespace calculator
            sendCoupledDataToIframe();
        } else if (moduleKey === 'chiller-plant') {
            globalState.chillerCOP = data.cop || 6.2;
            sendCoupledDataToIframe();
        }
    }
});

// Update the unified dashboard values based on cached telemetry
function updateDashboard() {
    // 1. Whitespace module metrics
    const ws = telemetryCache['whitespace'];
    if (ws) {
        const loadEl = document.getElementById('global_load');
        if (loadEl) loadEl.innerText = ws.load.toFixed(0);
        
        const pueEl = document.getElementById('global_pue');
        if (pueEl) pueEl.innerText = ws.pue.toFixed(3);
        
        const supplyEl = document.getElementById('global_supply');
        if (supplyEl) supplyEl.innerText = ws.supply.toFixed(1);
        
        const flowEl = document.getElementById('status_flow');
        if (flowEl) flowEl.innerText = ws.flow.toFixed(0);
        
        const flowSecEl = document.getElementById('status_flow_secondary');
        if (flowSecEl) flowSecEl.innerText = ws.flow.toFixed(0);
    }

    // 2. MEP Room module metrics
    const mep = telemetryCache['mep-room'];
    if (mep) {
        const scenarioInfo = mepScenarios[mep.scenario] || mepScenarios['normal'];
        const gridStatusEl = document.getElementById('global_grid_status');
        if (gridStatusEl) {
            gridStatusEl.innerText = scenarioInfo.text;
            gridStatusEl.style.color = scenarioInfo.color;
        }

        const socEl = document.getElementById('status_soc');
        if (socEl) socEl.innerText = mep.soc.toFixed(0);
    }

    // 3. Chiller Plant module metrics
    const chill = telemetryCache['chiller-plant'];
    if (chill && chill.cooling !== undefined) {
        const chillerRtEl = document.getElementById('global_chiller_rt');
        if (chillerRtEl) chillerRtEl.innerText = chill.cooling.toFixed(0);
    }
}

// Initial update on page load
updateDashboard();

// Toggle portal left sidebar navigation
let sidebarCollapsed = false;
function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    const mainView = document.getElementById('main-view');
    const icon = document.getElementById('sidebar_toggle_icon');
    const btn = document.getElementById('btn_toggle_sidebar');
    const floatBtn = document.getElementById('floating-expand-btn');
    
    if (sidebarCollapsed) {
        mainView.classList.add('collapsed');
        if (icon) {
            icon.className = 'ph ph-caret-double-right text-xs';
        }
        if (btn) btn.classList.add('active');
        if (floatBtn) floatBtn.classList.add('visible');
    } else {
        mainView.classList.remove('collapsed');
        if (icon) {
            icon.className = 'ph ph-caret-double-left text-xs';
        }
        if (btn) btn.classList.remove('active');
        if (floatBtn) floatBtn.classList.remove('visible');
    }
}

// Sizing Sizing Audit Modal State & Control
function toggleAuditModal() {
    const modal = document.getElementById('audit-modal-overlay');
    if (modal) {
        modal.classList.toggle('hidden');
        modal.classList.toggle('flex');
        
        // Update values dynamically in the modal based on latest global PUE
        const ws = telemetryCache['whitespace'];
        const auditPueEl = document.getElementById('audit_pue');
        if (auditPueEl && ws) {
            auditPueEl.innerText = ws.pue.toFixed(3);
        }
    }
}

function applyUpsUpgrade() {
    globalState.upsUpgraded = true;
    
    // Broadcast upgraded capacity state to all child iframes
    sendCoupledDataToIframe();
    
    // Update badge and text in sidebar
    const badge = document.getElementById('audit-badge');
    if (badge) {
        badge.innerText = '✅ 安全';
        badge.className = 'text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.2 rounded font-bold';
    }
    
    const btnIcon = document.getElementById('audit-btn-icon');
    if (btnIcon) {
        btnIcon.className = 'ph ph-shield-check text-green-400 text-xs';
    }
    
    // Update UPS card in modal
    const upsCard = document.querySelector('#audit-modal-overlay .bg-red-500\\/5');
    if (upsCard) {
        upsCard.className = 'bg-green-500/5 border border-green-500/25 p-4 rounded-xl flex flex-col justify-between';
        
        const upsHeader = upsCard.querySelector('h4');
        if (upsHeader) upsHeader.className = 'font-bold text-green-400 flex items-center gap-1.5';
        
        const upsBadge = upsCard.querySelector('span');
        if (upsBadge) {
            upsBadge.className = 'text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold';
            upsBadge.innerText = '✅ 正常符合';
        }
        
        const upsSpecs = upsCard.querySelector('.font-mono.text-slate-400');
        if (upsSpecs) upsSpecs.innerText = '3台 * 500kVA (1350 kW)';
        
        const upsLoad = upsCard.querySelector('.text-red-400');
        if (upsLoad) {
            upsLoad.className = 'font-mono font-bold text-green-400';
            upsLoad.innerText = '88.8% (安全範圍)';
        }
        
        const upsDesc = upsCard.querySelector('p');
        if (upsDesc) {
            upsDesc.className = 'text-[10px] text-green-300/80 border-t border-green-500/10 pt-3 mt-3 leading-relaxed';
            upsDesc.innerHTML = '<b>🟢 升級成功</b>：已增設第三台 500kVA UPS 模組，完成 2N N+1 冗餘安全防線，為 1.2 MW IT 臨界負載提供安全電力保護。';
        }
    }
    
    const upgradeBtn = document.getElementById('btn-upgrade-ups');
    if (upgradeBtn) {
        upgradeBtn.disabled = true;
        upgradeBtn.className = 'px-4 py-2 bg-slate-800 text-slate-500 font-bold rounded-lg transition cursor-not-allowed';
        upgradeBtn.innerText = 'UPS 已完成擴容';
    }
}
