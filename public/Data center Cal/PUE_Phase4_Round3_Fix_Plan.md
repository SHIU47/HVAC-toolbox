# PUE 計算系統 — .

- 前一份計畫：`PUE_Phase4_Topology_Fix_Plan.md`（S-0 ~ P4-7 已完成，分支 `pue-audit-fixes`，HEAD `b746952`）
- 審查者：Claude Opus 5.5（2026-10-03）
- 執行者：Antigravity
- 本輪重點：
  1. 修正第二輪留下的拓樸圖錯誤（模式小時數沒接上、溫度標錯、renderer 仍在做物理計算）
  2. 審查 Antigravity 對 D1～D4 的建議後，改用 **EPW 檔頭的 ASHRAE 極端氣候值** 當設計基準，取代「+1°C／×1.1」這類經驗加成

---

## 0. 執行守則（必讀）

1. **只動這些路徑**：`public/Data center Cal/**`、`tools/**`、`archive/weather_tools/build_weather_data.js`、`public/天氣資料/weather_data.js`（只能由 X-2 的產生器重新輸出，不可手改）、本文件。**不要**重寫 `public/天氣資料/hourly/*.json`。不要動 `dist/`、不要跑 `build.js`、不要部署、不要 push。
2. 繼續在分支 `pue-audit-fixes` 上做。**一個任務一個 commit**，訊息以任務編號開頭。不要 `git add -A`。
3. 開工前（任務 `S-0`）：
   ```
   cd tools/pue_regression
   node run.js --save baseline_after_P4.json
   node ui_snapshot.js --save ui_snapshot_after_P4.json
   node topo_preview.js
   node topo_preview.js --city "美國 (Alabama Andalusia)"
   ```

   commit 兩個 json。
4. 每個任務標示「允許變動」，規則同上一輪：
   - **0 差異**：`run.js --compare baseline_after_P4.json` 無差異。
   - **數值可變**：commit 內文貼 7 城市預設組合「前 → 後」，方向須符合「預期影響」，不符合就停下回報。
   - **拓樸圖可變**：跑 `topo_preview.js`（高雄 + Alabama 兩組），逐條勾選該任務的截圖驗收項。
5. **本輪新增規則：測試必須測「接線」，不能只測注入資料的 helper。**
   上一輪 P4-1 的單元測試直接把 `cduModeHours` 塞進 `topology()` 所以通過了，但實際畫面上模式小時數**從來沒有顯示過**（見 F-1）。本輪每個改到 UI 顯示的任務，都要在 `unit_checks.js` 加一條用 jsdom 實際 render Step 4、再對 `innerHTML` 做字串斷言的測試（寫法參考 `ui_snapshot.js` 的 `buildWindow()`，抽成 `tools/pue_regression/dom_harness.js` 共用）。
6. 新常數放 `js/assumptions.js`，附 `label` 與 `ref`。
7. 執行順序：**S → F → X → Y**。
8. §6 的決定項東旭已全部確認（見 §6），照該表執行。

---

## 1. 第二輪驗收結果

### 1.1 已確認正確

- 20 個 commit 都在，`unit_checks.js` 132/132 通過。
- **效能**：10 DU + 1 Pod 從 1289 ms 降到 **104 ms**，達標。
- `stage_chain.js`、`arch_helpers.js` 已建立，`adiabatic_trim` 組合測試只靠宣告就能跑通。可擴充性的目標達成。
- 拓樸修正有效的部分：
  - 閉式塔改成 CDU 一次側直通塔內盤管
  - 全額水冷冰機補上了冷卻水塔與冷卻水迴路
  - PHE 有無同時決定計算與圖面
  - 絕熱塔改為依需求噴霧
  - D5 與 RDHX 結露警示
  - Trim 架構 Mode 2/3 門檻改為 35／47°C
  - Fanwall 補上 FC 盤管與 WSE
- 數值變化方向正確（對 `baseline_after_D`）：
  - 絕熱塔 WUE 下降（例：高雄 0.021 → 0）
  - 純乾冷器因 PHE 2°C，高雄出現 2 h、台中出現 3 h 的容量缺口
  - 預設組合 PUE 不變

### 1.2 仍有問題（本輪 F 系列）

以 `topo_preview.js` 實際截圖 + 程式碼檢查發現，見 §2。

---

## 2. Phase F — 拓樸與接線錯誤修正

### F-1　模式小時數從來沒有顯示在圖上（接線錯誤）

- **位置**：
  - `views/view_cooling.js:501-502`
  - `views/schematics/schematic_series_trim.js:29-32`
  - `views/schematics/schematic_air_plant.js:29-30`
