const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'public', 'index.html');
if (!fs.existsSync(targetFile)) {
    console.error("Target file public/index.html does not exist!");
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// 1. Revert/Clean up the bad block inside renderTools
const startAnchor = 'card.onmouseleave = () => { if(heroAnim) heroAnim.setMode(\'idle\'); };';
const endAnchor = 'let cardHTML = `';

const startIndex = content.indexOf(startAnchor);
const endIndex = content.indexOf(endAnchor);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find renderTools anchors in index.html!");
    process.exit(1);
}

const beforeBlock = content.substring(0, startIndex + startAnchor.length);
const afterBlock = content.substring(endIndex);

content = beforeBlock + '\n\n' + afterBlock;
console.log("Successfully cleaned up the bad block from inside renderTools!");

// 2. Locate and replace the old playDemo function with our new global simulator logic
const oldPlayDemoStr = `        window.playDemo = function() {
            const playBtn = document.getElementById('demo-play-overlay');
            if(playBtn) { playBtn.style.opacity = '0'; playBtn.style.pointerEvents = 'none'; }
            let rtValue = 100;
            const interval = setInterval(() => {
                rtValue += 100; if (rtValue > 600) rtValue = 100;
                const inputCard = document.getElementById('demo-input-card');
                if(inputCard) { inputCard.classList.add('scale-105', 'border-blue-500/50'); setTimeout(() => inputCard.classList.remove('scale-105', 'border-blue-500/50'), 200); }
                const loadText = document.getElementById('demo-load-text'); if(loadText) loadText.innerText = \`\${rtValue} RT\`;
                const flowParticle = document.getElementById('flow-particle');
                if(flowParticle) { flowParticle.classList.add('flow-animate'); setTimeout(() => flowParticle.classList.remove('flow-animate'), 1500); }
                setTimeout(() => {
                    const resultCard = document.getElementById('demo-result-card'); const resFlow = document.getElementById('demo-result-flow');
                    if(resultCard) { resultCard.classList.remove('opacity-50', 'scale-95', 'grayscale'); resultCard.classList.add('scale-105', 'shadow-blue-500/50'); }
                    if(resFlow) resFlow.innerText = (rtValue * 2.4).toFixed(0);
                    setTimeout(() => {
                        if(resultCard) { resultCard.classList.remove('scale-105', 'shadow-blue-500/50'); if (rtValue === 600) setTimeout(() => resultCard.classList.add('opacity-50', 'scale-95', 'grayscale'), 1000); }
                    }, 300);
                }, 600);
            }, 2000);
            setTimeout(() => { clearInterval(interval); if(playBtn) { playBtn.style.opacity = '1'; playBtn.style.pointerEvents = 'auto'; } }, 12000);
        }`;

// Let's also clean up old updateLiveChart if needed, but wait! updateLiveChart is for the interactive bar chart section which we still want to keep! Yes, that's a different section "互動力：讓工具變聰明" which uses updateLiveChart. So we should keep updateLiveChart!
// We only replace window.playDemo.

const playDemoIndex = content.indexOf('window.playDemo = function()');
if (playDemoIndex === -1) {
    console.error("Could not find window.playDemo function in index.html!");
    process.exit(1);
}

// Find the end brace of playDemo by scanning the next lines
// Or we can just find the oldPlayDemoStr directly, let's try direct lookup first, if not we search dynamically.
let replacedPlayDemo = false;
if (content.indexOf(oldPlayDemoStr) !== -1) {
    content = content.replace(oldPlayDemoStr, getNewSimulatorCode());
    replacedPlayDemo = true;
} else {
    // If exact block doesn't match due to minor whitespace, let's scan from playDemoIndex to the closing brace
    console.log("Exact playDemo string did not match. Performing brace-matching search...");
    let braceCount = 0;
    let scanIndex = playDemoIndex;
    let foundStart = false;
    while (scanIndex < content.length) {
        const char = content[scanIndex];
        if (char === '{') {
            braceCount++;
            foundStart = true;
        } else if (char === '}') {
            braceCount--;
            if (foundStart && braceCount === 0) {
                // Found the end of the function!
                const before = content.substring(0, playDemoIndex);
                const after = content.substring(scanIndex + 1);
                content = before + getNewSimulatorCode() + after;
                replacedPlayDemo = true;
                break;
            }
        }
        scanIndex++;
    }
}

if (!replacedPlayDemo) {
    console.error("Failed to replace window.playDemo!");
    process.exit(1);
}
console.log("Successfully replaced playDemo function with new interactive simulator code!");

// 3. Inject updateDemoSimulation(true) in window.onload
const onloadAnchor = 'initObservers();';
const onloadIndex = content.indexOf(onloadAnchor);
if (onloadIndex === -1) {
    console.error("Could not find initObservers() anchor in index.html!");
    process.exit(1);
}

