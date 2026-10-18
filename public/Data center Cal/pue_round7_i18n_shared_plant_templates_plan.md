# PUE 計算系統 Round 7 — 中英文切換、共用冷卻系統分組（N+X）、方案比較與 DU 模組範本

> **執行代理**：Antigravity（或任何程式碼修正代理）
> **適用版本**：branch `pue-audit-fixes`，HEAD `ebcd8b5`（Round 6 全部完成，`unit_checks.js` 185/185 通過）
> **工作目錄**：`public/Data center Cal/`（下稱 `DCC/`）；測試在 `tools/pue_regression/`
> **本輪目標**：
> 1. 全站中文 / English 一鍵切換（Phase I）
> 2. Step 4 由「每個 DU 各自一套冷卻系統」改為「設計師自行分組」：可整場一套、或 2 DU + 1 CorePOD 一套 / 另 2 DU 一套；冗餘可選 N / N+1 / N+2 / 2N（Phase P）
> 3. 不同冷卻分組方案可並排比較（Phase S）
> 4. DU 模組範本：存成範本 → 一次套用 / 批量新增 / 範本更新後同步（Phase T）
> 5. Round 6 審查遺留問題修正（Phase 0）

---

## 0. 執行守則（每個 Task 都必須遵守）

1. **一個 Task 一個 commit**，commit 訊息格式：`<type>(r7): <Task ID> <摘要>`。
2. **不修改 `dist/`、不執行 `build.js`、不 merge 到 main**。全部完成後由使用者決定何時 build。
3. **所有新常數放 `js/assumptions.js` 並用 `A('key')` 讀取**，禁止在引擎/Stage 寫魔術數字。
4. **向後相容**：舊專案檔（schema v6）必須能載入，且「未使用新功能」的專案計算結果必須與 Round 6 **完全一致**（見各 Phase 的零差異關卡）。
5. **每個 Task 完成後必跑**：
   ```bash
   node tools/pue_regression/unit_checks.js            # 必須 0 failed
   node tools/pue_regression/run.js --compare tools/pue_regression/baseline_after_R6.json
   ```
   標示「預期有差異」的 Task 才允許 `run.js` 出現差異，且必須在 commit 訊息中寫明差異來源。
6. `harness.js` 的 `FILES` 清單必須與 `index.html` 的 `<script>` 順序完全一致（`check_harness_order.js` 會檢查）。新增 JS 檔時兩邊同步加。
7. 文字一律繁體中文工程術語；新增的英文翻譯使用 ASHRAE / Uptime / ISO 30134 標準英文術語（見附錄 B 詞彙表）。

---

## Phase 0 — 基準與 Round 6 遺留問題

### Task S-0：保存 Round 6 基準（不改程式）

```bash
node tools/pue_regression/run.js --save tools/pue_regression/baseline_after_R6.json
node tools/pue_regression/ui_snapshot.js --save tools/pue_regression/ui_snapshot_after_R6.json --mode full
```
Commit：`chore(r7): S-0 save baseline_after_R6`

> 目前 repo 只有 `baseline_after_R4.json`，Round 6 沒存基準，Phase 0 之後的所有比對都以 `baseline_after_R6.json` 為準。

### Task R7-0a：預設 CDU 台數未計入降額 → 預設專案全年 8,760 h 容量不足（**預期有差異**）

**現況（已驗證）**：
- `SizingEngine._createSizingItem`（`js/sizing/sizing_engine.js:23-71`）用 `eq.calcQty(reqKw, unitCapKw)` 決定初始 `selectedQty`，**沒有考慮降額**。
- Round 6 P0-T1 之後模擬引擎改用降額後容量，預設專案 DU-01 的 `cdu_unit` 為 10 台 × 100 kW × 0.76 = 有效 684 kW < 需求 862.6 kW（需 13 台）。
- 結果：`overall.capacityDeficitHours = 8760`、`maxCapacityDeficitKw = 179`，Dashboard 的 PUE 是在「有 179 kW 熱量沒被移除」的狀態下算出來的。

**修正**：
1. sizing item 新增欄位 `userEdited: boolean`（預設 `false`）。`AppStore.updateSelectedEquipment()`（`js/store.js` 約 1000 行）在使用者改型號或台數時設為 `true`。
2. `SizingEngine.evaluateCduSizing()` 與 `evaluateFwSizing()` 算完 `requiredUnitsN1`（已含 `derateFactor`）後：
   ```js
   if (!s.userEdited && s.selectedQty < s.requiredUnitsN1) s.selectedQty = s.requiredUnitsN1;
   ```
   然後再算 `effectiveCapKw` / `passed`。
3. **不得**覆寫 `userEdited === true` 的項目（使用者手動選的就算不足也保留，交給 Step 4 紅燈）。
4. `migrateProject`：舊專案的 sizing item 沒有 `userEdited` 欄位時，**一律視為 `true`**（保護使用者既有設計，不自動改台數）。
5. `tools/pue_regression/unit_checks.js` 內的 `sizeCduToDeratedN1()` 測試輔助函式保留不刪（舊測試仍可用），新增測試：
   - 全新預設專案 `calculate()` 後 `capacityDeficitHours === 0`。
   - 使用者手動把 `cdu_unit` 改成 2 台（`userEdited=true`）後，重新 `calculate()` 不會被改回。
   - 載入舊專案（無 `userEdited`）時台數不被改動。