- **原因**：
  1. 讀的是 `AppStore.results`，正確路徑是 `AppStore.state.results`。
  2. 用 `r.id` 比對，但 `byDu[]` 的欄位是 `duId`、`byCorePod[]` 是 `podId`。
  3. `schematic_air_plant.js` 讀不存在的 `t.summ.unitResults`。
  4. Fanwall 架構的 `topology()` 在拿不到 `fwModeHours` 時會退回 `design.cduModeHours`（`air_air_cooled_chiller.js:124`、`air_rdhx.js:120`、`air_water_cooled_chiller.js:179`），**拿液冷系統的小時數去標氣冷系統**。
- **修正**：
  - `view_cooling.js` 在 render 每個單元時先找一次結果：`const unitRes = (state.results.byDu||[]).find(r => r.duId === t.id) || (state.results.byCorePod||[]).find(r => r.podId === t.id);`
  - 把 `{ cduModeHours: unitRes?.cduModeHours, fwModeHours: unitRes?.fwModeHours, deficitHours: unitRes?.deficitHours }` 傳給兩個 schematic 的 `ctx`。
  - schematic 內刪除所有自己查結果的程式碼。
  - 三個 Fanwall 架構刪除 `|| design?.cduModeHours` 這個退路。拿不到 `fwModeHours` 時橫幅不顯示小時數，不要拿別的系統頂替。
- **允許變動**：拓樸圖（橫幅多出「全年 N h」）。
- **截圖驗收**：
  - 高雄 Trim 圖三個橫幅都有「全年 N h」，且三數相加 = 8760。
  - Fanwall 氣冷冰機圖三個橫幅都有小時數，且與 `fwFcStats` 一致。
- **接線測試**：jsdom render Step 4 後，`innerHTML` 必須含 `全年` 與 `byDu[0].cduModeHours.free` 的數字。

### F-2　冷凝器出水溫寫死 `+5.0`

- **位置**：
  - `cooling/archs/liquid_dry_cooler_trim.js:171`（`condOut: tCewt + 5.0`）
  - `cooling/archs/air_water_cooled_chiller.js:137`（同）
- **現象**：高雄設計點 Trim 冰機停機，冷凝器進水 51°C，圖上出水卻標 **56°C**。出水溫跟負載完全無關。
- **修正**（定流量、溫升與排熱量成正比）：
  - Trim（冷凝器串在乾冷器迴路上，流量 = FWS 平衡流量）：
    ```
    m_cp    = Q_liq_design / (FWS回 − FWS供)              // kW/K
    condOut = condIn + (Q_trim + P_comp) / m_cp
    ```

    Q_trim = 0 時，`condOut = condIn`。
  - Fanwall 水冷冰機（冷卻水流量依設計工況定）：
    ```
    m_cp_cw = Q_air_design × (1 + 1/COP_design) / A('cdw_dt_design_c')
    condOut = condIn + (Q_mech + P_comp) / m_cp_cw
    ```

    新常數 `cdw_dt_design_c`：5.0°C，ref「AHRI 550/590 標準工況冷卻水 30→35°C」。
  - `P_comp` 一律用 `ChillerEngine.calcPower` 在該工況算出的值（見 F-3），不用型錄 COP。
- **允許變動**：拓樸圖數字。
- **接線測試**：高雄設計點 Trim 圖中，冷凝器進水與出水的標籤數字相同。

### F-3　Renderer 仍在做物理計算

- **位置**：
  - `views/schematics/schematic_series_trim.js:97-118`：自己呼叫 `operatingPoint()`、`ChillerEngine.calcPower()` 算尖峰工況，而且沒有經過 staging。
  - `views/schematics/schematic_series_trim.js:74-81`：17 處寫死的後備溫度字面值（`'35.0'`、`'45.0'`、`'49.8'`、`33.0`…）。
- **修正**：
  - 各架構的 `operatingPoint(sys, w, equip, opts)` 新增 `opts.withChiller`。為 `true` 時，在 arch 內透過 `stage_chiller`（含 `calcLeadLagStaging`）算出 `chillerKw`、`chillerCop`、`condOut`，一併回傳。
  - Trim 架構新增 `peakPoint(sys, design, equip)`：回傳在尖峰設計乾球（見 Y-3）下的 `operatingPoint(..., { withChiller: true })`。
  - renderer 只讀 `op` / `peak` 的欄位。
  - 後備字面值全部刪除：`op` 缺值時該標籤顯示 `—`。
- **允許變動**：0 差異（數值）；拓樸圖只允許 F-2 帶來的數字變化。
- **驗收**：`grep -nE "ChillerEngine|operatingPoint\(|calcSeriesEconomizer|'[0-9]+\.[0-9]'" views/schematics/*.js` 必須 0 筆。

