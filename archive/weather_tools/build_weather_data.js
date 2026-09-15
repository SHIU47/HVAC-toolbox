const fs = require('fs');
const path = require('path');
const { STATION_META } = require('./station_meta_lookup.js');

// Stull (2011) Wet Bulb formula
function calculateWetBulb(t, rh) {
    if (rh < 0) rh = 0;
    if (rh > 100) rh = 100;
    const rhVal = rh;
    const wb = t * Math.atan(0.151977 * Math.pow(rhVal + 8.313659, 0.5))
             + Math.atan(t + rhVal)
             - Math.atan(rhVal - 1.676331)
             + 0.00391838 * Math.pow(rhVal, 1.5) * Math.atan(0.023101 * rhVal)
             - 4.686035;
    return parseFloat(wb.toFixed(1));
}

// Approximate ASHRAE 90.1 Climate Zone based on CDD10 / CDD18 / HDD18 and humidity
function estimateClimateZone(avgDB, maxDB, minDB, annualCDD10) {
    if (annualCDD10 > 5000 && minDB > 10) return "0A";
    if (annualCDD10 > 3500) return "1A";
    if (annualCDD10 > 2500) return "2A";
    if (minDB >= 0 && maxDB > 28) return "3A";
    if (minDB < 0 && minDB > -10) return "4A";
    if (minDB <= -10 && minDB > -20) return "5A";
    if (minDB <= -20) return "6A";
    return "3A";
}

