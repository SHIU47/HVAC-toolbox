const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'public', 'index.html');
if (!fs.existsSync(targetFile)) {
    console.error("Target file does not exist!");
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// Identify Phase 3 block and replace it
const oldPhase3 = `                // --- Phase 3: Waste Heat Recovery ---
                window.addDemoLog('啟動廠區汽電共生廢熱回收模式，切換為「雙效吸收式主機」。', 'SYS');
                await sleep(800);
                window.addDemoLog('吸收式主機 COP 較低 (排熱比高)，冷卻排熱修正係數升至 1.85x。', 'WARN');
                if (typeSelect) typeSelect.value = 'absorption';
                if (rtInput) rtInput.value = 500;
                window.updateDemoSimulation(true);
                
                const cwLPM3 = Math.round((500 * 1.85 * 3024) / (5.0 * 60));
                window.addDemoLog(\`雙效吸收式運轉中。冷卻流量激增至 \${cwLPM3} LPM！冷卻水泵全速排除熱負荷。\`, 'THR');
                await sleep(3500);`;

const newPhase3 = `                // --- Phase 3: Medium Load Optimization ---
                window.addDemoLog('尖峰負載降低，自動切換至「水冷螺桿式主機」進行中載能效最佳化調節。', 'SYS');
                await sleep(800);
                if (typeSelect) typeSelect.value = 'screw';
                if (rtInput) rtInput.value = 500;
                window.updateDemoSimulation(true);
                
                const chwLPM3 = Math.round((500 * 3024) / (5.0 * 60));
                const cwLPM3 = Math.round((500 * 1.20 * 3024) / (5.0 * 60));
                window.addDemoLog(\`螺桿主機啟動。冰水流量調整為 \${chwLPM3} LPM | 系統綜合效率最佳化。\`, 'THR');
                window.addDemoLog(\`冷卻水量調降至 \${cwLPM3} LPM | 冷卻水泵轉速調降以節省功耗。\`, 'THR');
                await sleep(3500);`;

if (content.indexOf(oldPhase3) === -1) {
    console.error("Could not find the old Phase 3 block in index.html!");
    // Attempt minor spacing match if exact fails
    const fallbacks = [
        "啟動廠區汽電共生廢熱回收模式",
        "雙效吸收式"
    ];
    let foundFallback = false;
    for (const f of fallbacks) {
        if (content.indexOf(f) !== -1) {
            console.log(`Found fallback keyword "${f}". Doing regex replacement...`);
            content = content.replace(/\/\/ --- Phase 3: Waste Heat Recovery ---\s*[\s\S]*?\/\/ --- Phase 4: Night Low-Load/, newPhase3 + "\n\n                // --- Phase 4: Night Low-Load");
            foundFallback = true;
            break;
        }
    }
    if (!foundFallback) {
        process.exit(1);
    }
} else {
    content = content.replace(oldPhase3, newPhase3);
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log("Successfully replaced Absorption Chiller phase with Water-Cooled Screw Chiller phase in index.html!");