### F-4　Trim 圖的「外氣乾球溫」標的是門檻值

- **位置**：`schematic_series_trim.js` 的 `outdoorDb = op?.thresholds?.full`（第 247 行附近使用）。
- **現象**：高雄標「外氣乾球溫 35°C」，但設計乾球是 34°C；35°C 是 Mode 1 門檻。
- **修正**：標籤改為 `設計乾球 (0.4%): {designDb}°C`，數值取 `designConditions().designDb`，並與 `op` 用同一個 DB 計算。

### F-5　Fanwall 預冷後溫度標錯（標成可用溫度而非預冷結果）

- **位置**：
  - `schematic_air_plant.js:105` 用 `op.temps.coilAvail`
  - 各 Fanwall arch `operatingPoint()` 只回傳 `coilAvail` / `tAvail`
- **現象**：
  - Alabama 設計 DB 36.1°C 時，氣冷冰機與 RDHX 圖上「FC 盤管 → 蒸發器」之間標 **40.1°C**，比冰水回水 18°C 還高，物理上不可能。
  - 水冷冰機圖在 WSE 不運轉時，WSE → 冰機之間標 12°C（那是供水溫）。
- **修正**：
  - `operatingPoint().temps` 新增 `chwPre = eco.t_precooled_c`，也就是 `clamp(tAvail, chwSup, chwRet)`。
  - 管線標籤改用 `chwPre`。
  - `eco.fc_fraction === 0` 時，FC 盤管／WSE 方框改用停機灰色（比照 Trim 的 Standby 樣式），內文顯示 `旁通（{basis} 過高，可用溫度 {tAvail}°C ≥ 回水 {chwRet}°C）`。
- **截圖驗收**：Alabama 三張 Fanwall 圖的預冷後溫度 ≤ 冰水回水溫；FC 盤管與 WSE 顯示旁通狀態。

### F-6　橫幅與方框文字

- Trim Mode 3 橫幅右側仍殘留「全額走 Trim 冰機製冷」，改為「乾冷器僅排冷凝熱」。
- Trim Mode 2/3 橫幅文字太長被拆行（`(35 < DB` / `< 47°C)` 斷在中間）。橫幅改為兩行固定格式：
  - 第一行：`Mode N 名稱`
  - 第二行：`門檻 ｜ 全年 h ｜ 說明`
- Trim 圖待機狀態下，「待機 (Standby)」標籤壓到冰機圓形圖示（高雄截圖可見）。標籤移到方框標題列右側。
- `air_water_cooled_chiller.js:230` 的 `設計 WB ${designWb}` 顯示成 `30.39`，改成 `toFixed(1)`。全專案拓樸溫度一律 1 位小數。
- 全額水冷冰機圖寫死 `COP 5.5`（`liquid_water_chiller.js:202,222,270`）：改顯示 `operatingPoint(..., { withChiller: true }).chillerCop`，標註「設計工況模擬」。只有在沒有選型資料、走 fallback 時才顯示 `5.5（後備值）`。
- 水冷冰機（Fanwall）圖的「設計 COP」比照辦理。
- **允許變動**：拓樸圖。

### F-7　「100% 自然冷卻」字樣與模擬結果矛盾

- 純乾冷器、絕熱塔、閉式塔的橫幅與方框寫「100% 自然冷卻」「全年零冰機」，但模擬有容量缺口小時（例：高雄純乾冷器 2 h）。
- **修正**：
  - `unitRes.deficitHours > 0` 時，橫幅右側改為 `全年 {N} h 超出冷卻能力（供水溫上升）`，用警示色。
  - 「全年零冰機」保留（這句沒錯），但刪除「100%」字樣。
- **截圖驗收**：高雄純乾冷器圖顯示「全年 2 h 超出冷卻能力」。

### F-8　Step 1 仍用錯誤的 Mode 2/3 門檻

- **位置**：
  - `views/view_weather.js:32`、`views/view_weather.js:407` 呼叫 `AppStore.getEffectiveFcThresholds()`
  - 該函式（`store.js:1338`）仍是 `Mode1 + 5.7` 邏輯
- **修正**：
  - 新增 `AppStore.dominantCduThresholds()`：取液冷負載最大的單元，回傳其 `arch.operatingPoint(sys, designPoint, equip).thresholds` 與架構名稱。
  - Step 1 改用它，並在顯示處標註「依 {架構名稱} 門檻」。`basis === 'wb'` 時，Step 1 的分類改用濕球統計。
  - 刪除 `getEffectiveFcThresholds` 與 `nvidia_dsx_mode2_offset_c`。