**預期**：`run.js` 140 組中 CDU 台數會變多，CDU 耗電與 deficit 小時數改變。在 commit 訊息附上預設專案（高雄）修正前後 PUE。

### Task R7-0b：冷卻水泵 (CW Pump) 從 CDU 一次泵分離（**預期有差異：僅 sizing 判定**）

**現況（已驗證）**：P1-H1 把 CW 泵功率直接加到 `cduSys.hydraulics.pump_power_kw`（`js/store.js` 約 1595 行），導致：
- `cdu_pump` 的馬達選型需求 `requiredKw` 被灌入 CW 泵功率（`water_chiller` 時由 11.5 kW 變 24.6 kW），選型燈號錯誤；
- 熱排放倍率寫死 `1.18`（液冷）/ `1.20`（氣冷），違反守則 3。

**修正**：
1. `hydraulics` 拆成 `pump_power_kw`（一次側 FWS/CHW 泵，含 PHE 附加揚程）與 `cw_pump_power_kw`（冷卻水泵）。`cdu_pump` / `fw_pump` 的 `requiredKw` 只用 `pump_power_kw`。
2. 排熱倍率改為 `1 + 1 / COP_design`，COP 取選定冰機（`water_cooled_chiller` / `trim_chiller` 的 catalog `cop`）；找不到時用既有 `A('tower_heat_rejection_factor')`（= 1.2）。
3. 年度模擬：`pumpTable`（`js/simulation/annual_runner.js:136-160`）的 `cduPrimaryPumpKw` 與 `fwPmpKw` 各自加上 CW 泵功率（CW 泵與冷卻塔同步變頻：`cw_pump_power_kw × max(泵最低轉速, loadRatio)³`，最低轉速沿用 `FreeCoolingEngine.getPumpMinSpeed(mode)`）。
4. 若架構需要 CW 泵（`flags.isWaterChiller` 或 `id === 'water_cooled_chiller'`），在該架構 `equipment` 清單新增 `cw_pump` 選型項（role `pump`、catalog `pump`、`requiredKw: ctx => ctx.cwPumpKw`），讓 Step 4 看得到、可選型號。
5. 用架構 id 或新 flag `needsCwPump: true` 判斷，不要用 `flags.consumesWater`（絕熱塔/閉式塔也耗水但沒有 CW 泵）。

**驗收**：`water_chiller` 架構下 `cdu_pump.requiredKw` 等於不含 CW 泵的水力功率；年度總泵耗與 Round 6 差 < 1%（只是搬家 + COP 倍率修正）。

### Task R7-0c：已知簡化，記錄即可（不改程式，只在 `assumptions.js` 註解 / 本文件標註）

- `engines_chiller.js` 的 `fixed` 分支：水冷螺旋機（`23XRV`、`RTHD`、`RTWD`）被對映到 `centrifugal_standard` 曲線，應為 `screw_standard`。**請修正**：`cat.includes('screw')` 且非氣冷 → `screw_standard`（**預期有差異**，屬於修正，獨立 commit `R7-0c`）。
- `fixed` 分支在 CHWS 超出曲線範圍（水冷 preset 上限 14 °C，Trim 冰機實際 30 °C）時直接截斷、沒有 Carnot 外推修正；目前偏保守，**本輪不改**，在程式碼加 `// KNOWN: 超出 t_chws_range 時截斷，偏保守` 註解。

---

## Phase I — 中文 / English 切換

### 設計原則

- **語言是瀏覽者偏好，不是專案資料**：存 `localStorage['pue_lang']`，不寫入專案 JSON；同一份專案檔，中文使用者與英文使用者各自看自己的語言。
- 預設 `zh-TW`；`navigator.language` 以 `en` 開頭且 localStorage 無值時預設 `en`。
- **資料鍵值不翻譯**：`BUILTIN_WEATHER_DATA` 的城市 key（如 `'桃園 (Taoyuan Pilot)'`）、設備型號名稱、使用者輸入的 Hall/DU 名稱一律原樣顯示。城市在英文模式下顯示 `stationInfo.location`（已是英文）。
- 數值與單位格式不變（`°C`、`kW`、`MWh`、`L/kWh`）。

### Task I-1：i18n 基礎建設

