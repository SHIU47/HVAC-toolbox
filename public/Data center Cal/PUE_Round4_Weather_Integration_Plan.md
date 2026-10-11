# PUE 計算系統 — 第四輪計畫：第三輪收尾 + 165 站氣象資料整合

- 前一份計畫：`PUE_Phase4_Round3_Fix_Plan.md`（S-0 ~ Y-4 已完成，分支 `pue-audit-fixes`，HEAD `4980411`）
- 審查者：Claude Opus 5.5（2026-10-04）
- 執行者：Antigravity
- 本輪內容：
  - **Phase G**：修正第三輪留下的錯誤，其中一個會讓設計條件沿用上一個城市
  - **Phase W**：把 `public/天氣資料/` 的 165 個測站整合進 PUE 計算系統的 Step 1
  - **Phase Q**：兩項物理模型補強（冰機運轉範圍、泵浦水力）

---

## 0. 執行守則

1. **可動的路徑**：
   - `public/Data center Cal/**`
   - `tools/**`
   - `archive/weather_tools/build_weather_data.js`
   - 本文件
   - **不要**動 `dist/`、**不要**重寫 `public/天氣資料/hourly/*.json`、不要跑 `build.js`、不要部署、不要 push。
2. 繼續在分支 `pue-audit-fixes`。**一個任務一個 commit**，訊息以任務編號開頭。不要 `git add -A`。
3. **G-1、G-2 必須最先做**：它們修的是回歸工具本身，修完才重存基準：
   ```
   cd tools/pue_regression
   node run.js --save baseline_after_R3.json
   node ui_snapshot.js --save ui_snapshot_after_R3.json
   node topo_preview.js
   node topo_preview.js --city "美國 (Alabama Andalusia)"
   ```
4. 每個任務的「允許變動」規則同前幾輪：
   - **0 差異**：`run.js --compare baseline_after_R3.json` 無差異
   - **數值可變**：commit 內文貼 7 城市「前 → 後」
   - **拓樸圖可變**：截圖逐條驗收
5. 改到 UI 的任務，一律要在 `unit_checks.js` 加 jsdom 接線測試（用 `dom_harness.js`）。
6. 新常數放 `js/assumptions.js`，附 `label` 與 `ref`。
7. 執行順序：**G → W → Q**。§6 的決定項東旭已確認，照表執行。

---

## 1. 第三輪驗收結果

### 1.1 確認正確
- 19 個 commit 都在，`unit_checks.js` **148/148** 通過，`run.js` 對 `baseline_after_P4` 140 組 0 差異。
- **F-1 模式小時數**：高雄 Trim 圖顯示 8758 + 2 + 0 = 8760 h，正確接上。
- **F-5 Fanwall 旁通**：Alabama 氣冷冰機圖預冷後溫度改為 18°C（= 回水溫），FC 盤管正確顯示旁通狀態。
- **F-7 容量缺口**：高雄純乾冷器圖顯示「全年 2 h 超出冷卻能力」，「100%」字樣已移除。
- **X-2 165 站資料**：165 站中 160 站有 `designConditions`、157 站有極值。其他欄位只有 2 筆 `extDB/extWB` 因 ASHRAE 優先而改變。`hourly/*.json` 完全沒動，檔案增加 41.6 KB。
- **Y-3 Trim 選型**：直接驗算 4 城市都正確：

  | 城市 | 選型基準 DB | Trim 需求 | 驗算（863 kW × 負擔比例） |
  |---|---|---|---|
  | 高雄 | 36.7 | 122 kW | × 14.2% ✓ |
  | 菲律賓 | 39.6 | 331 kW | × 38.3% ✓ |
  | Alabama | 41.1 | 438 kW | × 50.8% ✓ |
  | 桃園 | 42.0 | 503 kW | × 58.3% ✓，並出現資料品質警示 ✓ |

### 1.2 發現的問題
見 Phase G。最嚴重的是 G-1：**換城市時，設計條件會沿用上一個城市**。

---

## 2. Phase G — 第三輪收尾