const COUNTRY_LOOKUP = {
    "TWN": { name: "Taiwan", nameZh: "台灣", flag: "🇹🇼", continent: "Asia" },
    "THA": { name: "Thailand", nameZh: "泰國", flag: "🇹🇭", continent: "Asia" },
    "PHL": { name: "Philippines", nameZh: "菲律賓", flag: "🇵🇭", continent: "Asia" },
    "USA": { name: "United States", nameZh: "美國", flag: "🇺🇸", continent: "Americas" },
    "JPN": { name: "Japan", nameZh: "日本", flag: "🇯🇵", continent: "Asia" },
    "SGP": { name: "Singapore", nameZh: "新加坡", flag: "🇸🇬", continent: "Asia" },
    "MYS": { name: "Malaysia", nameZh: "馬來西亞", flag: "🇲🇾", continent: "Asia" },
    "KOR": { name: "South Korea", nameZh: "南韓", flag: "🇰🇷", continent: "Asia" },
    "CHN": { name: "China", nameZh: "中國", flag: "🇨🇳", continent: "Asia" },
    "IDN": { name: "Indonesia", nameZh: "印尼", flag: "🇮🇩", continent: "Asia" },
    "IND": { name: "India", nameZh: "印度", flag: "🇮🇳", continent: "Asia" },
    "ARE": { name: "United Arab Emirates", nameZh: "阿拉伯聯合大公國", flag: "🇦🇪", continent: "Asia" },
    "SAU": { name: "Saudi Arabia", nameZh: "沙烏地阿拉伯", flag: "🇸🇦", continent: "Asia" },
    "HKG": { name: "Hong Kong", nameZh: "香港", flag: "🇭🇰", continent: "Asia" },
    "VNM": { name: "Vietnam", nameZh: "越南", flag: "🇻🇳", continent: "Asia" },
    "PAK": { name: "Pakistan", nameZh: "巴基斯坦", flag: "🇵🇰", continent: "Asia" },
    "BGD": { name: "Bangladesh", nameZh: "孟加拉", flag: "🇧🇩", continent: "Asia" },
    "LKA": { name: "Sri Lanka", nameZh: "斯里蘭卡", flag: "🇱🇰", continent: "Asia" },
    "KHM": { name: "Cambodia", nameZh: "柬埔寨", flag: "🇰🇭", continent: "Asia" },
    "KAZ": { name: "Kazakhstan", nameZh: "哈薩克", flag: "🇰🇿", continent: "Asia" },
    "UZB": { name: "Uzbekistan", nameZh: "烏茲別克", flag: "🇺🇿", continent: "Asia" },
    "AZE": { name: "Azerbaijan", nameZh: "亞塞拜然", flag: "🇦🇿", continent: "Asia" },
    "GEO": { name: "Georgia", nameZh: "喬治亞", flag: "🇬🇪", continent: "Asia" },
    "GBR": { name: "United Kingdom", nameZh: "英國", flag: "🇬🇧", continent: "Europe" },
    "DEU": { name: "Germany", nameZh: "德國", flag: "🇩🇪", continent: "Europe" },
    "FRA": { name: "France", nameZh: "法國", flag: "🇫🇷", continent: "Europe" },
    "NLD": { name: "Netherlands", nameZh: "荷蘭", flag: "🇳🇱", continent: "Europe" },
    "IRL": { name: "Ireland", nameZh: "愛爾蘭", flag: "🇮🇪", continent: "Europe" },
    "SWE": { name: "Sweden", nameZh: "瑞典", flag: "🇸🇪", continent: "Europe" },
    "FIN": { name: "Finland", nameZh: "芬蘭", flag: "🇫🇮", continent: "Europe" },
    "CHE": { name: "Switzerland", nameZh: "瑞士", flag: "🇨🇭", continent: "Europe" },
    "AUT": { name: "Austria", nameZh: "奧地利", flag: "🇦🇹", continent: "Europe" },
    "CZE": { name: "Czech Republic", nameZh: "捷克", flag: "🇨🇿", continent: "Europe" },
    "POL": { name: "Poland", nameZh: "波蘭", flag: "🇵🇱", continent: "Europe" },
    "NOR": { name: "Norway", nameZh: "挪威", flag: "🇳🇴", continent: "Europe" },
    "ESP": { name: "Spain", nameZh: "西班牙", flag: "🇪🇸", continent: "Europe" },
    "ITA": { name: "Italy", nameZh: "義大利", flag: "🇮🇹", continent: "Europe" },
    "GRC": { name: "Greece", nameZh: "希臘", flag: "🇬🇷", continent: "Europe" },
    "TUR": { name: "Turkey", nameZh: "土耳其", flag: "🇹🇷", continent: "Europe" },
    "BEL": { name: "Belgium", nameZh: "比利時", flag: "🇧🇪", continent: "Europe" },
    "LUX": { name: "Luxembourg", nameZh: "盧森堡", flag: "🇱🇺", continent: "Europe" },
    "DNK": { name: "Denmark", nameZh: "丹麥", flag: "🇩🇰", continent: "Europe" },
    "LTU": { name: "Lithuania", nameZh: "立陶宛", flag: "🇱🇹", continent: "Europe" },
    "LVA": { name: "Latvia", nameZh: "拉脫維亞", flag: "🇱🇻", continent: "Europe" },
    "PRT": { name: "Portugal", nameZh: "葡萄牙", flag: "🇵🇹", continent: "Europe" },
    "HRV": { name: "Croatia", nameZh: "克羅埃西亞", flag: "🇭🇷", continent: "Europe" },
    "ROU": { name: "Romania", nameZh: "羅馬尼亞", flag: "🇷🇴", continent: "Europe" },
    "BGR": { name: "Bulgaria", nameZh: "保加利亞", flag: "🇧🇬", continent: "Europe" },
    "ISR": { name: "Israel", nameZh: "以色列", flag: "🇮🇱", continent: "Europe" },
    "CAN": { name: "Canada", nameZh: "加拿大", flag: "🇨🇦", continent: "Americas" },
    "MEX": { name: "Mexico", nameZh: "墨西哥", flag: "🇲🇽", continent: "Americas" },
    "GTM": { name: "Guatemala", nameZh: "瓜地馬拉", flag: "🇬🇹", continent: "Americas" },
    "CRI": { name: "Costa Rica", nameZh: "哥斯大黎加", flag: "🇨🇷", continent: "Americas" },
    "PAN": { name: "Panama", nameZh: "巴拿馬", flag: "🇵🇦", continent: "Americas" },
    "DOM": { name: "Dominican Republic", nameZh: "多明尼加", flag: "🇩🇴", continent: "Americas" },
    "JAM": { name: "Jamaica", nameZh: "牙買加", flag: "🇯🇲", continent: "Americas" },
    "TTO": { name: "Trinidad and Tobago", nameZh: "千里達及托巴哥", flag: "🇹🇹", continent: "Americas" },
    "BRA": { name: "Brazil", nameZh: "巴西", flag: "🇧🇷", continent: "Americas" },
    "CHL": { name: "Chile", nameZh: "智利", flag: "🇨🇱", continent: "Americas" },
    "COL": { name: "Colombia", nameZh: "哥倫比亞", flag: "🇨🇴", continent: "Americas" },
    "PER": { name: "Peru", nameZh: "秘魯", flag: "🇵🇪", continent: "Americas" },
    "ECU": { name: "Ecuador", nameZh: "厄瓜多", flag: "🇪🇨", continent: "Americas" },
    "ARG": { name: "Argentina", nameZh: "阿根廷", flag: "🇦🇷", continent: "Americas" },
    "URY": { name: "Uruguay", nameZh: "烏拉圭", flag: "🇺🇾", continent: "Americas" },
    "PRY": { name: "Paraguay", nameZh: "巴拉圭", flag: "🇵🇾", continent: "Americas" },
    "BOL": { name: "Bolivia", nameZh: "玻利維亞", flag: "🇧🇴", continent: "Americas" },
    "VEN": { name: "Venezuela", nameZh: "委內瑞拉", flag: "🇻🇪", continent: "Americas" },
    "ZAF": { name: "South Africa", nameZh: "南非", flag: "🇿🇦", continent: "Africa" },
    "EGY": { name: "Egypt", nameZh: "埃及", flag: "🇪🇬", continent: "Africa" },
    "NGA": { name: "Nigeria", nameZh: "奈及利亞", flag: "🇳🇬", continent: "Africa" },
    "MAR": { name: "Morocco", nameZh: "摩洛哥", flag: "🇲🇦", continent: "Africa" },
    "KEN": { name: "Kenya", nameZh: "肯亞", flag: "🇰🇪", continent: "Africa" },
    "ETH": { name: "Ethiopia", nameZh: "衣索比亞", flag: "🇪🇹", continent: "Africa" },
    "AGO": { name: "Angola", nameZh: "安哥拉", flag: "🇦🇴", continent: "Africa" },
    "BWA": { name: "Botswana", nameZh: "波札那", flag: "🇧🇼", continent: "Africa" },
    "GHA": { name: "Ghana", nameZh: "迦納", flag: "🇬🇭", continent: "Africa" },
    "MUS": { name: "Mauritius", nameZh: "模里西斯", flag: "🇲🇺", continent: "Africa" },
    "ZMB": { name: "Zambia", nameZh: "尚比亞", flag: "🇿🇲", continent: "Africa" },
    "MOZ": { name: "Mozambique", nameZh: "莫三比克", flag: "🇲🇿", continent: "Africa" },
    "TZA": { name: "Tanzania", nameZh: "坦尚尼亞", flag: "🇹🇿", continent: "Africa" },
    "UGA": { name: "Uganda", nameZh: "烏干達", flag: "🇺🇬", continent: "Africa" },
    "COD": { name: "DR Congo", nameZh: "剛果民主共和國", flag: "🇨🇩", continent: "Africa" },
    "CIV": { name: "Côte d'Ivoire", nameZh: "象牙海岸", flag: "🇨🇮", continent: "Africa" },
    "SEN": { name: "Senegal", nameZh: "塞內加爾", flag: "🇸🇳", continent: "Africa" },
    "AUS": { name: "Australia", nameZh: "澳洲", flag: "🇦🇺", continent: "Oceania" },
    "NZL": { name: "New Zealand", nameZh: "紐西蘭", flag: "🇳🇿", continent: "Oceania" },
    "BRN": { name: "Brunei", nameZh: "汶萊", flag: "🇧🇳", continent: "Asia" },
    "PNG": { name: "Papua New Guinea", nameZh: "巴布亞紐幾內亞", flag: "🇵🇬", continent: "Oceania" },
    "FJI": { name: "Fiji", nameZh: "斐濟", flag: "🇫🇯", continent: "Oceania" },
    "GUM": { name: "Guam", nameZh: "關島", flag: "🇬🇺", continent: "Oceania" }
};