- **允許變動**：Step 1 的 FC 潛力數字與文字。
- **預期影響**：預設專案 Step 1 的「Mode 3 機械小時」降為 0（因為 Mode 3 門檻從 40.7 改為 47°C）。

### F-9　`topo_preview.js` 帶 `--city` 會覆蓋預設圖

- 上一輪跑 Alabama 會覆蓋高雄的 9 張圖（同檔名）。
- **修正**：`--city` 不是預設城市時，檔名加城市後綴，例如 `cdu_dry_cooler_trim__alabama.png`。

---

## 3. Phase X — ASHRAE 極端氣候值（D1、D3 的資料基礎）

### 背景

Antigravity 建議：

- D1：用「年最低溫 ≥ 4°C」判斷結霜風險
- D3：Trim 選型用「maxDb + 1°C」或「× 1.1」

這兩個做法的共同問題是拿 **TMY（典型氣象年）** 的最高／最低溫當極端值。TMY 是挑出來的「典型」月份，**本質上就排除了極端年**。

EPW 檔第 2 行 `DESIGN CONDITIONS` 已經內含 ASHRAE Handbook Ch.14 的極端年 n 年回歸期乾球溫度。實測本專案 8 個 EPW：

| 城市    | TMY 最高 DB | ASHRAE 極端年最高（平均） | n=20 年回歸最高 | TMY 最低 DB | n=50 年回歸最低 |
| ------- | ----------- | ------------------------- | --------------- | ----------- | --------------- |
| 新加坡  | 34.0        | 34.4                      | 35.7            | 22.9        | 20.9            |
| 桃園    | 34.3        | 37.1                      | **42.0**  | 7.7         | **−1.8** |
| 高雄    | 36.0        | 35.2                      | 36.7            | 12.0        | 5.2             |
| 新竹    | 33.1        | N/A                       | N/A             | 8.0         | N/A             |
| 台中    | 35.3        | 35.3                      | 37.2            | 8.5         | 3.1             |
| 菲律賓  | 35.8        | 37.0                      | **39.6**  | 20.0        | 13.0            |
| Alabama | 37.8        | 38.4                      | **41.1**  | −7.2       | −11.0          |

可以看到：

- 「TMY 最高 + 1°C」在菲律賓少估 2.8°C、Alabama 少估 2.3°C、桃園少估 6.7°C。
- 「× 1.1」是乘在 kW 上，跟 N+1 的備援容量重複計算，物理意義也不明。
- 結霜判斷用 TMY 最低溫，台中（8.5°C）會被判定「無結霜風險」，但它的 50 年回歸最低溫是 3.1°C。

**結論：D1、D3 改用 ASHRAE 極端值。** 這是 ASHRAE TC9.9 與 Uptime 對關鍵設施建議的做法。

### 本節與「天氣資料彙總」的關係

東旭下一步要把 `public/天氣資料/` 的 165 站資料整合進 PUE 計算系統。現況：

- `public/天氣資料/weather_data.js`：165 站的測站資料（`BUILTIN_WEATHER_STATIONS`）
- `public/天氣資料/hourly/*.json`：逐時資料
- 兩者都由 `archive/weather_tools/build_weather_data.js` 從 `archive/weather_raw_zips/ZIP檔/**/*.epw`（165 個 EPW）產生
- 測站資料目前只有 ASHRAE 0.4% 冷卻設計值（`extDB`、`extWB`），**沒有**極端年 n 年回歸值

因此本節的做法是：

- **極值解析只寫一份程式**，PUE 系統（瀏覽器）與 165 站產生器（Node）共用。
- 165 站的測站資料直接帶上極值欄位。
- PUE 系統內的 `site.designConditions` 欄位格式與測站資料**完全相同**。

這樣下一步整合 165 站時，資料格式不用再轉換，直接放進 `site.designConditions` 就能用。

### X-1　共用解析模組 `js/ashrae_design_conditions.js`

- 新檔，UMD 寫法：瀏覽器掛 `window.AshraeDesign`，Node 用 `module.exports`。在 `index.html` 中放在 `epw_parser.js` 之前載入。
- `parseEpwDesignConditions(line2)` 解析 EPW 第 2 行 `DESIGN CONDITIONS`，回傳下方格式；整行無 ASHRAE 資料時回傳 `null`。
- **Cooling 區塊**（關鍵字 `Cooling` 之後）：
  ```
  [0] 最熱月  [1] 日較差  [2] 0.4% DB  [3] 0.4% MCWB  [4] 1% DB ... [8] 0.4% 蒸發 WB  [9] MCDB
  ```