### G-1　換城市時 `site.designConditions` 沿用上一個城市（嚴重）
- **現象**：
  - `topo_preview.js` 產出的**高雄**與 **Alabama** Trim 圖，尖峰工況都顯示 `尖峰設計 DB 42.0°C`，設計乾球都顯示 `33.9°C`。這兩個都是**桃園**（App 預設城市）的值。
  - Alabama 氣冷冰機圖顯示「可用溫度 37.9°C」= 桃園的 33.9 + 4。
  - 模式小時數則是對的，因為逐時模擬用的是新城市的 hourly。
  - 結果：同一張圖混用兩個城市的資料。
- **原因**：
  1. `store.js updateSite()` 用 `Object.assign(this.state.site, siteData)`。呼叫端只傳 `hourly`、沒傳 `designConditions` 時，舊值會留下。`topo_preview.js` 就是這樣呼叫的（這段注入碼是我上一輪計畫 §6 提供的，錯在我）。
  2. `store.js:351` `deserializeProject`：`data.designConditions || this.state.site.designConditions || null`。內建城市沒有 `designConditions` 時，會沿用前一個城市的值。
- **修正**：
  - `updateSite(siteData)`：只要 `siteData.hourly` 有值，而 `siteData` **沒有** `designConditions` 這個 key（用 `'designConditions' in siteData` 判斷），就把 `site.designConditions` 設為 `null`。
  - `store.js:351` 刪除 `|| this.state.site.designConditions`。
  - `topo_preview.js` 的注入碼改為 `S.updateSite({ selectedCity: city, hourly: d.hourlyData, designConditions: d.designConditions || null, isRealEpw: true })`。
- **允許變動**：數值可變（只影響工具輸出；App 正常操作路徑不變）。
- **測試**：
  - 先載入桃園，再用 `updateSite({ hourly: 高雄 })` 不帶 `designConditions` → `designConditions().peakDb.basis` 必須是「TMY 最高 + 餘裕」。
  - 再用 `updateSite` 帶上高雄的 `designConditions` → `peakDb.value === 36.7`。
- **截圖驗收**：高雄 Trim 圖尖峰 DB 36.7、設計乾球 33.5；Alabama 尖峰 DB 41.1、設計乾球 36.8。

### G-2　回歸測試沒有涵蓋 ASHRAE 設計條件
- **現象**：
  - `run.js` 只設定 `site.hourly`，從來沒有設定 `site.designConditions`。
  - 所以 140 組回歸全部走「TMY 後備」路徑，X-4、Y-1、Y-3 的 ASHRAE 邏輯**完全沒有被回歸測到**。
  - 這也是為什麼 Y-3 改變了 Trim 選型需求，`--compare` 卻顯示 0 差異。
- **修正**：
  - `run.js` 每組帶入 `designConditions: weather.designConditions || null`。
  - 每組結果新增記錄：
    - `designDb`、`designWb`
    - `peakDb`
    - 各 sizing item 的 `requiredKw`（四捨五入到整數）
  - `compare()` 一併比對這些欄位。
  - `harness.js` 補上 `ashrae_design_conditions.js`、`epw_parser.js`，順序同 `index.html`。
  - 新增 `tools/pue_regression/check_harness_order.js`：比對 `index.html` 與 `harness.js` 的載入清單。只檢查非 view、非 vendor 的檔案；不一致就 exit 1。`unit_checks.js` 開頭先呼叫它。
- 完成後才存 `baseline_after_R3.json`（見 §0-3）。

### G-3　Trim 冰機「待機」標籤壓到標題
- 高雄與 Alabama 截圖中，`Water Cooled Chillers` 標題與 `(Standby)` 重疊成 `Water Cooled Ch(Standby)llers`。
- **修正**：
  - 待機狀態時，標題文字改為 `Water Cooled Chillers — 待機`，用同一個 `<text>` 輸出，不另外疊一個標籤。
  - Secondary HX 與冰機之間管線上的 `待機 (Standby)` 標籤保留。
- Fanwall 的 FC 盤管旁通時也有同樣問題：`Free-Cooling 盤管 (串聯預冷)` 與 `(Bypass)` 重疊。用同樣方式修正。

### G-4　Fanwall 橫幅沒有套用兩行格式
- F-6 只改了 Trim 的橫幅。三個 Fanwall 架構的橫幅仍是單行，「— 全年 809 h」會被拆行，說明文字也會被擠成兩行（例：`100% 走 Economizer 盤` / `管`）。
- **修正**：比照 Trim 改成兩行：
  - 第一行：名稱
  - 第二行：`門檻 ｜ 全年 h ｜ 說明`