function extractAshraeDesign(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return { extDB: null, extWB: null };
    const files = fs.readdirSync(dirPath);
    const statFile = files.find(f => f.endsWith('.stat'));
    const ddyFile = files.find(f => f.endsWith('.ddy'));

    let extDB = null;
    let extWB = null;

    if (ddyFile) {
        try {
            const ddyText = fs.readFileSync(path.join(dirPath, ddyFile), 'utf8');
            const mDB = ddyText.match(/Annual Cooling \(DB=>MWB\)\s*\.?4%,\s*MaxDB=([\d\.\-]+)C/i)
                     || ddyText.match(/Annual Cooling \(DP=>MDB\)\s*\.?4%,\s*MDB=([\d\.\-]+)C/i)
                     || ddyText.match(/Ann Clg \.4% Condns DB=>MWB[\s\S]*?([0-9\.\-]+),\s*!- Maximum Dry-Bulb Temperature/i);
            if (mDB) extDB = parseFloat(mDB[1]);

            const mWB = ddyText.match(/Annual Cooling \(WB=>MDB\)\s*\.?4%,(?:[^\n]*?)WB=([\d\.\-]+)C/i)
                     || ddyText.match(/Ann Clg \.4% Condns WB=>MDB[\s\S]*?([0-9\.\-]+),\s*!- Wetbulb at Maximum Dry-Bulb/i);
            if (mWB) extWB = parseFloat(mWB[1]);
        } catch (e) {}
    }

    if ((extDB === null || extWB === null) && statFile) {
        try {
            const statText = fs.readFileSync(path.join(dirPath, statFile), 'utf8');
            const lines = statText.split(/\r?\n/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (/^Cooling\s+\d+/.test(trimmed)) {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length >= 11) {
                        if (extDB === null && !isNaN(parseFloat(parts[3]))) extDB = parseFloat(parts[3]);
                        if (extWB === null && !isNaN(parseFloat(parts[9]))) extWB = parseFloat(parts[9]);
                    } else if (parts.length >= 7) {
                        if (extDB === null && !isNaN(parseFloat(parts[2]))) extDB = parseFloat(parts[2]);
                    }
                }
            }
        } catch (e) {}
    }

    return { extDB, extWB };
}