1. 新增 `DCC/js/i18n.js`，在 `index.html` 中緊接 `assumptions.js` 之後載入（引擎的警告訊息也要用到），同步更新 `harness.js` `FILES`。
   ```js
   const I18N = {
     lang: 'zh-TW',
     dict: { 'zh-TW': {}, en: {} },          // 由 i18n_zh.js / i18n_en.js 填入
     t(key, params) { ... },                  // 找不到 → 先找 zh-TW → 再回傳 key 本身，並 console.warn 一次
     setLang(lang) { ... },                   // 存 localStorage、設 document.documentElement.lang、呼叫 applyStatic、觸發 listeners
     applyStatic(root = document) { ... },    // 掃描 [data-i18n] / [data-i18n-title] / [data-i18n-placeholder]
     onChange(fn) { ... }
   };
   ```
   參數插值格式：`t('step4.deficitMsg', { n: 3 })` 對應字串 `'尚有 {n} 項設備容量未達 {redundancy} 規範'`。
2. 字典拆檔：`DCC/js/i18n_zh.js`、`DCC/js/i18n_en.js`（各自 `I18N.dict['zh-TW'] = {...}`），載入順序 `i18n.js → i18n_zh.js → i18n_en.js`。
3. Node 測試環境（`harness.js`）也要能載入；`I18N` 不存在時所有呼叫端必須有 fallback（引擎內用 `(root.I18N ? root.I18N.t(k, p) : 中文原文)`）。
4. `index.html` header 加切換鈕（放在「儲存 / 開啟 / 重置」按鈕群旁）：`中 / EN` 分段按鈕，目前語言高亮。
5. `app.js`：`I18N.onChange(() => { this.renderStep(this.currentStep); this.updateStickyBar(); I18N.applyStatic(); })`。

**驗收（新增 unit test）**：
- `Object.keys(dict['zh-TW'])` 與 `Object.keys(dict.en)` 集合完全相同、無空字串。
- `t('不存在的key')` 回傳 key 本身且不丟例外。

### Task I-2 ~ I-6：逐區塊抽字串

約 1,600 行含中文的 UI 程式需處理，依下表拆 Task，每個 Task 一個 commit：

| Task | 範圍 | 檔案 | 注意事項 |
|---|---|---|---|
| I-2 | 頁首、步驟導航、sticky KPI 列、footer | `index.html`、`app.js` | 靜態 HTML 用 `data-i18n` 屬性 |
| I-3 | Step 1 氣象、Step 2 Hall/DU/SU、Step 3 CorePOD | `view_weather.js`、`view_hall_su.js`、`view_corepod.js` | `alert()` / `confirm()` / `prompt()` 文字也要翻 |
| I-4 | Step 4 冷卻選型 + 架構描述檔 + 拓樸圖 | `view_cooling.js`、`cooling/archs/*.js`、`views/schematics/*.js`、`sizing/sizing_engine.js`（`requiredText`、`validateCdu/Fw` 的 checks 文字） | 架構描述檔的 `optionLabel/cardLabel/pillLabel/dashboardLabel`、`equipment[].label`、`topology()` 回傳的 `title/lines/banners` 全部改成 `t()`；**`topology()` 每次呼叫時才取字串**（不要在 register 時就固定成某語言） |
| I-5 | Step 5 Dashboard、圖表標籤與 tooltip | `view_dashboard.js`、`ui_kit.js` | Chart.js 的 `labels`、`datasets[].label`、軸標題 |
| I-6 | 引擎警告與假設表 | `engines_*.js`、`cooling/stages/*.js`、`store.js`、`assumptions.js` | 警告物件保留 `code`，`message` 改由 `t('warn.' + code, params)` 產生；`ASSUMPTIONS` 每筆新增 `label_en`，顯示時依語言選 `label` / `label_en`（`ref` 不翻） |

**每個 Task 的驗收**：
- 用 `tools/pue_regression/dom_harness.js` 的 `buildWindow()` 設 `I18N.setLang('en')` 後渲染該 Task 範圍的 Step，掃描 `container.innerHTML` 的 CJK 字元（`/[㐀-鿿]/`）。
  **允許清單**：先把「所有 catalog 型號名稱、`BUILTIN_WEATHER_DATA` 城市 key、使用者資料（Hall/DU/SU/CorePOD 名稱）」從字串中移除再掃描。殘留 CJK 數必須為 0。
- 切回 `zh-TW` 後的 `ui_snapshot` 與 `ui_snapshot_after_R6.json` 一致（不能因抽字串改到中文原文）。
- `run.js --compare baseline_after_R6.json`（R7-0 之後改比對 R7-0 完成時另存的 `baseline_after_R7_0.json`）零差異——翻譯不得改到任何數值。

### Task I-7：Excel 計算書雙語