- 三個 Fanwall 架構與 Trim 共用同一個 banner renderer（抽到 `views/schematics/schematic_common.js`）。

### G-5　尖峰工況表格顯示「冷凝器進水 52°C、冰機 COP 6.9」，超出冰機運轉範圍
- 這一項與 Q-1 一起處理，見 Q-1。

---

## 3. Phase W — 165 站氣象資料整合（主要工作）

### 3.1 現況
| 項目 | 現況 |
|---|---|
| PUE 系統的氣象來源 | `js/weather_builtin.js`：7 城市，**5.2 MB 全部內嵌**；或使用者上傳 EPW |
| 165 站資料 | `public/天氣資料/weather_data.js`：測站索引 162 KB，含 `designConditions`<br>`public/天氣資料/hourly/{id}.json`：每站約 550 KB，共 91 MB |
| 執行環境 | ① Firebase 網站（http，`/天氣資料/` 已部署）<br>② `PUE計算系統.exe`：`build_exe.js` **只打包 `Data center Cal/` 資料夾**，用本機 HttpListener 提供<br>③ 直接雙擊 `index.html`（`file://`，瀏覽器會擋 fetch） |

### 3.2 目標
- Step 1 可以從 165 站中搜尋、篩選、選擇測站。
- 選中後用 adapter 載入逐時資料，套用該站的 `designConditions`。
- 三種執行環境都能用。
- 專案檔記錄測站 id，重新開啟時自動載回。

### W-1　氣象來源模組 `js/weather_source.js`（新檔）
集中處理「去哪裡拿資料」，其他程式不再直接碰 `BUILTIN_WEATHER_DATA`：

```js
window.WeatherSource = {
  // 測站索引：165 站（若可用）＋ 7 個內建城市；回傳統一格式
  async listStations()          // → [{ id, cityZh, country, countryZh, flag, continent, lat, lng, elev,
                                //      zone, maxDB, extDB, extWB, freeCooling, pue, source: 'catalog'|'builtin', available: bool }]
  async loadStation(id)         // → { stationInfo, hourlyData /* 已轉換格式 */, designConditions, stats, monthlyStats }
  adaptHourly(raw)              // 165 站 hourly 格式 → PUE 格式（見 W-2）
  basePath()                    // 回傳 '../天氣資料/'（網站）或 'weather_catalog/'（exe 打包後，見 W-5）
  mode()                        // 'http' | 'file'
};
```
- `listStations()`：
  - 先嘗試載入 `basePath() + 'weather_data.js'`。用 `<script>` 動態插入，`file://` 也能載入。
  - 載入成功就取 `window.BUILTIN_WEATHER_STATIONS`。
  - 失敗就只回傳 7 個內建城市。
- `loadStation(id)`：
  - 內建城市：直接從 `BUILTIN_WEATHER_DATA` 取。
  - 165 站：`fetch(basePath() + 'hourly/' + encodeURIComponent(id) + '.json')`。
  - `mode() === 'file'` 時，fetch 會失敗。此時丟出 `WeatherSourceError('FILE_PROTOCOL')`，UI 顯示說明（見 W-3），**不要**靜默退回合成氣候。
- **內建 7 城市與 165 站重複時**（以 WMO 站號比對 `stationInfo` 與 `wmo`），清單只列一筆，標示 `內建・離線可用`，載入時優先用內建資料。
- 快取：已載入的測站存在記憶體 `Map`，最多 5 站，最舊的先清掉。

### W-2　Hourly adapter
```js
adaptHourly(raw) {
  if (!Array.isArray(raw) || raw.length < 8760) throw new WeatherSourceError('BAD_HOURLY', raw?.length);
  return raw.slice(0, 8760).map((r, i) => ({
    hourIndex: i,
    month: r.m + 1,              // ⚠ 165 站是 0～11
    day: r.d,
    hour: r.h,
    db: r.db, wb: r.wb, dp: r.dp, rh: r.rh
  }));
}
```
- 閏年資料若有 8784 筆，只取前 8760。實測 165 站都是 8760 筆，但保留檢查。
- **測試**：
  - 載入高雄 165 站 JSON，轉換後 `month` 範圍 1～12。
  - `computeMonthlyStats` 算出的 7 月平均乾球，與內建高雄資料的 7 月平均相差 < 0.3°C。