- **Extremes 區塊**（關鍵字 `Extremes` 之後）：
  ```
  [0] WS 1%   [1] WS 2.5%   [2] WS 5%
  [3] 極端年最低 DB 平均   [4] 極端年最高 DB 平均
  [5] 最低 DB 標準差       [6] 最高 DB 標準差
  [7] n=5 最低  [8] n=5 最高   [9] n=10 最低  [10] n=10 最高
  [11] n=20 最低 [12] n=20 最高 [13] n=50 最低 [14] n=50 最高
  ```

  只讀乾球，濕球極值不用。
- 回傳格式（**這就是 `site.designConditions` 與 165 站測站資料共用的格式**）：
  ```js
  {
    source: 'ASHRAE HOF Ch.14 (EPW header)',
    cooling: { db004: 33.5, mcwb004: 26.8, evapWb004: 28.3 },   // 任一缺值為 null
    extremes: {                                                 // Extremes 區塊整段 N/A 時為 null
      dbMaxMean: 35.2, dbMinMean: 10.1,
      dbMax: { 5: 35.7, 10: 36.2, 20: 36.7, 50: 37.2 },
      dbMin: { 5: 8.7,  10: 7.6,  20: 6.6,  50: 5.2 }
    }
  }
  ```
- `epw_parser.js`：使用者上傳 EPW 時呼叫此函式，結果存入 `site.designConditions`。
- `serializeProject` 一併保存 `site.designConditions`（約 300 bytes），`deserializeProject` 讀回。
- **驗收**：
  - 高雄 EPW：`cooling.db004 === 33.5`、`cooling.evapWb004 === 28.3`、`extremes.dbMax[20] === 36.7`、`extremes.dbMin[50] === 5.2`
  - 新竹 EPW：`extremes === null`

### X-2　165 站產生器帶上 ASHRAE 資料

- 修改 `archive/weather_tools/build_weather_data.js`：
  1. `require('../../public/Data center Cal/js/ashrae_design_conditions.js')`，對每個 EPW 第 2 行呼叫 `parseEpwDesignConditions`，結果存成測站物件的 `designConditions` 欄位。
  2. 既有的 `extDB`、`extWB` 欄位**保留不變**（`public/天氣資料/` 的頁面有在用），但改成優先取 `designConditions.cooling`，取不到才走原本的 `.ddy/.stat` 與排序後備。
  3. 修正輸入路徑：現行程式掃描的 `archive/weather_tools/ZIP檔` 不存在，EPW 實際在 `archive/weather_raw_zips/ZIP檔`。改成命令列參數 `--in <dir>`，預設指向後者。
  4. 新增 `--meta-only` 參數：只重新輸出 `weather_data.js`，**不重寫** `hourly/*.json`（165 個檔、91 MB，避免 git 產生大量無意義的異動）。
  5. 新增 `--out <dir>` 參數，預設維持現行的 `archive/weather_tools/`。
- 執行：
  ```
  node archive/weather_tools/build_weather_data.js --in archive/weather_raw_zips/ZIP檔 --out public/天氣資料 --meta-only
  ```
- **驗收**：
  - `public/天氣資料/weather_data.js` 的 165 站都有 `designConditions` 欄位。
  - 除了新增欄位之外，其他欄位與現行檔案逐站比對完全相同（寫一個比對腳本，在 commit 內文貼結果）。
  - 檔案大小增加 < 60 KB。
  - 開啟 `public/天氣資料/Weather_Pro.html` 可正常顯示（用 Chrome headless 截一張圖確認沒有錯誤）。

### X-3　PUE 系統的 7 個內建城市補上 `designConditions`

- 新增 `tools/weather/inject_design_conditions.js`：讀 `public/Data center Cal/weather/ZIP檔/*/*.epw`，用 X-1 的同一個解析函式，依 `stationInfo.location` 對應城市 key，寫入 `js/weather_builtin.js` 每個城市物件的 `designConditions`。泰國 EPW 沒有對應的內建城市，略過。
- 載入內建城市時（`view_weather.js` 選城市、`app.js` 預設城市、`deserializeProject`）一併帶入 `site.designConditions`。
- 這是過渡做法：165 站整合完成後，內建城市可直接改讀測站資料，此注入腳本即可廢棄。
- **驗收**：7 城中 6 城有 `extremes`，新竹 `extremes === null`、但有 `cooling`；`weather_builtin.js` 大小增加 < 5 KB。

### X-4　`designConditions()` 擴充與資料優先順序

`AppStore.designConditions()` 改為：