function parseEPW(content, filename, dirPath) {
    const lines = content.split(/\r?\n/);
    if (lines.length < 10 || !lines[0].startsWith('LOCATION')) {
        return null;
    }

    const locCols = lines[0].split(',');
    const city = (locCols[1] || 'Unknown').trim();
    const state = (locCols[2] || '').trim();
    const countryCode = (locCols[3] || '').trim().toUpperCase();
    const wmo = (locCols[5] || '').trim();
    const lat = parseFloat(locCols[6]) || 0;
    const lon = parseFloat(locCols[7]) || 0;
    const tz = parseFloat(locCols[8]) || 0;
    const elev = parseFloat(locCols[9]) || 0;

    const countryMeta = COUNTRY_LOOKUP[countryCode] || {
        name: countryCode || "Global",
        flag: "🌐",
        continent: "Global"
    };

    // Parse hourly data
    const startLine = 8;
    const hourly = [];
    let annualCDD10 = 0;

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length >= 25 && !isNaN(cols[0]) && !isNaN(cols[1])) {
            const month = parseInt(cols[1], 10) - 1; // 0..11
            const day = parseInt(cols[2], 10);
            const hour = parseInt(cols[3], 10);
            const db = parseFloat(cols[6]);
            const dp = parseFloat(cols[7]);
            const rh = parseFloat(cols[8]);
            const rad = parseFloat(cols[13]) || 0; // Direct Normal Rad

            if (!isNaN(db) && !isNaN(rh)) {
                const wb = calculateWetBulb(db, rh);
                if (db > 10) annualCDD10 += (db - 10) / 24;
                hourly.push({
                    m: month,
                    d: day,
                    h: hour,
                    db: parseFloat(db.toFixed(1)),
                    dp: parseFloat(dp.toFixed(1)),
                    rh: Math.round(rh),
                    wb: wb,
                    rad: Math.round(rad)
                });
            }
        }
    }

    if (hourly.length === 0) return null;

    // Summary calculations
    const allDB = hourly.map(h => h.db);
    const allWB = hourly.map(h => h.wb);
    const allDP = hourly.map(h => h.dp);
    const allRH = hourly.map(h => h.rh);

    const minDB = Math.min(...allDB);
    const maxDB = Math.max(...allDB);
    const avgDB = parseFloat((allDB.reduce((a, b) => a + b, 0) / allDB.length).toFixed(1));

    const minWB = Math.min(...allWB);
    const maxWB = Math.max(...allWB);
    const avgWB = parseFloat((allWB.reduce((a, b) => a + b, 0) / allWB.length).toFixed(1));

    // Sort DB to calculate extreme 99.6% / 0.4% Dry Bulb fallback
    const sortedDB = [...allDB].sort((a, b) => a - b);
    const extDBIndex = Math.min(sortedDB.length - 1, Math.floor(sortedDB.length * 0.996));
    const calcExtDB = parseFloat(sortedDB[extDBIndex].toFixed(1));

    // Sort WB to calculate extreme 99.6% / 0.4% Wet Bulb fallback
    const sortedWB = [...allWB].sort((a, b) => a - b);
    const extWBIndex = Math.min(sortedWB.length - 1, Math.floor(sortedWB.length * 0.996));
    const calcExtWB = parseFloat(sortedWB[extWBIndex].toFixed(1));

    // Official ASHRAE 0.4% design values from .stat / .ddy
    const ashrae = extractAshraeDesign(dirPath);
    const extDB = (ashrae.extDB !== null && !isNaN(ashrae.extDB)) ? ashrae.extDB : calcExtDB;
    const extWB = (ashrae.extWB !== null && !isNaN(ashrae.extWB)) ? ashrae.extWB : calcExtWB;

    const avgRH = Math.round(allRH.reduce((a, b) => a + b, 0) / allRH.length);

    // Free Cooling estimate: DB <= 34°C for high-temp liquid cooling (34~41°C partial, >41°C mechanical)
    const fcHours = hourly.filter(h => h.db <= 34).length;

    const zone = estimateClimateZone(avgDB, maxDB, minDB, annualCDD10);

    // Estimated PUE baseline based on extreme WB and cooling potential
    let estPue = 1.15;
    if (extWB > 28) estPue = 1.38;
    else if (extWB > 25) estPue = 1.28;
    else if (extWB > 22) estPue = 1.22;
    else if (extWB > 18) estPue = 1.15;
    else estPue = 1.10;

    // Clean display name
    let cleanCity = city.replace(/_/g, ' ').replace(/\./g, ' ');
    if (state && !cleanCity.includes(state)) cleanCity += `, ${state}`;

    const stationId = path.basename(filename, '.epw');
    const meta = (typeof STATION_META !== 'undefined' && STATION_META[stationId]) || {};

    return {
        id: stationId,
        city: cleanCity,
        cityZh: meta.cityZh || cleanCity,
        stationName: locCols[1] || cleanCity,
        country: countryMeta.name,
        countryZh: countryMeta.nameZh || countryMeta.name,
        countryCode: countryCode,
        flag: countryMeta.flag,
        continent: countryMeta.continent,
        wmo: wmo,
        lat: lat,
        lng: lon,
        elev: elev,
        tz: tz,
        zone: zone,
        minDB: minDB,
        maxDB: maxDB,
        avgDB: avgDB,
        extDB: extDB,
        minWB: minWB,
        maxWB: maxWB,
        avgWB: avgWB,
        extWB: extWB,
        avgRH: avgRH,
        freeCooling: fcHours,
        waterRisk: extWB > 26 ? 4 : (extWB > 23 ? 3 : 2),
        pue: parseFloat(estPue.toFixed(2)),
        datacenters: meta.datacenters || "區域核心數據中心與電信樞紐設施 (Regional Telco & Enterprise DC Hub)",
        hourly: hourly
    };
}