### W-3　Step 1 測站選擇器
- **位置**：`views/view_weather.js` 現有「內建城市按鈕」區塊**改為**測站選擇器，上傳 EPW 的功能保留。
- **元件**（沿用現有 Tailwind 樣式與 `UIKit`，不引入新套件）：
  - 搜尋框：比對 `cityZh`、`city`、`countryZh`、`wmo`。
  - 篩選：洲別下拉、國家下拉、氣候區（`zone`）下拉。
  - 結果清單：每列顯示
    - 國旗、城市中文、國家
    - 0.4% 設計乾球（`designConditions.cooling.db004 ?? extDB`）
    - 20 年回歸最高乾球（有極值時）
    - 資料品質警示圖示（套用 X-4 同一個檢查條件）
  - 預設排序：台灣測站優先，其餘依洲別、國家排序。
  - 清單上限顯示 50 筆，搜尋時即時過濾。
- **選定後的流程**：
  1. `WeatherSource.loadStation(id)`
  2. `AppStore.updateSite({ selectedCity, stationId: id, stationName, country, lat, lon, elev, isRealEpw: true, hourly, designConditions })`，`designConditions` 一定要明確帶入，見 G-1
  3. 重新 render
- **`file://` 錯誤處理**：選 165 站測站時若收到 `FILE_PROTOCOL` 錯誤，在選擇器上方顯示：
  > 直接開啟 HTML 檔案時，瀏覽器不允許讀取本機氣象資料。請改用桌面版 PUE計算系統.exe、線上版，或在此資料夾執行 `npx serve` 後用 http://localhost 開啟。也可以下載該站 EPW 後用「上傳 EPW」。

  標示為「內建・離線可用」的測站仍可正常選用。
- 載入時顯示讀取中狀態，失敗時保留原本的氣象資料，不清空。

### W-4　專案檔記錄測站
- `serializeProject` 的 `site` 新增 `stationId`、`stationSource`（`'builtin' | 'catalog' | 'epw'`）。
- `deserializeProject` 依 `stationSource` 處理：
  - `builtin`：照現行方式載入。
  - `catalog`：呼叫 `WeatherSource.loadStation(stationId)`。這是非同步的，載入完成後再 `calculate()` 並通知 UI 重繪。
    - 載入前先用專案檔內的 `stats` 與 `designConditions` 顯示。
    - Step 5 顯示「氣象資料載入中」，不要用合成氣候算出 PUE。
  - `epw`：照現行方式，提示重新上傳。
- 舊專案（v5，只有 `selectedCity`）：`migrateProject` 依 `selectedCity` 對應內建城市，`stationSource = 'builtin'`。
- `schemaVersion` 升為 `'v6'`。
- **測試**：存一個選了「東京（JPN_TK_Tokyo-Chiyoda）」的專案 → 重新載入 → `site.hourly.length === 8760`，且 `designConditions().peakDb` 等於東京的值。

### W-5　桌面版 exe 打包
- `build_exe.js` 新增打包來源：`../天氣資料/weather_data.js` 與 `../天氣資料/hourly/*.json`，打包到虛擬路徑 `weather_catalog/`。`WeatherSource.basePath()` 在 exe 環境回傳 `weather_catalog/`。
- 判斷 exe 環境：`location.hostname === '127.0.0.1'` 且 port 與 `build_exe.js` 設定的一致。或者由 `build_exe.js` 在打包時注入 `window.__PUE_EXE__ = true`，這個做法較可靠，採用此方式。
- 體積：`build_exe.js` 已經用 `zlib.gzipSync(rawBundle, { level: 9 })` 壓縮整個 `assets.bin`（第 57 行），不需要另外處理壓縮。實測 165 個 JSON 用 gzip 壓縮後共 **13.0 MB**，exe 預估增加約 13 MB。
- 注意：加入 165 站後，整包解壓縮後約 91 MB。請確認 `Program.cs` 是在啟動時把整包解壓縮到記憶體，還是按需求讀取。若是一次全部解壓縮，改成在 bundle 內逐檔 gzip，收到請求時才解壓縮該檔。
- 打包範圍見 §6-W1。
- **驗收**：本任務只改 `build_exe.js` 與 `weather_source.js`，**不要**實際執行打包。在 commit 內文附上預估的打包大小：用 Node `zlib.gzipSync` 計算 165 個 JSON 壓縮後的總和。