```js
const dc = site.designConditions || null;
const tmy = { designDb: dbSorted[34], designWb: wbSorted[34], maxDb: dbSorted[0] };   // 現行算法保留作後備
return {
  // 0.4% 設計值：ASHRAE 優先，沒有才用 TMY 排序第 35 大
  designDb: dc?.cooling?.db004 ?? tmy.designDb,
  designWb: dc?.cooling?.evapWb004 ?? tmy.designWb,
  designBasis: dc?.cooling?.db004 != null ? 'ASHRAE 0.4%' : 'TMY 排序 0.4%',
  maxDb: tmy.maxDb,
  extremes: dc?.extremes ?? null,
  peakDb: (() => {
    const n = A('design_extreme_return_years');                     // 20（東旭已確認）
    const v = dc?.extremes?.dbMax?.[n];
    if (Number.isFinite(v)) return { value: Math.max(v, tmy.maxDb), basis: `ASHRAE n=${n} 年回歸` };
    return { value: tmy.maxDb + A('design_extreme_fallback_margin_c'), basis: 'TMY 最高 + 餘裕（無 ASHRAE 極值）' };
  })(),
  freezeDb: (() => {
    const v = dc?.extremes?.dbMin?.[50];
    return Number.isFinite(v) ? { value: v, basis: 'ASHRAE n=50 年回歸' } : null;
  })(),
  dataQualityWarning: null   // 見下方
};
```

- 資料品質檢查：`peakDb` 來自 ASHRAE 且 `peakDb.value − tmy.maxDb > A('design_extreme_tmy_gap_warn_c')`（5.0°C）時，`dataQualityWarning = '本站 ASHRAE 極值與 TMY 最高溫相差 {x}°C，建議核對測站資料'`。這個檢查對 165 站都適用（桃園目前會觸發）。
- 新常數：
  - `design_extreme_return_years`：20，ref「ASHRAE HOF Ch.14 極端年 n 年回歸期；關鍵設施常用 n=20」，只允許 5／10／20／50
  - `design_extreme_fallback_margin_c`：2.0
  - `design_extreme_tmy_gap_warn_c`：5.0
- **允許變動**：數值可變。`designDb`/`designWb` 改用 ASHRAE 0.4% 後，降額選型會微幅改變。實測高雄 TMY 0.4% WB 28.56°C、ASHRAE 28.3°C；DB 34.0 → 33.5°C。
- **預期影響**：
  - 冷卻塔、冰機的降額係數微升，部分 `sizing.passed` 可能由 ✗ 變 ✓。
  - PUE／WUE 0 差異（逐時模擬仍用 TMY 逐時資料）。
  - commit 內文列出 7 城市新舊 designDb／designWb 對照。

### X-5　給下一步「165 站整合」的注意事項（本輪不實作，寫進 `public/Data center Cal/WEATHER_INTEGRATION_NOTES.md` 備忘）

審查 `public/天氣資料/hourly/*.json` 時發現的格式差異。整合時要在 adapter 層轉換，**不要改 165 個 JSON**：

| 項目     | 165 站 hourly JSON                                    | PUE 系統`site.hourly` 期待的格式                                                                                                                                                                                        |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 月份     | `m`，**0～11**                                | `month`，1～12。adapter 必須轉成 `month = m + 1`。若直接寫 `month = m`，`computeMonthlyStats` 的 `h.month ? h.month−1 : 依索引推算` 會把 1 月（0）當成沒有值而改用索引，其餘月份卻整體錯位一個月，而且不會報錯 |
| 日／時   | `d`、`h`（1～24）                                 | `day`、`hour`（`isHourInSchedule` 讀 `record.hour` / `record.day`）                                                                                                                                             |
| 索引     | 無                                                    | `hourIndex`（部分統計會用）                                                                                                                                                                                             |
| 濕球     | 產生器的`calculateWetBulb`                          | 內建資料。已驗證高雄逐時平均偏差 0.01°C，可直接使用                                                                                                                                                                      |
| 檔案大小 | 每站約 550 KB，165 站 91 MB                           | 不能像`weather_builtin.js` 那樣全部內嵌。要用 `fetch` 按需載入；`file://` 開啟時 fetch 會被 CORS 擋，需要比照 `catalog_manager.js` 的 file:// 後備策略                                                            |
| 設計值   | `extDB`/`extWB` + X-2 新增的 `designConditions` | X-4 的`site.designConditions`，格式相同，直接帶入                                                                                                                                                                       |

---

## 4. Phase Y — D1～D4 最終做法

### 對 Antigravity 建議的審查結論