content = content.replace(onloadAnchor, 'initObservers();\n                if (window.updateDemoSimulation) window.updateDemoSimulation(true);');
console.log("Successfully injected updateDemoSimulation(true) in window.onload!");

// 4. Save index.html
fs.writeFileSync(targetFile, content, 'utf8');
console.log("Successfully saved index.html upgrades!");

function getNewSimulatorCode() {
    return `// ======================================================================
        // === INDEX INTERACTIVE SANDBOX REDESIGN SIMULATOR LOGIC ===
        // ======================================================================
        let demoSequenceActive = false;
        let lastChillerType = '';
        let lastCapacity = 0;
        let lastDt = 0;

        window.addDemoLog = function(msg, type = 'SYS') {
            const logBox = document.getElementById('demo-console-log');
            if (!logBox) return;
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false }) + '.' + 
                            now.getMilliseconds().toString().padStart(3, '0').substring(0, 2);
            let colorClass = 'text-emerald-400';
            if (type === 'WARN') colorClass = 'text-amber-400';
            if (type === 'ERR') colorClass = 'text-red-400';
            if (type === 'THR') colorClass = 'text-cyan-400/90';
            
            const newLine = \`<div>[\${timeStr}] <span class="\${colorClass}">[\${type}]</span> \${msg}</div>\`;
            logBox.innerHTML += newLine;
            
            // Limit to 40 lines
            while (logBox.children.length > 40) {
                logBox.removeChild(logBox.firstChild);
            }
            logBox.scrollTop = logBox.scrollHeight;
        };

        window.updateDemoSimulation = function(skipLog = false) {
            const typeSelect = document.getElementById('demo-chiller-type');
            const rtInput = document.getElementById('demo-rt');
            const dtInput = document.getElementById('demo-dt');
            if (!typeSelect || !rtInput || !dtInput) return;

            const chillerType = typeSelect.value;
            const capacity = parseFloat(rtInput.value);
            const dt = parseFloat(dtInput.value);

            // Update Labels
            const rtLabel = document.getElementById('demo-rt-label');
            const dtLabel = document.getElementById('demo-dt-label');
            const chillerCap = document.getElementById('demo-chiller-cap');
            if (rtLabel) rtLabel.innerText = capacity + ' RT';
            if (dtLabel) dtLabel.innerText = dt.toFixed(1) + ' °C';
            if (chillerCap) chillerCap.innerText = capacity + ' RT';

            // Calculate CHW
            const chwLPM = (capacity * 3024) / (dt * 60);
            const chwLPS = chwLPM / 60;
            const chwHead = 20; // m
            const chwEff = 0.70;
            const chwKW = (chwLPS * chwHead) / (102 * chwEff);

            // Update CHW Card
            const chwFlowEl = document.getElementById('demo-node-chw-flow');
            const chwPowerEl = document.getElementById('demo-node-chw-power');
            if (chwFlowEl) chwFlowEl.innerText = Math.round(chwLPM) + ' LPM';
            if (chwPowerEl) chwPowerEl.innerText = chwKW.toFixed(2) + ' kW';

            // Chiller Factors
            const factors = { centrifugal: 1.15, screw: 1.20, scroll: 1.25, absorption: 1.85, aircooled: 0.0 };
            const factor = factors[chillerType] !== undefined ? factors[chillerType] : 1.25;

            // Calculate CW
            const cwRT = capacity * factor;
            const cwDT = 5.0; // °C
            const cwLPM = factor > 0 ? (cwRT * 3024) / (cwDT * 60) : 0;
            const cwLPS = cwLPM / 60;
            const cwHead = 25; // m
            const cwEff = 0.70;
            const cwKW = factor > 0 ? (cwLPS * cwHead) / (102 * cwEff) : 0;

            // DOM elements
            const cwNode = document.getElementById('demo-node-cw');
            const cwFlowEl = document.getElementById('demo-node-cw-flow');
            const cwPowerEl = document.getElementById('demo-node-cw-power');
            const cwPipe = document.getElementById('demo-pipe-cw');
            const chillerFanBadge = document.getElementById('demo-chiller-fan-badge');
            const chillerStatus = document.getElementById('demo-chiller-status');

            // CHW Pipe Dash speed
            const chwPipeEl = document.getElementById('demo-pipe-chw');
            if (chwPipeEl) {
                const speed = Math.max(0.15, Math.min(2.5, 3000 / chwLPM));
                chwPipeEl.style.animationDuration = speed.toFixed(2) + 's';
            }

            // Pump Fan dynamic speed
            const chwFan = document.querySelector('.absolute.right-6.top-2 .fa-fan');
            if (chwFan) {
                chwFan.style.animationDuration = Math.max(0.15, Math.min(3.0, 8 / chwKW)) + 's';
            }

            if (chillerType === 'aircooled') {
                if (chillerFanBadge) chillerFanBadge.classList.remove('hidden');
                if (chillerStatus) {
                    chillerStatus.innerText = '● 氣冷運轉中';
                    chillerStatus.style.color = '#38bdf8';
                }
                if (cwNode) {
                    cwNode.style.opacity = '0.2';
                    cwNode.style.pointerEvents = 'none';
                    const nodeStatus = cwNode.querySelector('.node-status');
                    if (nodeStatus) {
                        nodeStatus.innerText = '● STANDBY';
                        nodeStatus.style.color = '#64748b';
                        nodeStatus.classList.remove('animate-pulse');
                    }
                    const cwFan = cwNode.querySelector('.fa-fan');
                    if (cwFan) cwFan.style.animationPlayState = 'paused';
                }
                if (cwFlowEl) cwFlowEl.innerText = '0 LPM';
                if (cwPowerEl) cwPowerEl.innerText = '0.00 kW';
                if (cwPipe) {
                    cwPipe.style.opacity = '0.1';
                    cwPipe.style.animationPlayState = 'paused';
                }
            } else {
                if (chillerFanBadge) chillerFanBadge.classList.add('hidden');
                if (chillerStatus) {
                    chillerStatus.innerText = '● 水冷運轉中';
                    chillerStatus.style.color = '#40c4ff';
                }
                if (cwNode) {
                    cwNode.style.opacity = '1.0';
                    cwNode.style.pointerEvents = 'auto';
                    const nodeStatus = cwNode.querySelector('.node-status');
                    if (nodeStatus) {
                        nodeStatus.innerText = '● PUMP RUNNING';
                        nodeStatus.style.color = '#10b981';
                        nodeStatus.classList.add('animate-pulse');
                    }
                    const cwFan = cwNode.querySelector('.fa-fan');
                    if (cwFan) {
                        cwFan.style.animationPlayState = 'running';
                        cwFan.style.animationDuration = Math.max(0.15, Math.min(3.0, 12 / cwKW)) + 's';
                    }
                }
                if (cwFlowEl) cwFlowEl.innerText = Math.round(cwLPM) + ' LPM';
                if (cwPowerEl) cwPowerEl.innerText = cwKW.toFixed(2) + ' kW';
                if (cwPipe) {
                    cwPipe.style.opacity = '1.0';
                    cwPipe.style.animationPlayState = 'running';
                    const speed = Math.max(0.15, Math.min(2.5, 3500 / cwLPM));
                    cwPipe.style.animationDuration = speed.toFixed(2) + 's';
                }
            }

            // Real-time Logging (only log if changed and skipLog is false)
            if (!skipLog && !demoSequenceActive) {
                if (chillerType !== lastChillerType) {
                    const typeNames = { centrifugal: '水冷離心式', screw: '水冷螺桿式', scroll: '水冷渦卷式', absorption: '雙效吸收式', aircooled: '氣冷式主機' };
                    window.addDemoLog(\`冰機類型切換為：\${typeNames[chillerType]}\`, 'SYS');
                    lastChillerType = chillerType;
                }
                if (capacity !== lastCapacity) {
                    window.addDemoLog(\`製冷負載調整為：\${capacity} RT\`, 'SYS');
                    lastCapacity = capacity;
                }
                if (dt !== lastDt) {
                    window.addDemoLog(\`冰水設計溫差調整為：\${dt.toFixed(1)} °C\`, 'SYS');
                    lastDt = dt;
                }
            }
        };

        window.playDemoAutoSequence = function() {
            if (demoSequenceActive) return;
            demoSequenceActive = true;

            const autoBtn = document.getElementById('demo-auto-btn');
            const typeSelect = document.getElementById('demo-chiller-type');
            const rtInput = document.getElementById('demo-rt');
            const dtInput = document.getElementById('demo-dt');

            // Disable controls
            if (autoBtn) {
                autoBtn.disabled = true;
                autoBtn.innerHTML = \`<i class="fa-solid fa-spinner animate-spin"></i> <span>演示中 | AUTO SIMULATING...</span>\`;
                autoBtn.classList.remove('bg-google-blue/15', 'text-google-blue', 'border-google-blue/30');
                autoBtn.classList.add('bg-amber-500/20', 'text-amber-400', 'border-amber-500/40', 'animate-pulse');
            }
            if (typeSelect) typeSelect.disabled = true;
            if (rtInput) rtInput.disabled = true;
            if (dtInput) dtInput.disabled = true;

            const logBox = document.getElementById('demo-console-log');
            if (logBox) logBox.innerHTML = '';

            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

            // Run async flow sequence
            (async () => {
                // --- Phase 1: Normal Start ---
                window.addDemoLog('啟動系統自動調變演示序列...', 'SYS');
                await sleep(600);
                if (typeSelect) typeSelect.value = 'scroll';
                if (rtInput) rtInput.value = 300;
                if (dtInput) dtInput.value = 5.0;
                window.updateDemoSimulation(true);
                
                window.addDemoLog('載入常規設計負載：300 RT 水冷渦卷式冰機。', 'SYS');
                await sleep(1000);
                const chwLPM1 = Math.round((300 * 3024) / (5.0 * 60));
                const cwLPM1 = Math.round((300 * 1.25 * 3024) / (5.0 * 60));
                window.addDemoLog(\`冰水流量: \${chwLPM1} LPM | 水泵功耗: 21.16 kW | 系統運轉 COP: 4.80\`, 'THR');
                await sleep(2500);

                // --- Phase 2: Peak Load Capacity Surge ---
                window.addDemoLog('偵測到廠區空調需求攀升，負載達 800 RT 尖峰！', 'WARN');
                await sleep(800);
                window.addDemoLog('自動切換至高容量「水冷離心式主機」以維持最佳能效比。', 'SYS');
                if (typeSelect) typeSelect.value = 'centrifugal';
                
                // Animate capacity slider from 300 to 800 RT
                for (let rt = 300; rt <= 800; rt += 50) {
                    if (rtInput) rtInput.value = rt;
                    window.updateDemoSimulation(true);
                    await sleep(100);
                }
                const chwLPM2 = Math.round((800 * 3024) / (5.0 * 60));
                const cwLPM2 = Math.round((800 * 1.15 * 3024) / (5.0 * 60));
                window.addDemoLog(\`離心冰機運作正常。冰水流量增至 \${chwLPM2} LPM | 冰水泵高頻全載運轉。\`, 'THR');
                window.addDemoLog(\`冷卻排熱流量攀升至 \${cwLPM2} LPM | 冷卻水泵功耗: 81.33 kW\`, 'THR');
                await sleep(3500);

                // --- Phase 3: Waste Heat Recovery ---
                window.addDemoLog('啟動廠區汽電共生廢熱回收模式，切換為「雙效吸收式主機」。', 'SYS');
                await sleep(800);
                window.addDemoLog('吸收式主機 COP 較低 (排熱比高)，冷卻排熱修正係數升至 1.85x。', 'WARN');
                if (typeSelect) typeSelect.value = 'absorption';
                if (rtInput) rtInput.value = 500;
                window.updateDemoSimulation(true);
                
                const cwLPM3 = Math.round((500 * 1.85 * 3024) / (5.0 * 60));
                window.addDemoLog(\`雙效吸收式運轉中。冷卻流量激增至 \${cwLPM3} LPM！冷卻水泵全速排除熱負荷。\`, 'THR');
                await sleep(3500);

                // --- Phase 4: Night Low-Load & Water-Saving Mode ---
                window.addDemoLog('進入夜間低負荷節能時段，切換為 150 RT 模組化「氣冷式主機」。', 'SYS');
                await sleep(800);
                window.addDemoLog('自動隔離並關閉冷卻水迴路 (CW Loop Isolated) 以節省冷卻塔蒸發水量。', 'SYS');
                if (typeSelect) typeSelect.value = 'aircooled';
                if (rtInput) rtInput.value = 150;
                window.updateDemoSimulation(true);
                
                window.addDemoLog('冷卻水泵切換至節能待機 (Standby) | 流量歸零。', 'WARN');
                window.addDemoLog('啟動氣冷主機頂部風扇群組進行強制對流散熱中。', 'SYS');
                await sleep(3500);

                // --- Phase 5: Complete ---
                window.addDemoLog('系統動態模擬調變序列圓滿完成。', 'SYS');
                await sleep(500);
                window.addDemoLog('運轉診斷：全系統水力與熱平衡狀態優良。', 'SYS');
                window.addDemoLog('節能評估：離心式運轉綜合 COP 達 5.6，夜間氣冷模式符合廠區節水規範。', 'SYS');

                // Enable controls
                if (autoBtn) {
                    autoBtn.disabled = false;
                    autoBtn.innerHTML = \`<i class="fa-solid fa-play animate-pulse"></i> <span>執行自動核心演示</span>\`;
                    autoBtn.classList.remove('bg-amber-500/20', 'text-amber-400', 'border-amber-500/40', 'animate-pulse');
                    autoBtn.classList.add('bg-google-blue/15', 'text-google-blue', 'border-google-blue/30');
                }
                if (typeSelect) typeSelect.disabled = false;
                if (rtInput) rtInput.disabled = false;
                if (dtInput) dtInput.disabled = false;

                // Sync last states
                lastChillerType = typeSelect.value;
                lastCapacity = parseFloat(rtInput.value);
                lastDt = parseFloat(dtInput.value);
                demoSequenceActive = false;
            })();
        };`;
}