1. 匯出按鈕旁加「匯出語言」下拉（預設 = 目前 UI 語言）。
2. `excel_export.js` 所有工作表名稱、表頭、說明文字改走 `t()`，並在匯出期間暫時切換 `I18N.lang`（匯出完還原，不觸發 re-render）。
3. 工作表名稱 31 字元上限、不可含 `[]:*?/\`，英文名稱見附錄 B。
4. 驗收：中英各匯出一次（Node 可用 `exceljs` 直接跑匯出函式），英文版所有 sheet 的儲存格文字經允許清單過濾後無 CJK；兩版數值儲存格逐格相等。

---

## Phase P — 冷卻系統分組（共用系統、N+X 冗餘）

### 現況

- 每個 DU / CorePOD 的 `plantDesign` 各自擁有完整 `cduSystem`（液冷）與 `fanwallSystem`（氣冷），`AnnualRunner.run()`（`js/simulation/annual_runner.js:445-687`）逐單元獨立模擬。
- 冗餘寫死 N+1：`runningQtyFromSelected = qty - 1`（`store.js:1109`）、`effectiveCapKw = (qty - 1) × cap × derate`（`sizing_engine.js:171, 231`）。`migrateProject` 已預留 `s.redundancy = 'N+1'` 欄位但沒人讀。
- Step 3 CorePOD 有「獨立 Utility / 共用全廠冷水」切換鈕（`view_corepod.js:84-85`，`topologyMode: 'dedicated' | 'shared_plant'`），**計算端完全沒讀取，是死開關**。

### 工程模型（請完全照此實作）

把每套冷卻系統的設備分成兩類（依架構描述檔 `equipment[].role`）：

| 類別 | role | 例 | 歸屬 |
|---|---|---|---|
| **終端設備** | `terminal` | `cdu_unit`、`crah_unit`、`rdhx_unit` | **永遠留在各 DU / CorePOD**（設備實體就在該機房內） |
| **主機房設備** | `chiller`、`heat_rejection`、`tower`、`pump`、`hx`、`decoupler` 等其餘 | 冰機、乾冷器、冷卻塔、絕熱塔、板換、一次側泵、CW 泵 | **歸屬冷卻系統群組（Cooling Plant）** |

液冷迴路與氣冷迴路**可以分開分組**（例：整場氣冷共用一套冰水主機，液冷每兩個 DU 一套乾冷器）。

### Task P-1：資料模型與遷移（schema v7）

1. `state.coolingPlants = []`，每筆：
   ```js
   {
     id: 'plant_xxxxxxxx',
     name: '液冷系統 A',
     loop: 'liquid' | 'air',
     memberIds: ['du_...', 'corepod_...'],
     system: { /* 與現行 cduSystem 或 fanwallSystem 同結構：architecture、溫度參數、架構 params、sizing（只含主機房設備）、hydraulics、designBasis、validation */ },
     redundancy: 'N+1',          // 群組預設冗餘，套用到主機房設備
     diversityFactor: 1.0        // 同時使用係數，選型需求 = Σ成員負載 × diversityFactor（0.5–1.0）
   }
   ```
2. 成員單元的 `plantDesign.cduSystem.plantId` / `plantDesign.fanwallSystem.plantId`：
   - `undefined` 或 `null` → **獨立系統（現行路徑，完全不動）**。
   - 有值 → 屬於該共用群組；此時該單元 `cduSystem.sizing` 只保留終端設備項目，架構與溫度參數以群組 `system` 為準（單元上的同名欄位在計算時被群組值覆蓋，UI 顯示為唯讀並標「由 ○○ 系統統一設定」）。
3. **一個單元的每個 loop 最多屬於一個群組**；群組至少 2 個成員才有意義（UI 允許 1 個成員但提示）。
4. `migrateProject`：
   - schema v6 → v7：`coolingPlants = []`，所有單元維持獨立（零差異）。
   - CorePOD `topologyMode === 'shared_plant'` 的舊專案：**不自動建群組**，改在載入後於 Step 4 顯示一次性提示「此 CorePOD 原設定為共用全廠冷水，請在冷卻系統分組中指定」（避免猜錯）。
   - `topologyMode` 欄位保留只讀相容，Step 3 的切換鈕改為：選「共用」時直接開啟 Step 4 分組面板並預選該 CorePOD 的氣冷 loop。
5. `serializeProject` / `deserializeProject` 加入 `coolingPlants`，`schemaVersion: 'v7'`。

**零差異關卡**：P-1 完成後 `run.js --compare` 必須零差異（沒有任何專案有群組）。

### Task P-2：冗餘等級 N / N+1 / N+2 / 2N

1. 每個 sizing item 讀 `s.redundancy`（預設 `'N+1'`，群組內主機房設備預設繼承群組 `redundancy`，可個別覆寫）。
2. 新增共用函式（放 `sizing_engine.js`，store 透過它計算，**取代**寫死的 `qty - 1`）：
   ```js
   standbyUnits(qty, redundancy) // 'N' → 0；'N+1' → 1；'N+2' → 2；'2N' → Math.ceil(qty / 2)
   runningQty(qty, redundancy)   // = max(1, qty - standbyUnits)
   requiredQty(reqKw, unitCapKw, derate, redundancy)
     // N/N+1/N+2: ceil(reqKw / (unitCapKw × derate)) + standby
     // 2N:        2 × ceil(reqKw / (unitCapKw × derate))
   ```
   `effectiveCapKw = runningQty × unitCapKw × derate`，`passed = effectiveCapKw >= requiredKw && qty >= requiredQty 的最小台數規則`。
   `requiredText` 文字改為 `需求 ≥ X kW（N+2 最少 Y 台）` 依實際冗餘顯示（i18n key）。
3. **運轉策略** `s.runMode: 'standby' | 'share'`（預設 `'standby'` = 現行行為，備援機停機）：
   - `'share'`（多台分攤，常用於 CRAH/Fan wall、乾冷器、冷卻塔風扇）：所有台數都運轉、各台負載率 = 需求 / 全部台數容量，套用三次方親和律後能耗較低。模擬時 `qty_running = qty`。
   - 冰機一律 `'standby'`（UI 不提供 share）。
4. `resolveChillerFromSizing / resolvePumpFromSizing / resolveCduFromSizing / resolveCrahFromSizing / resolveTowerFromSizing`（`store.js` 1131-1215）改用 `runningQty(item.selectedQty, item.redundancy)` 與 `runMode`。
5. `canProceedStep4` 錯誤訊息、Step 4 燈號文字「滿足 N+1」改成依冗餘等級顯示。

**零差異關卡**：所有 item 預設 `'N+1'` + `'standby'`，`run.js --compare` 零差異。
**新增測試**：N+2 時 5 台 × 300 kW 的有效容量 = 900 kW；2N 時 4 台有效 = 600 kW；`share` 模式 CRAH 3 台運轉的風機功率 < `standby` 模式 2 台運轉。

### Task P-3：群組計算引擎

在 `AnnualRunner.run()` 中：

1. 先處理所有**獨立**單元的 loop（現行 `simulateUnit` 路徑，不動）。
2. 對每個共用群組 `G`（依 `G.loop`）：
   - `Q_G(h) = Σ 成員該 loop 熱負載`（液冷 = `liquidHeatKw`；氣冷 = `airHeatKw + lossKw`）。
   - **終端設備**：每個成員各自計算（`CDUEngine.calcPower(成員的 cdu_unit, 成員 liquidHeatKw)`、`CRAHEngine.calcPower(...)`），算法與現行完全相同。
   - **主機房設備**：以 `G.system`、`resolveEquipment(archDesc, G.system)`（只含主機房設備）、`Q_kw = Q_G`、`loadRatio = Q_G / G.system.designBasis.load_kw` 呼叫 `archDesc.simulateHour(...)`；一次側泵水力用合併流量 `Σ流量`、群組揚程 `G.system.pumpHeadM`。
   - 需把現行 `AppStore.calcHourlyEnergy()`（`store.js:1247-1451`）拆成 `calcLiquidLoopHour(...)` 與 `calcAirLoopHour(...)` 兩個函式，`calcHourlyEnergy` 保留為兩者的組合包裝（**既有呼叫端與測試不改**）。
3. **能耗分攤到各成員**（讓每個 DU 仍有自己的 PUE）：
   - 主機房能耗（冰機、排熱風扇、一次側泵、CW 泵）與耗水，逐時依熱負載比例分攤：`share_i = Q_i / Q_G`。
   - 終端能耗直接歸該成員。
   - `byDu[]` / `byCorePod[]` 每筆新增 `liquidPlantId`、`airPlantId`、`allocatedPlantMwh`；`overall` 新增 `byPlant[]`：`{ id, name, loop, memberIds, annualMwh: {chiller, heatRej, pump}, waterM3, modeHours, deficitHours, peakLoadKw }`。
   - **守恆檢查**：`Σ 成員分攤 = 群組總能耗`（誤差 < 1e-6），寫進 `energyLedger`。
4. 自然冷卻模式時數、deficit 時數：成員繼承所屬群組的值。
5. 群組選型（`bridgeDuToPlantModel` 之外新增 `bridgePlantModel(G)`）：
   - `requiredKw = Σ 成員負載 × G.diversityFactor`。
   - `designBasis`、`hydraulics`、sizing 生成與評估流程與單元版相同，只是輸入換成合計值。
   - 若成員負載為 0 或成員被刪除 → 自動從 `memberIds` 移除；群組空了 → 標示「空系統」不參與計算。

**驗收（新增測試）**：
- **一致性**：把預設專案唯一的 DU 單獨建一個群組（1 成員），主機房設備台數與獨立時相同 → 年度 PUE 與獨立模式相同（誤差 < 0.001）。
- **合併效益**：兩個相同 DU 合併成一群組，`N+1` 下主機房設備總台數 ≤ 兩套獨立的總台數；全年 PUE ≤ 兩套獨立（因部分負載效率與備援台數減少）。若較高，測試失敗並印出分項。
- 守恆：`Σ byDu.annualTotalMwh + Σ byCorePod.annualTotalMwh = overall.annualTotalMwh`。

### Task P-4：Step 4 分組 UI

在 Step 4 頂部（現在的「全廠冷卻單元即時狀態總覽」上方）新增 **「冷卻系統分組」面板**：

```
┌ 冷卻系統分組 ─────────────────────────────────────────────────────┐
│ 快速配置： [每個單元獨立] [整場共用一套] [依 Hall 分組] [自訂…]          │
│                                                                    │
│ 液冷迴路                        │ 氣冷迴路                          │
│ ● 液冷系統 A  N+2  4 成員  ▸    │ ● 氣冷系統 A  N+1  5 成員  ▸      │
│   DU-01 ✓ DU-02 ✓ DU-03 ✓ POD ✓ │   (全部成員)                      │
│ ● DU-04（獨立）                 │                                   │
│ [+ 新增液冷系統]                │ [+ 新增氣冷系統]                  │
└────────────────────────────────────────────────────────────────────┘
```

1. 每個群組：名稱（可改）、冗餘等級下拉（N / N+1 / N+2 / 2N）、同時使用係數、成員勾選清單（只列出該 loop 有負載的單元；已屬於別的群組者顯示所屬群組並可移轉）。
2. 快速配置按鈕：
   - **每個單元獨立**：清空 `coolingPlants`（= 現行行為）。
   - **整場共用一套**：液冷、氣冷各建一個群組，包含所有有負載的單元；架構與溫度取液冷負載最大單元的設定。
   - **依 Hall 分組**：每個 Hall 一組；CorePOD 預設併入其 `supportsHallIds[0]` 對應的 Hall 群組。
3. 單元卡片：屬於群組的 loop，只顯示「終端設備選型」（CDU / CRAH 台數型號），主機房設備區塊改為一行連結「由 ○○ 系統供冷 → 前往」。
4. 每個群組有自己的展開卡片：架構選擇、溫度參數、主機房設備選型表（沿用 `renderExpandedUnitCard` 中液冷 / 氣冷那半邊的渲染函式，抽成 `renderPlantSystemSection(sys, targetId, loop)` 共用）、拓樸圖（同現有 schematics，負載用群組合計）。
5. 溫度相容性檢查：成員的 `secSupplyC`（晶片進水要求）若低於群組 `fwsSupplyC + cduApproachC` 可達的溫度 → 該成員紅燈「晶片進水溫度無法滿足」。
6. `canProceedStep4` 同時檢查群組主機房設備與各成員終端設備。
7. Step 4 標題由「逐 DU 雙冷卻系統」改為「冷卻系統設計」（i18n key）。

### Task P-5：Dashboard 與 Excel

1. Dashboard 新增「冷卻系統」分頁：`byPlant[]` 表格（系統、迴路、成員、冗餘、主機房年耗電分項、WUE、自然冷卻時數）。
2. 逐 DU 表格新增「供冷系統」欄。
3. Excel 第 5 張（逐 DU 冷卻系統設計）改為：先列各共用群組（主機房設備選型 + 冗餘 + 合計負載），再列各單元終端設備；新增分攤說明列「主機房能耗依熱負載比例分攤」。

---

## Phase S — 設計方案比較

### Task S-1：方案資料模型

1. `state.scenarios = [{ id, name, note, createdAt, snapshot, resultSummary }]`，`state.activeScenarioId`。
2. `snapshot` 只包含**冷卻設計**：`coolingPlants` + 每個單元的 `plantDesign`（深拷貝）+ `facilityElectricalLossPct`。IT 負載、氣象、Hall/DU/SU 內容**不屬於方案**（比較時所有方案共用同一份 IT 與氣象，才是公平比較）。
3. 操作：
   - 「把目前設計存成方案」、「複製方案」、「切換到此方案」（把 snapshot 套回 state 並 `calculate()`）、「刪除」、「改名 / 備註」。
   - 切換方案前若目前設計有未存的變更 → `confirm` 提示是否先存回目前方案。
4. 方案數上限 8；隨專案檔存檔（schema v7 一併處理）。

### Task S-2：比較計算與畫面

1. `AppStore.evaluateScenario(scenario)`：深拷貝目前 state → 套 snapshot → `AnnualRunner.run()` → 回傳摘要；**不得修改目前 state**。結果快取在 `resultSummary`，並記錄 `inputHash`（IT 負載 + 氣象 station + snapshot 的 JSON hash）；hash 不同時顯示「需重新計算」。
2. Step 5 Dashboard 新增「方案比較」分頁：
   - 表格欄位：方案名稱、冷卻分組摘要（例「液冷 2 套 N+2 / 氣冷 1 套 N+1」）、年 PUE、pPUE、尖峰 PUE、WUE、年總耗電 MWh、冰機 / 排熱風扇 / 泵+CDU / CRAH / 電損 MWh、主機房設備總台數（冰機、乾冷器/冷卻塔、泵）、容量不足時數。
   - 第一個方案為基準，其餘每格顯示差值（▲紅 / ▼綠）。
   - 堆疊長條圖：各方案年耗電分項。
   - 「全部重新計算」按鈕（逐一計算，顯示進度；8 個方案 × 預設專案應 < 5 秒）。
3. Excel 新增工作表「11.方案比較」，內容同上表。

**驗收**：
- 建兩個方案（A：每單元獨立；B：整場共用 N+2），切換 A → B → A 後 `calculate()` 結果與第一次 A 完全相同（snapshot 套用無殘留）。
- `evaluateScenario` 前後 `JSON.stringify(AppStore.state)` 不變（除了 `scenarios[].resultSummary`）。

---

## Phase T — DU 模組範本

### 使用情境

模組化資料中心中大量 DU 的 IT 配置相同（例如每個 DU = 4 × NVL72 + 網通）。設計師只想設計一次，然後「套用」到其他 DU，日後改範本可一鍵同步。

### Task T-1：範本資料模型

```js
state.templates = [{
  id: 'tpl_xxxxxxxx',
  kind: 'du' | 'corepod',
  name: 'NVL72 × 4 標準 DU',
  version: 3,                 // 每次「更新範本」+1
  updatedAt: '...',
  content: {
    sus: [...],               // DU：SU 與設備清單（深拷貝，id 於套用時重新產生）
    equipment: [...],         // CorePOD：設備清單
    terminalDesign: {         // 選填：終端設備選型（CDU / CRAH 型號與冗餘），不含主機房設備
      cdu_unit: { model, redundancy, runMode },
      crah_unit: { model, redundancy, runMode }
    }
  }
}]
```
單元新增 `templateRef: { id, version, linked: true|false }`。

### Task T-2：Step 2 / Step 3 操作

1. DU 卡片標題列新增按鈕：
   - **💾 存為範本**：以此 DU 的 SU/設備（+ 可勾選是否包含終端設備選型）建立新範本。
   - **📥 套用範本**：選範本 → 覆寫此 DU 的 SU/設備，設 `templateRef.linked = true`。
2. Hall 工具列新增 **「從範本批次新增 DU」**：選範本 + 數量 N + 命名規則（預設 `DU-{nn}` 接續現有編號）→ 一次建立 N 個 linked DU。
3. **連結狀態**：
   - linked DU 的 SU/設備區顯示「🔗 範本：NVL72 × 4 標準 DU v3」，**設備表唯讀**；按「解除連結」後才能個別編輯（`linked = false`，保留目前內容）。
   - 範本有新版本（`template.version > templateRef.version`）時，DU 顯示「範本已更新 → 同步」按鈕；Hall 工具列顯示「N 個 DU 可同步」+「全部同步」。
4. **更新範本**：在任何一個 linked DU 上按「解除連結 → 編輯 → 回寫範本」，或在範本管理面板直接以某 DU 覆寫範本 → version + 1 → 詢問「是否同步所有連結此範本的 N 個 DU？」。
5. **範本管理面板**（Step 2 右上「📚 範本庫」）：列出範本、使用中數量、改名、刪除（使用中時先確認，刪除後實例自動 `linked = false`）。
6. CorePOD 同樣支援（Step 3），`kind: 'corepod'`。

### Task T-3：跨專案重用

1. 範本隨專案檔存檔。
2. 範本庫面板提供「匯出範本 (.json)」與「匯入範本」：匯入時 id 衝突則產生新 id，名稱重複加「(匯入)」。
3. 匯出格式：`{ format: 'pue-template', schemaVersion: 1, templates: [...] }`。

**驗收（新增測試）**：
- 從範本批次新增 5 個 DU → 每個 DU 的 IT 負載與範本相同、所有 SU/設備 id 唯一。
- 更新範本 + 全部同步 → 所有 linked DU 內容更新、unlinked DU 不變。
- 套用範本後 `calculate()` 的 IT 總量 = 原 IT + 新 DU 數 × 範本 IT。
- 範本包含終端設備選型時，新 DU 的 `cdu_unit.selectedModel` 等於範本設定，`selectedQty` 依新 DU 負載重新計算（`userEdited = false`）。

---

## 執行順序與 commit 清單

| # | Task | 預期 `run.js` 差異 | 關卡 |
|---|---|---|---|
| 1 | S-0 存基準 | — | — |
| 2 | R7-0a 預設台數含降額 | 有（CDU 台數） | 另存 `baseline_after_R7_0.json` 於 #4 之後 |
| 3 | R7-0b CW 泵分離 | 小（< 1% 泵耗） | — |
| 4 | R7-0c 水冷螺旋機曲線 | 有（水冷冰機耗電） | 完成後存 `baseline_after_R7_0.json` |
| 5 | I-1 i18n 基礎 | 零 | — |
| 6–10 | I-2 ~ I-6 抽字串 | 零 | 英文模式 CJK 殘留 0 |
| 11 | I-7 Excel 雙語 | 零 | 中英數值逐格相等 |
| 12 | P-1 資料模型 v7 | 零 | — |
| 13 | P-2 冗餘 N+X | 零 | — |
| 14 | P-3 群組計算引擎 | 零（無群組時） | 一致性 / 合併效益 / 守恆測試 |
| 15 | P-4 Step 4 分組 UI | 零 | dom_harness 渲染無錯誤 |
| 16 | P-5 Dashboard / Excel | 零 | — |
| 17 | S-1 方案模型 | 零 | — |
| 18 | S-2 方案比較 | 零 | 切換無殘留 |
| 19 | T-1 範本模型 | 零 | — |
| 20 | T-2 Step 2/3 操作 | 零 | — |
| 21 | T-3 匯入匯出 | 零 | — |
| 22 | 最終報告 | — | 見下 |

**最終報告**（寫在 `DCC/pue_round7_report.md`，不 commit 到 dist）：
1. `unit_checks.js` 通過數。
2. 預設專案與 `projects/PUE_Project_高雄 (Kaohsiung)_20260901.json` 在 R7-0 前後的 PUE / 分項。
3. 示範：高雄存檔專案三個方案（每單元獨立 / 整場共用 N+2 / Hall 分組 N+1）的比較表。
4. 英文模式 CJK 殘留掃描結果。
5. 未完成或偏離本計畫之處，逐條說明原因。

---

## 附錄 A：關鍵程式位置（HEAD `ebcd8b5`）

| 項目 | 位置 |
|---|---|
| 初始 sizing 台數 | `js/sizing/sizing_engine.js` `_createSizingItem`（約 23-71 行） |
| N+1 有效容量 | `js/sizing/sizing_engine.js` 約 171、231 行 |
| 運轉台數 | `js/store.js` `runningQtyFromSelected`（約 1109 行） |
| 設備解析 | `js/store.js` `resolve*FromSizing` / `resolveEquipment`（約 1131-1250 行） |
| 逐時能耗 | `js/store.js` `calcHourlyEnergy`（約 1247-1451 行） |
| 水力與選型橋接 | `js/store.js` `bridgeDuToPlantModel`（約 1560 行起） |
| 年度模擬 | `js/simulation/annual_runner.js` `simulateUnit`（49-254）、`run`（445-687） |
| Step 4 畫面 | `js/views/view_cooling.js` `render`（16-239）、`renderExpandedUnitCard`（353 起） |
| CorePOD 共用切換（死開關） | `js/views/view_corepod.js:84-85`、`js/store.js:145, 659` |
| DU 複製 | `js/store.js` `copyDU`（約 817 行）、`js/views/view_hall_su.js:143, 285` |
| 專案存讀 / 遷移 | `js/store.js` `serializeProject`（209）、`migrateProject`（229）、`deserializeProject`（321） |
| 腳本載入順序 | `index.html:151-199`、`tools/pue_regression/harness.js` `FILES` |

## 附錄 B：英文術語詞彙表（翻譯一律依此）

| 中文 | English |
|---|---|
| 案場氣象 | Site Weather |
| 機房 / Hall | Data Hall |
| 部署單元 DU / 算力單元 SU | Deployment Unit (DU) / Scalable Unit (SU) |
| 核心機房 CorePOD | Core POD |
| 冷卻系統設計 | Cooling System Design |
| 冷卻系統分組 | Cooling Plant Grouping |
| 液冷迴路 / 氣冷迴路 | Liquid Loop / Air Loop |
| 共用冷卻系統 / 獨立系統 | Shared Cooling Plant / Dedicated Plant |
| 終端設備 / 主機房設備 | Terminal Equipment / Central Plant Equipment |
| 冗餘 | Redundancy |
| 同時使用係數 | Diversity Factor |
| 備援停機 / 多台分攤 | Standby / Load Sharing |
| 自然冷卻 / 部分預冷 / 全機械製冷 | Free Cooling / Partial Economization / Full Mechanical |
| 乾冷器 / 絕熱冷卻塔 / 閉式冷卻塔 / 開式冷卻塔 | Dry Cooler / Adiabatic Cooler / Closed-Circuit Cooling Tower / Open Cooling Tower |
| 冰水主機（氣冷 / 水冷） | Chiller (Air-Cooled / Water-Cooled) |
| 板式熱交換器 | Plate Heat Exchanger (PHE) |
| 一次側 / 二次側 | Primary / Secondary (Facility Water System / Technology Cooling System) |
| 冷卻水泵 | Condenser Water Pump |
| 趨近溫度 | Approach Temperature |
| 降額 | Derating |
| 容量不足 | Capacity Deficit |
| 電力損耗 | Electrical Losses |
| 耗水 | Water Usage (WUE) |
| 方案比較 | Scenario Comparison |
| 範本 / 套用範本 / 同步 | Template / Apply Template / Sync |

Excel 工作表英文名稱（≤ 31 字元，對應 `excel_export.js` 現有 10 張 + 本輪新增）：

| 現有中文名稱 | English |
|---|---|
| 1.封面與專案資訊 | 1.Cover & Project Info |
| 2.設計基準與假設 | 2.Design Basis & Assumptions |
| 3.氣象與自由冷卻分析 | 3.Weather & Free Cooling |
| 4.IT負載明細 | 4.IT Load Schedule |
| 5.逐DU冷卻系統設計（本輪改為「5.冷卻系統設計」） | 5.Cooling System Design |
| 6.能耗與PUE-WUE計算 | 6.Energy & PUE-WUE |
| 7.月度趨勢 | 7.Monthly Trend |
| 8.尖峰工況分析 | 8.Peak Condition Analysis |
| 9.全廠總表與結論 | 9.Site Summary & Conclusion |
| 10.附錄-最熱日24h明細 | 10.Appx-Hottest Day 24h |
| （新增）11.方案比較 | 11.Scenario Comparison |