| #  | Antigravity 建議                  | 審查結論                                                                                                                                                                             |
| -- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 | 年最低溫 ≥ 4°C 時提示可取消 PHE | **方向同意，資料來源改掉**：用 ASHRAE n=50 年回歸最低乾球，不用 TMY 最低溫（台中會誤判）。提示文字補充 PHE 的其他用途（壓力隔離、防止室外側污染進入 CDU 一次側），不能只講結霜 |
| D2 | 維持依需求噴霧                    | **同意**，不需修改                                                                                                                                                             |
| D3 | maxDb + 1°C 或 × 1.1            | **不同意**。+1°C 會嚴重低估（菲律賓 −2.8°C、Alabama −2.3°C）；× 1.1 會跟 N+1 重複計算。改用 ASHRAE n=20 年回歸最高乾球                                                   |
| D4 | 由 Step 1 的機房溫濕度算動態露點  | **方向同意，但 Step 1 沒有機房溫濕度輸入欄**（Step 1 只有室外氣象）。改成在 RDHX 的架構參數面板加輸入                                                                          |

### Y-1　D1 PHE 結霜提示

- 條件：`designConditions().freezeDb` 不為 `null`，且 `freezeDb.value > A('freeze_risk_db_c')`（新常數 4.0°C，ref「乾冷器盤管靜止水在夜間輻射冷卻下可能於外氣 0～3°C 結冰，取 4°C 安全餘裕」）。
- 顯示位置：Step 4 架構參數面板中 `hasPhe` 勾選框下方（只在 `dry_cooler_pure`、`dry_cooler_trim`、`adiabatic_tower` 且 `hasPhe=true` 時顯示），小字灰色：
  > 本案場 ASHRAE 50 年回歸最低乾球 {v}°C，無結冰風險。若室外側使用防腐處理純水且不需壓力隔離，可取消 PHE，自然冷卻門檻可提高 {pheApproachC}°C。
  >
- `freezeDb.value ≤ 4°C` 時改顯示警示色：
  > 本案場 50 年回歸最低乾球 {v}°C，有結冰風險，室外側需乙二醇並保留 PHE 隔離。
  >
- `freezeDb === null`（新竹）時不顯示。
- 不自動改 `hasPhe`，只提示。
- **允許變動**：Step 4 參數面板文字。
- **接線測試**：高雄（5.2°C）顯示「無結冰風險」，台中（3.1°C）顯示「有結冰風險」。

### Y-2　D2 維持現狀

不需任務。

### Y-3　D3 Trim 冰機選型改用 ASHRAE 尖峰乾球

- `liquid_dry_cooler_trim.js` 的 `trim_chiller.requiredKw`：基準從 `maxDb` 改為 `designConditions().peakDb.value`。
- `requiredText` 尾巴加 `（選型基準 DB {value}°C，{basis}）`；`designConditions().dataQualityWarning` 不為 null 時再加 ` ⚠ {warning}`。
- F-3 的 `peakPoint()` 與尖峰工況表格同樣改用 `peakDb`，表頭改為 `尖峰設計 DB {value}°C（{basis}）工況：…`。
- `dry_cooler_pure` 也用 `peakDb` 做一次檢查：若 `peakDb.value + dcApproach + phe > FWS供`，在 `validation.checks` 加 ⚠

  > ASHRAE 尖峰乾球 {v}°C 時 FWS 供水將升至 {T}°C（超出設計 {FWS供}°C），純乾冷器無機械備援
  >
- **允許變動**：Trim 冰機 `sizing` 的 `requiredKw` 與 `passed`；驗證訊息；拓樸圖尖峰表格。
- **預期影響**（FWS 42/54、乾冷器 approach 5、PHE 2，n=20）：

  | 城市    | 現行基準 maxDb → 冰機負擔 | 新基準 → 冰機負擔 |
  | ------- | -------------------------- | ------------------ |
  | 高雄    | 36.0 → 8.3%               | 36.7 → 14.2%      |
  | 菲律賓  | 35.8 → 6.7%               | 39.6 → 38.3%      |
  | Alabama | 37.8 → 23.3%              | 41.1 → 50.8%      |
  | 桃園    | 34.3 → 0%（50 kW 下限）   | 42.0 → 58.3%      |

  部分組合會從「滿足 N+1」變「容量不足」，這是預期行為。PUE／WUE 0 差異（逐時模擬仍用 TMY）。

### Y-4　D4 RDHX 動態露點保護

- `air_rdhx.js` 的 `params` 新增（透過既有的 `renderArchParamPanel` 產生輸入欄）：
  - `roomDbC`：機房冷通道乾球，預設 `null`
  - `roomRhPct`：相對濕度，預設 `null`