// Recursively find all .epw files in dir
function findEPWFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const item of list) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(findEPWFiles(fullPath));
        } else if (item.toLowerCase().endsWith('.epw')) {
            results.push(fullPath);
        }
    }
    return results;
}

function build() {
    const zipDir = path.resolve(__dirname, 'ZIP檔');
    console.log(`Scanning EPW files in: ${zipDir}`);
    const epwFiles = findEPWFiles(zipDir);
    console.log(`Found ${epwFiles.length} EPW file(s):`);

    const hourlyDir = path.resolve(__dirname, 'hourly');
    if (!fs.existsSync(hourlyDir)) fs.mkdirSync(hourlyDir, { recursive: true });

    const stations = [];
    for (const file of epwFiles) {
        console.log(`- Parsing: ${file}`);
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const data = parseEPW(content, path.basename(file), path.dirname(file));
            if (data) {
                console.log(`  ✓ Successfully parsed ${data.city} (${data.country}): ${data.hourly.length} hrs, extDB: ${data.extDB}°C, extWB: ${data.extWB}°C`);
                // Write hourly data to separate JSON file for fast on-demand fetching
                const hourlyPath = path.join(hourlyDir, `${data.id}.json`);
                fs.writeFileSync(hourlyPath, JSON.stringify(data.hourly), 'utf-8');

                // Keep weather_data.js lightweight without 8760 hourly array
                const { hourly, ...metaStation } = data;
                stations.push(metaStation);
            } else {
                console.warn(`  ✗ Failed to parse ${file}`);
            }
        } catch (e) {
            console.error(`  Error reading ${file}:`, e.message);
        }
    }

    const outputJs = path.resolve(__dirname, 'weather_data.js');
    const jsContent = `/**
 * Built-in Weather Database (Lightweight Metadata with On-Demand Hourly Loading).
 * Total stations: ${stations.length}
 * Generated at: ${new Date().toISOString()}
 */
window.BUILTIN_WEATHER_STATIONS = ${JSON.stringify(stations)};
console.log('Loaded BUILTIN_WEATHER_STATIONS:', window.BUILTIN_WEATHER_STATIONS.length, 'stations');
`;

    fs.writeFileSync(outputJs, jsContent, 'utf-8');
    console.log(`\nSuccessfully written ${stations.length} stations to: ${outputJs}`);
    console.log(`File size: ${(fs.statSync(outputJs).size / 1024 / 1024).toFixed(2)} MB`);
}

build();