### W-6　移除 7 城市內嵌的 5.2 MB —— **本輪不做**（§6-W2 已決定保留）
- 本輪跳過，不要 commit 任何相關修改。以下內容留作日後參考。
- 若決定移除：
  - `weather_builtin.js` 只保留桃園一城，作為離線預設。
  - 其他 6 城改從 165 站清單載入。
  - `index.html` 初次載入可省下約 4.5 MB。

### W-7　回歸工具支援 165 站
- `run.js` 新增 `--catalog` 參數：
  - 從 `public/天氣資料/hourly/` 依 `weather_data.js` 讀取所有站。
  - 只跑預設組合（`dry_cooler_trim / air_cooled_chiller`）。
  - 輸出 165 站的 PUE、WUE、FC 小時、Trim 選型需求、資料品質警示到 `catalog_scan.csv`。
- 用途：整合後一次檢查 165 站有沒有算出 NaN、負值或極端值。
- **驗收**：
  - 165 站全部跑完，沒有 NaN。
  - PUE 都落在 1.02～1.6。
  - 列出觸發資料品質警示的測站清單。

---

## 4. Phase Q — 物理模型補強

### Q-1　冰機運轉範圍檢查（冷凝器進水上限）
- **問題**：
  - Trim 冰機在尖峰工況的冷凝器進水為 52°C，出水為 60°C（例：桃園 42°C 乾球）。
  - Carnot 揚程模型算出 COP 6.9。從揚程看合理：冰水 30°C、冷凝約 59°C，揚程約 31 K，與標準工況 7/30°C 相近。
  - 但標準水冷螺旋／離心冰機的冷卻水進水上限通常約 40～45°C。52°C 需要高溫型（heat-pump 等級）冰機。
  - 現在模型沒有任何提示，使用者會以為一般冰機就能用。
- **修正**：
  - `ASSUMPTIONS` 新增：
    - `chiller_max_cewt_standard_c`：45.0，ref「標準水冷螺旋/離心冰機冷卻水進水上限，廠商型錄常見 40～45°C」
    - `chiller_max_cewt_hightemp_c`：60.0，ref「高溫型（heat-pump 等級）冰機冷凝側上限」
  - 型錄冰機若有 `max_cewt_c` 欄位就用型錄值；否則依 `category` 判斷：含 `high temp`、`heat pump` 用高溫上限，其他用標準上限。
  - `stage_chiller`：`t_cewt_c > 上限` 時：
    - `warnings` 加 `CHILLER_CEWT_EXCEEDS_ENVELOPE`（severity: warning）
    - 逐時統計超限小時數，`byDu` / `byCorePod` 新增 `chillerEnvelopeHours`
  - Trim 選型 `validation.checks`：尖峰工況 `tCewt` 超過上限時加 ⚠
    > 尖峰工況冷凝器進水 {T}°C 超過所選冰機運轉上限 {L}°C，需選用高溫型冰機
  - 尖峰工況表格中，超限時冷凝器溫度改用警示色。
- **不改變耗電計算**。只做警示，這是運轉範圍問題，不是效率問題。
- **允許變動**：0 差異（數值）；驗證訊息與拓樸圖新增警示。

### Q-2　泵浦耗電改用水力公式
- **問題**：
  - `resolvePumpFromSizing` 把型錄的**馬達額定功率**當成運轉功率。
  - 負載比例又固定為 1（設計負載 = 實際負載），所以泵浦全年都以額定功率運轉。
  - 實際軸功率應為 `ρgQH/η`，通常低於馬達額定。
