'use strict';
/**
 * topo_preview.js - Render and screenshot P&ID SVG schematics using headless Chrome/Edge.
 * 
 * Usage:
 *   node tools/pue_regression/topo_preview.js [--city "高雄 (Kaohsiung)"] [--only <arch>]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const HTML_DIR = path.join(PROJECT_ROOT, 'public/Data center Cal');
const INDEX_HTML = path.join(HTML_DIR, 'index.html');
const OUT_DIR = path.resolve(__dirname, 'topo_out');

// 1. Locate Browser
function findBrowser() {
    const candidates = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    throw new Error('Neither Google Chrome nor Microsoft Edge was found at standard paths.');
}

// 2. Prepare Preview HTML
function preparePreviewHtml() {
    const tmpDir = path.join(os.tmpdir(), 'pue_topo');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    let rawHtml = fs.readFileSync(INDEX_HTML, 'utf8');

    // Base URL for relative resources
    const baseUrl = url.pathToFileURL(HTML_DIR + '/').href;
    const baseTag = `\n    <base href="${baseUrl}">`;
    rawHtml = rawHtml.replace(/<head>/i, `<head>${baseTag}`);

    // Injected driver script before </body>
    const injectedScript = `
    <script>
    window.addEventListener('load', async () => {
        if (window.CatalogManager && window.CatalogManager.ready) {
            try { await window.CatalogManager.ready; } catch(e) {}
        }
        setTimeout(() => {
            const q = new URLSearchParams(location.search);
            const S = window.AppStore;
            const city = q.get('city') || '高雄 (Kaohsiung)';
            const d = window.BUILTIN_WEATHER_DATA ? window.BUILTIN_WEATHER_DATA[city] : null;
            if (d && S) {
                S.updateSite({ selectedCity: city, hourly: d.hourlyData, isRealEpw: true });
            }
            if (S && S.state && S.state.halls && S.state.halls[0] && S.state.halls[0].dus) {
                const du = S.state.halls[0].dus[0];
                if (q.get('cdu')) {
                    du.plantDesign.cduSystem.architecture = q.get('cdu');
                    du.plantDesign.cduSystem.sizing = [];
                }
                if (q.get('fw')) {
                    du.plantDesign.fanwallSystem.architecture = q.get('fw');
                    du.plantDesign.fanwallSystem.sizing = [];
                }
                S.notify();
                if (window.App && window.App.renderStep) window.App.renderStep(4);
                if (window.ViewCooling) {
                    if (window.ViewCooling.collapseAll) window.ViewCooling.collapseAll();
                    if (window.ViewCooling.toggleExpand) window.ViewCooling.toggleExpand(du.id);
                }
                const header = document.querySelector('header');
                if (header) header.style.display = 'none';
                const footer = document.querySelector('footer');
                if (footer) footer.style.display = 'none';
                const unit = document.getElementById('unit_' + du.id);
                const m = document.querySelector('main');
                if (unit && m) {
                    const blocks = unit.querySelectorAll('.bg-slate-950');
                    if (blocks && blocks.length > 0) {
                        const targetBlock = q.get('part') === 'fw' ? blocks[1] : blocks[0];
                        if (targetBlock) {
                            m.innerHTML = '';
                            m.style.padding = '0';
                            m.style.margin = '0';
                            m.style.maxWidth = '100%';
                            m.appendChild(targetBlock);
                        }
                    }
                }
            }
        }, 800);
    });
    </script>
    `;

    rawHtml = rawHtml.replace(/<\/body>/i, `${injectedScript}\n</body>`);
    const previewFile = path.join(tmpDir, 'preview.html');
    fs.writeFileSync(previewFile, rawHtml, 'utf8');
    return previewFile;
}

// 3. Main runner
function main() {
    const args = process.argv.slice(2);
    let city = '高雄 (Kaohsiung)';
    let only = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--city' && args[i + 1]) {
            city = args[++i];
        } else if (args[i] === '--only' && args[i + 1]) {
            only = args[++i];
        }
    }

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const browser = findBrowser();
    console.log(`Using browser: ${browser}`);
    console.log(`Target city: ${city}`);

    const previewPath = preparePreviewHtml();
    const previewFileUrl = url.pathToFileURL(previewPath).href;

    const tasks = [
        // 5 CDU Architectures
        { name: 'cdu_dry_cooler_trim', cdu: 'dry_cooler_trim', fw: 'air_cooled_chiller', part: 'cdu' },
        { name: 'cdu_dry_cooler_pure', cdu: 'dry_cooler_pure', fw: 'air_cooled_chiller', part: 'cdu' },
        { name: 'cdu_adiabatic_tower', cdu: 'adiabatic_tower', fw: 'air_cooled_chiller', part: 'cdu' },
        { name: 'cdu_cooling_tower_hx', cdu: 'cooling_tower_hx', fw: 'air_cooled_chiller', part: 'cdu' },
        { name: 'cdu_water_chiller', cdu: 'water_chiller', fw: 'air_cooled_chiller', part: 'cdu' },
        // 4 Fanwall Architectures
        { name: 'fw_air_cooled_chiller', cdu: 'dry_cooler_trim', fw: 'air_cooled_chiller', part: 'fw' },
        { name: 'fw_water_cooled_chiller', cdu: 'dry_cooler_trim', fw: 'water_cooled_chiller', part: 'fw' },
        { name: 'fw_chilled_water_plant', cdu: 'dry_cooler_trim', fw: 'chilled_water_plant', part: 'fw' },
        { name: 'fw_rdhx', cdu: 'dry_cooler_trim', fw: 'rdhx', part: 'fw' },
    ];

    const filtered = only ? tasks.filter(t => t.name.includes(only)) : tasks;

    function getCitySuffix(targetCity) {
        if (!targetCity || targetCity === '高雄 (Kaohsiung)') return '';
        const match = targetCity.match(/\(([a-zA-Z0-9\s_-]+)\)/);
        let raw = match ? match[1].trim().split(/\s+/)[0] : targetCity;
        const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `__${clean || 'city'}`;
    }

    const citySuffix = getCitySuffix(city);

    for (const t of filtered) {
        const outName = `${t.name}${citySuffix}.png`;
        const outPath = path.join(OUT_DIR, outName);
        const targetUrl = `${previewFileUrl}?city=${encodeURIComponent(city)}&cdu=${t.cdu}&fw=${t.fw}&part=${t.part}`;
        const userDataDir = path.join(os.tmpdir(), `chrome_user_data_${Date.now()}_${Math.floor(Math.random() * 10000)}`);

        console.log(`[Screenshot] ${t.name} -> ${outName}...`);
        try {
            execFileSync(browser, [
                '--headless=new',
                '--disable-gpu',
                '--allow-file-access-from-files',
                '--force-device-scale-factor=1.5',
                '--window-size=1300,560',
                '--virtual-time-budget=10000',
                '--hide-scrollbars',
                `--user-data-dir=${userDataDir}`,
                `--screenshot=${outPath}`,
                targetUrl
            ], { stdio: 'ignore', timeout: 30000 });
            console.log(`  ✓ Generated: ${outPath} (${fs.statSync(outPath).size} bytes)`);
        } catch (err) {
            console.error(`  ✗ Failed to screenshot ${t.name}:`, err.message);
        } finally {
            try {
                if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }

    console.log(`\nCompleted ${filtered.length} screenshots in ${OUT_DIR}`);
}

if (require.main === module) {
    main();
}

module.exports = { preparePreviewHtml, findBrowser };