- 露點計算：把 `store.js` 內的 `calcDewPointC`（Magnus-Tetens）搬到 `engines_core.js` 成為共用函式。
- 保護溫度：
  ```
  若 roomDbC 與 roomRhPct 都有值：limit = calcDewPointC(roomDbC, roomRhPct) + A('rdhx_dewpoint_margin_k')
  否則：limit = A('rdhx_default_room_dp_c') + A('rdhx_dewpoint_margin_k')
  ```

  新常數：- `rdhx_default_room_dp_c`：15.0°C，ref「ASHRAE TC9.9 A1 建議露點上限」
  - `rdhx_dewpoint_margin_k`：2.0 K
  - 刪除 `rdhx_min_chws_c`（17 = 15 + 2，結果不變）
- 警示文字改為：
  > RDHX 供水 {chwSup}°C 低於結露保護溫度 {limit}°C（機房露點 {dp}°C {+ 來源}），有結露風險
  >
- **允許變動**：Step 4 RDHX 參數面板多兩個輸入欄；警示文字。
- **接線測試**：輸入 24°C / 50% 時，警示中的保護溫度 = 14.9°C（露點 12.9 + 2），CHW 12°C 仍觸發警示；CHW 16°C 不觸發。

---

## 5. 任務清單（照順序）

| 任務 | 內容                                                                                                                             | 允許變動           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| S-0  | 存`baseline_after_P4.json`、`ui_snapshot_after_P4.json`，產出兩組截圖                                                        | —                 |
| S-1  | 建立`tools/pue_regression/dom_harness.js`（從 `ui_snapshot.js` 抽出 `buildWindow()`），`unit_checks.js` 改用它做接線測試 | 0 差異             |
| F-9  | `topo_preview.js` 城市後綴                                                                                                     | 工具               |
| F-1  | 模式小時數接線                                                                                                                   | 拓樸圖             |
| F-3  | Renderer 去物理化，`operatingPoint(opts.withChiller)`、`peakPoint()`                                                         | 0 差異             |
| F-2  | 冷凝器出水溫公式                                                                                                                 | 拓樸圖數字         |
| F-4  | 設計乾球標籤                                                                                                                     | 拓樸圖             |
| F-5  | Fanwall 預冷後溫度與旁通狀態                                                                                                     | 拓樸圖             |
| F-6  | 橫幅與方框文字、COP 顯示                                                                                                         | 拓樸圖             |
| F-7  | 容量缺口小時顯示                                                                                                                 | 拓樸圖             |
| F-8  | Step 1 門檻改用架構描述檔，刪除`getEffectiveFcThresholds`                                                                      | Step 1 數字        |
| X-1  | 共用 ASHRAE 解析模組 + 上傳 EPW 解析                                                                                             | 0 差異             |
| X-2  | 165 站產生器帶上`designConditions`，重新輸出 `public/天氣資料/weather_data.js`（`--meta-only`）                            | 測站資料新增欄位   |
| X-3  | PUE 系統 7 個內建城市注入`designConditions`                                                                                    | 0 差異             |
| X-4  | `designConditions()` 改為 ASHRAE 優先、新增 `peakDb`／`freezeDb`／資料品質警示                                             | 選型降額微幅變動   |
| X-5  | 撰寫`WEATHER_INTEGRATION_NOTES.md`                                                                                             | 文件               |
| Y-1  | PHE 結霜提示                                                                                                                     | 參數面板文字       |
| Y-3  | Trim 選型改用 ASHRAE 尖峰乾球、純乾冷器尖峰警示                                                                                  | 選型結果、驗證訊息 |
| Y-4  | RDHX 動態露點                                                                                                                    | 參數面板、警示     |

### 完成回報格式

1. 每個任務：commit hash、回歸比對摘要、截圖驗收逐條勾選、新增的接線測試名稱。
2. 最終兩組截圖（高雄、Alabama）共 18 張的檔名清單。
3. §6 決定項採用的做法。
4. 無法照本文件執行的地方與原因。

---

## 6. 東旭已確認的決定（2026-10-03）

| #  | 問題                                                                | 決定                                                                                                                                                                                                                       |
| -- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1 | 極端年回歸期                                                        | **n=20**（`design_extreme_return_years` = 20，假設表仍可改成 5／10／50）                                                                                                                                           |
| E2 | 桃園測站 ASHRAE 極值異常（n=20 最高 42.0°C，比 TMY 最高高 7.7°C） | 不針對桃園個別處理。東旭下一步會整合`public/天氣資料/` 的 165 站資料，屆時可改選其他測站（例如台北松山）。本輪只做 X-4 的**通用資料品質警示**（ASHRAE 極值與 TMY 最高溫差 > 5°C 時提示核對測站），對 165 站都適用 |
| E3 | 結霜判斷門檻                                                        | **4°C**，用 ASHRAE n=50 年回歸最低乾球判斷                                                                                                                                                                          |