- **修正**：
  - 型錄泵浦已有 `designFlowM3h`、`designHeadM`。另外新增 `pumpEtaDesign`，預設 `A('pump_eta_default')` 0.75，與 `A('motor_eta_default')` 0.92。
  - 設計點電功率：
    ```
    P_design = ρ·g·Q_design·H_system / (η_pump·η_motor)
    ```
    - `Q_design` = `hydraulics.flow_lpm`（已依負載與 ΔT 算出），換算成 m³/s
    - `H_system` = `hydraulics.pump_head_m`。預設 CDU 一次側 28 m、Fanwall 二次側 22 m，**改為可在 Step 4 編輯**：
      - `cduSystem.pumpHeadM`、`fanwallSystem.pumpHeadM` 兩個新欄位，預設值搬進 ASSUMPTIONS：`cdu_pump_head_default_m` 28、`fw_pump_head_default_m` 22（ref「概估值，正式設計需依管路壓損計算（可用本站「水管風管壓損計算」工具）」）
      - 輸入欄放在各系統的水溫設定面板最下方，標籤「泵浦系統揚程 (m)」，旁邊小字「概估值，請依管路壓損計算覆寫」
      - `bridgeDuToPlantModel` 的 `pump_head_m` 改讀 `sys.pumpHeadM ?? A(...)`，刪除寫死的 28、22
      - `migrateProject`：舊專案缺欄位時不寫入（保持 undefined，走預設值）
  - 逐時：沿用現行 `PlantPumpEngine` 的 `(base + (1−base)·speed³)`，以 `P_design` 取代馬達額定。
  - 若 `P_design > 選定泵浦運轉台數 × capKw`，在 sizing 標示「泵浦馬達功率不足」。`passed` 判定改為比較 `P_design` 與 `(qty−1) × capKw`。
- **預期影響**：泵浦耗電下降，PUE 小幅下降。commit 內文列出 7 城市 `cduPump` MWh 前後對照。
- 與現行做法差異大時（> 30%），在 commit 內文說明原因。
- **接線測試**：Step 4 把 CDU 揚程從 28 改成 56 m，`results.overall.breakdownKwh.cduPump` 中一次泵的部分必須為 2 倍（±2%）。預設專案負載比例 = 1、泵速 = 1，逐時功率等於設計點功率，所以與揚程成正比。

---

## 5. 任務清單

| 任務 | 內容 | 允許變動 |
|---|---|---|
| G-1 | `updateSite` / `deserializeProject` 不沿用舊城市設計條件；修 `topo_preview.js` | 工具輸出 |
| G-2 | `run.js` 帶入 `designConditions`、`harness.js` 補檔、載入順序檢查 → 重存 `baseline_after_R3` | 工具 |
| G-3 | 待機／旁通標籤重疊 | 拓樸圖 |
| G-4 | Fanwall 兩行橫幅、共用 banner renderer | 拓樸圖 |
| W-1 | `weather_source.js` | 0 差異 |
| W-2 | Hourly adapter | 0 差異 |
| W-3 | Step 1 測站選擇器 | Step 1 UI |
| W-4 | 專案檔記錄測站、schema v6 | 0 差異（內建城市） |
| W-5 | exe 打包 165 站（不實際打包） | 建置腳本 |
| ~~W-6~~ | 本輪不做（§6-W2） | — |
| W-7 | `run.js --catalog` 165 站掃描 | 工具 |
| Q-1 | 冰機運轉範圍警示 | 驗證訊息 |
| Q-2 | 泵浦水力公式 | 數值可變 |

### 完成回報格式
1. 每個任務：commit hash、回歸摘要、截圖／接線測試。
2. W-7 的 165 站掃描摘要：PUE 分布、警示測站清單。
3. W-5 的預估 exe 大小。
4. §6 決定項採用的做法。

---

## 6. 東旭已確認的決定（2026-10-11）

| # | 問題 | 決定 | 理由 |
|---|---|---|---|
| W1 | 桌面版 exe 打包幾站 | **全部 165 站** | gzip 後只多 13 MB；exe 本來就是離線使用情境，只打包部分站點使用者會遇到「網站版有、桌面版沒有」的落差。W-5 的「逐檔解壓縮」注意事項必須照做，避免啟動時吃掉 91 MB 記憶體 |
| W2 | 7 城市內嵌 5.2 MB 是否移除 | **保留，W-6 本輪不做** | 內嵌城市是 `file://` 雙擊開啟時唯一可用的資料；165 站整合剛上線，先保留作為後備。等 W-7 全站掃描通過、使用一段時間後再評估 |
| W3 | 泵浦是否改用水力公式 | **採用，且揚程改為可編輯** | 用馬達額定功率當運轉功率不是「保守」而是「錯誤」— 馬達選型本身就有餘裕，結果會隨使用者挑的泵浦大小變動，跟實際水力無關。水力公式唯一的不確定是揚程，所以把揚程開放給使用者輸入，而不是寫死 28／22 m |
