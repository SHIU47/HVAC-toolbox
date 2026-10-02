# PUE 計算系統 — Phase 4（Step 4）拓樸與架構第二輪修正計畫

- 前一份計畫：`PUE_Calc_Audit_and_Refactor_Plan.md`（A-1 ~ D-3 已由執行者完成，分支 `pue-audit-fixes`，HEAD `9ab1c06`）
- 本文件審查者：Claude Opus 5.5（2026-10-02）
- 執行者：Antigravity（照本文件逐項執行）
- 範圍：Step 4「逐 DU 雙冷卻系統」的 **拓樸圖（P&ID SVG）**、**拓樸與計算的一致性**、**架構描述檔的可擴充性**

---

## 0. 執行守則（必讀）

1. **只動這些路徑**：`public/Data center Cal/**`、`tools/pue_regression/**`、本文件。不要動 `dist/`、不要跑 `build.js`、不要部署、不要 push。
2. 在現有分支 `pue-audit-fixes` 上接著做。**一個任務一個 commit**，訊息以任務編號開頭（例：`T-2: PHE presence drives both calc and schematic`）。不要 `git add -A`，只 add 自己改的檔案。
3. 開工前先跑：
   ```
   cd tools/pue_regression
   node run.js --save baseline_after_D.json
   node ui_snapshot.js --save ui_snapshot_after_D.json
   ```
   並 commit 這兩個檔案（任務 `S-0`）。之後所有比對都以它們為基準。
4. 每個任務的「允許變動」欄寫明可以變什麼：
   - **0 差異**：`node run.js --compare baseline_after_D.json` 必須 `No differences`，`node ui_snapshot.js --compare ui_snapshot_after_D.json --mode full` 必須 `No UI differences`。
   - **數值可變**：在 commit 內文貼出 7 城市預設組合（`dry_cooler_trim / air_cooled_chiller`）的 PUE / WUE / 冰機 MWh / 自然冷卻小時「前 → 後」，方向必須符合該任務的「預期影響」。不符合就停下來回報，**不要調參數讓它符合**。
   - **拓樸圖可變**：必須跑 §6 的 `topo_preview.js` 產出全部 9 張截圖，逐張目視確認本文件該任務列出的每一條驗收項，並在 commit 內文逐條寫「✓ 已確認」。
5. 新常數一律放 `js/assumptions.js`（附 `label`、`ref`），用 `A('key')` 取值。
6. 公式照本文件寫，本文件沒給的數字不要自己發明。
7. 執行順序：**S → P1 → P2 → P3 → P4**，同一 Phase 內照編號順序。
8. §7「需東旭決定」的項目，先照「預設做法」執行，最後回報中列出。

---

## 1. 上一輪（A-1 ~ D-3）驗收結果

### 1.1 已確認正確完成
- 回歸工具全部可跑：`unit_checks.js` 76/76 通過；`run.js --compare baseline_after_B.json` 140 組 0 差異；UI 完整快照 0 差異。
- 計算修正 B-1 ~ B-13 皆有落實：AHRI 正規化、Carnot 揚程修正、串聯經濟器公式、Trim 冰機工況、Fanwall 自然冷卻門檻、降額選型、損失熱、耗水公式。
- 架構登錄表、9 個架構描述檔、schema v5 遷移都已建立。

### 1.2 未完成或做歪的部分（本文件要處理的）

| # | 問題 | 位置 |
|---|---|---|
| R-a | 「階段鏈」沒有真的實作。`stage_dry_cooler.js` 內含 `isTrimMode` 分支（Trim 架構的邏輯塞進了乾冷器階段）、`stage_evap_tower.js` 內含 `isCondenserRejection` 分支；沒有通用的 chain runner。新增「絕熱塔 + Trim」仍然要手寫新程式。 | `cooling/stages/*.js` |
| R-b | 架構描述檔沒有 `equipment` 清單。`sizing_engine.js` 仍是 9 段 `if (arch === ...)`；`store.js:1136-1188` 每小時用寫死的 key 找設備（`fwUnitKey = fwArch === 'rdhx' ? ...`）。 | `sizing/sizing_engine.js:76-294`、`store.js:1136-1188` |
| R-c | 架構字串比對仍有 34 處散在 view / schematic / store。 | 見 §5 R-4 清單 |
| R-d | M8（逐時迴圈外預先解析設備）沒做。實測 1 DU + 1 Pod = 267 ms、10 DU + 1 Pod = 1289 ms，每次改一個欄位就同步重算，50 DU 會卡 6 秒以上。 | `store.js:1080-1292` |
| R-e | `getEffectiveFcThresholds` 仍在（P1-6 要求刪除），而且用的是錯誤的 Mode 2 = Mode 1 + 5.7 邏輯。 | `store.js:1297-1320` |
| R-f | D5 警示（全額水冷冰機在高 FWS 下應改用經濟器）沒有實作。 | `sizing/sizing_engine.js` validateCdu |

---

## 2. 拓樸圖問題（實際渲染截圖審查）

以高雄氣象、預設 DU（FWS 42/54°C、晶片側 45/57°C）渲染 5 種 CDU 架構與 4 種 Fanwall 架構，逐張審查。

### T-1　`series_trim`（乾冷器 + Trim 冰機）— 圖在設計點畫的是「Trim 不運轉」

- **現象**：拓樸圖用 0.4% 設計乾球（高雄 34°C）算工況。此時 `T_avail = 34+5+2 = 41 ≤ FWS 42`，串聯經濟器判定 **100% 自然冷卻**，冰機負擔 0。但圖上照樣畫冰機出 30°C、回 35°C、冷凝器 51°C，Primary HX「預冷至 42°C」、Secondary HX「修整至 42°C」——整張圖在描述一個不存在的修整工況。
- **Mode 橫幅門檻錯**：圖上寫「Mode 2 串聯修整 (≤40.7°C)」、「Mode 3 全機械製冷 (>40.7°C)」，用的是舊的 `Mode1 + 5.7` 偏移（`assumptions.js` 的 `nvidia_dsx_mode2_offset_c`）。修正後的引擎邏輯是：
  - Mode 1（全自然冷卻）：`DB ≤ T1 = FWS供 − 乾冷器approach − PHE approach`（= 35°C）
  - Mode 2（串聯修整）：`T1 < DB < T3`
  - Mode 3（乾冷器完全無法預冷，冰機扛 100%）：`DB ≥ T3 = FWS回 − 乾冷器approach − PHE approach`（= 47°C）

  實測高雄、菲律賓、Alabama 全年 **0 小時** 進入引擎的 Mode 3，但橫幅寫 >40.7°C 就是 Mode 3。**圖與計算矛盾。**
- **Mode 3 說明錯**：「全額走 Trim 冰機製冷」——Mode 3 時乾冷器仍在運轉（排放冷凝熱），只是不再預冷 FWS。
- **冷凝器出水溫**用型錄 COP 算，不是用該工況模擬出的 COP。

### T-2　`single_loop`（純乾冷器 / 絕熱塔 / 閉式塔 / 全額水冷冰機）— 圖上的設備與計算不一致

| 架構 | 圖上畫的 | 計算實際做的 | 問題 |
|---|---|---|---|
| 純乾冷器 | CDU → **PHE-1** → **Condenser Pump** → 乾冷器 | `hx_approach_c: 0.0` 寫死（`liquid_dry_cooler_pure.js:50`），PHE 不存在 | 圖有 PHE、計算沒有 → 自然冷卻門檻高估 PHE approach；UI 的「板換 (PHE) Approach」輸入欄**被忽略**；沒有冷凝器卻標「Condenser Pump」 |
| 絕熱塔 | CDU → **PHE-1** → **Spray Pump** → 絕熱塔 | `hx_approach_c: 0.0` 寫死（`liquid_adiabatic_tower.js:87`） | 同上；**噴霧泵不在製程水迴路上**（它是塔本體的噴淋水系統），標錯位置 |
| 閉式塔 | CDU → **Closed Coil 盤管（獨立方框）** → Circulation Pump → 閉式塔 | FWS 直接進閉式塔盤管，`WB + ctApproach` | 閉式盤管就在塔裡面，圖上把它畫成第二個熱交換器 + 第二個迴路，**拓樸錯誤** |
| 全額水冷冰機 | CDU → **PHE-1** → Chilled Water Pump → 冰機 | 冰機直接供 `fwsSupplyC`，沒有 PHE approach；冷卻水塔有算（風扇、耗水） | **冷卻水塔與冷卻水迴路沒畫**；PHE 有畫但計算沒有 |

共同問題：
- 四種架構的底部都寫「自然冷卻門檻 ≤37.0°C (Mode 1 滿載風冷)」，用同一條「FWS − 乾冷器 approach」公式：
  - 閉式塔是**濕球**驅動（應為 `WB ≤ FWS − ctApproachC`），不是乾球。
  - 絕熱塔的門檻要看噴霧後的有效乾球。
  - 全額水冷冰機沒有自然冷卻，不該顯示門檻。
- 標題都寫「NVIDIA Reference Schematic」，只有 Trim 架構是 NVIDIA DSX 參考設計。
- **文字溢出**：「PHE-1 冰水製冷板換 (Chilled Water PHE)」超出方框；「機械壓縮製冷 (Mechanical Cooling)」壓到「Chilled Water Pump」；「絕熱預冷自然散熱 (Adiabatic)」「密閉水側自然冷卻 (Closed Loop)」壓到泵浦標籤。

### T-3　`air_plant`（Fanwall 系統）— 圖沒畫出計算裡的自然冷卻設備

| 架構 | 問題 |
|---|---|
| 氣冷冰機 | 計算有 free-cooling 盤管串聯預冷（P0-7），圖上**沒有 FC 盤管**，只寫「全時連續供冷」，跟計算矛盾 |
| 水冷冰機 | 計算有冷卻塔 + 板換的水側經濟器（WSE），圖上**沒有板換**；「設計 COP 5.8~6.5」「提供 30~32°C 冷卻水」是寫死文字 |
| RDHX | 圖寫「22°C 高溫供水 / 乾冷器直冷 / 高溫冰機輔助」，計算其實是「氣冷冰機 + FC 盤管」，用使用者設定的 12/18°C。**圖描述的系統不是計算的系統**。另外 RDHX 以 12°C 冰水供水有結露風險，完全沒檢查 |
| 廠區冰水 | 圖寫「綜合年均 COP > 7.0」，計算用 `A('district_chw_cop')` = 5.0 |

### T-4　其他 UI 錯誤
- **總覽膠囊標籤錯誤**（`view_cooling.js:97`）：只認 `dry_cooler_hx`。從下拉選單選「乾冷器 + Trim」後存成 `dry_cooler_trim`，膠囊顯示成「**水冰機**」；`dry_cooler_pure` 也顯示「水冰機」；`cooling_tower_hx` 顯示「濕水塔」（應為閉式塔）。
- Dashboard 噴霧水量仍是假公式（`view_dashboard.js:746`：`itKw × 0.91 × 0.0011`，`db > 24` 就噴）。

---

## 3. 計算／一致性問題

| # | 問題 | 位置 | 修正 |
|---|---|---|---|
| K-1 | `deserializeProject` 換了 `site.hourly` 卻沒清 `site.design` 快取 → 開另一個城市的專案檔時，設計乾濕球沿用上一個城市，選型降額與 Trim 選型全錯 | `store.js:315-340` | 載入 hourly 後 `this.state.site.design = null` |
| K-2 | 純乾冷器、絕熱塔的 PHE approach 寫死 0，使用者輸入被忽略 | 見 T-2 | 見 T-2 |
| K-3 | 絕熱塔乾/濕切換點預設 `FWS − 9.2`（=32.8°C），但乾式運轉在 DB ≤ 37°C 都還能達標 → 32.8~37°C 之間白白噴水，WUE 高估 | `stage_adiabatic.js:145-147` | 見 P4-4 |
| K-4 | Trim 冰機選型用 0.4% 設計乾球，高雄、菲律賓在該點負擔 = 0，只剩 50 kW 下限；Alabama 年最高 DB 時需 0.233 × 863 ≈ 201 kW | `sizing_engine.js` trim 段 | 見 §7-D3 |
| K-5 | 冷凝器出水溫用型錄 COP，不是工況 COP | `schematic_series_trim.js:53` | 見 P4-1 |

---

## 4. 目標設計：讓「拓樸圖」與「計算」來自同一份資料

現在的問題根源：**計算寫在 `simulateHour()`、拓樸圖寫在 `schematic_*.js`，兩邊各自決定系統長什麼樣、溫度多少**。只要有人改了其中一邊，另一邊就錯。

### 4.1 架構描述檔要多兩個欄位

```js
CoolingArchRegistry.register({
  id: 'dry_cooler_trim',
  // ...既有欄位...

  // ① 設備清單：sizing 與逐時計算都從這裡解析設備，不再寫死 key
  equipment: [
    { key: 'cdu_unit',     catalog: 'cdu',           role: 'terminal' },
    { key: 'dry_cooler',   catalog: 'dry_cooler',    role: 'heat_rejection', resolver: 'tower' },
    { key: 'cdu_pump',     catalog: 'pump',          role: 'pump' },
    { key: 'trim_chiller', catalog: 'chiller_water', role: 'chiller', chillerType: 'water_cooled' },
  ],

  // ② 工況點：唯一的溫度鏈來源。simulateHour() 與拓樸圖都呼叫它
  operatingPoint(sys, w, equip) { /* 回傳下方 OperatingPoint */ },

  // ③ 拓樸模型：只描述「有哪些方框、哪些管、標什麼溫度」，不含 SVG 座標
  topology(sys, op, design) { /* 回傳下方 TopologyModel */ },
});
```

```js
/** @typedef {Object} OperatingPoint
 *  @property {'free'|'partial'|'mechanical'} mode
 *  @property {number} fc_fraction  @property {number} chiller_fraction
 *  @property {Object<string, number>} temps   // 例：{ fwsRet, fwsPre, fwsSup, dcOut, condIn, condOut, chwSup, chwRet }
 *  @property {number} [chillerCop]            // 該工況模擬出的 COP（不是型錄值）
 *  @property {{ basis:'db'|'wb'|'db_eff'|'none', full:number|null, mech:number|null }} thresholds
 */
/** @typedef {Object} TopologyModel
 *  @property {string} title          // 例：'NVIDIA DSX 參考拓樸' 或 '設施排熱拓樸'
 *  @property {Array<{id,label,tone}>} banners   // 模式橫幅（含門檻與全年小時數）
 *  @property {Array<{id,kind,title,lines:string[]}>} nodes  // kind: 'it'|'cdu'|'hx'|'chiller'|'dry_cooler'|'tower'|'closed_tower'|'adiabatic'|'pump'|'crah'|'district'
 *  @property {Array<{from,to,label,tone}>} pipes             // label 一律來自 op.temps
 *  @property {Array<string>} footer
 *  @property {Array<string>} warnings
 */
```

### 4.2 渲染器只負責畫

`views/schematics/*.js` 改成只吃 `TopologyModel` 畫圖：**不准**再出現任何 `arch === '...'` 判斷、**不准**自己算溫度、**不准**寫死描述文字。三個 renderer（`single_loop` / `series_trim` / `air_plant`）的版面座標可以保留，但每個方框、每條管、每個溫度標籤都從 model 取。model 沒有的節點（例如沒有 PHE）就不畫。

### 4.3 階段鏈（stage chain）真正實作

```js
// cooling/stage_chain.js（新檔）
/**
 * 串聯階段鏈：economizer 階段依序把回水從 t_ret 往 t_sup 預冷，
 * 剩下的由 mechanical 階段修整；冷凝熱交給 condenserSink 指定的階段排放。
 * @param {Array<{type:string, role:'economizer'|'mechanical', params:Object}>} stages
 * @param {Object} ctx  { Q_kw, t_supply_c, t_return_c, w, sys, equip, loadRatio, fanMinSpeed, ... }
 * @returns 與 simulateHour 相同的結果契約 + op（OperatingPoint）
 */
function runStageChain(stages, ctx) { ... }
```

階段介面統一為：

```js
CoolingStages.register('dry_cooler', {
  // 這個冷源在當下氣候能把水冷到幾度（不含 PHE）
  availableTemp(ctx) { return ctx.w.db + ctx.params.approach_c; },
  // 給定實際排熱量，回傳風扇耗電／耗水
  rejectionCost(ctx, Q_reject_kw, isFullFc) { return { fanKw, waterM3 }; },
});
```

鏈的計算規則（單一 economizer + 單一 mechanical 的情況，與現行 `calcSeriesEconomizer` 完全相同）：

```
T_avail  = economizer.availableTemp(ctx) + (hasPhe ? pheApproachC : 0)
eco      = FreeCoolingEngine.calcSeriesEconomizer(T_avail, t_sup, t_ret)
Q_fc     = Q × eco.fc_fraction
Q_mech   = Q × eco.chiller_fraction
若沒有 mechanical 階段且 eco.chiller_fraction > 0：
    deficitKw = Q × eco.chiller_fraction       // 與現行「unservedRatio」公式等價，見下方驗證
否則 mechanical 階段算 compressorKw；冷凝熱 Q_mech + P 交給 condenserSink
```

> 驗證等價性：現行 `stage_dry_cooler` 純乾冷模式的 `unservedRatio = (T_avail − t_sup)/(t_ret − t_sup)`，與 `eco.chiller_fraction` 相同（只差 `Math.max(1.0, ΔT)` 的分母下限與 `Math.round`）。搬移時保留這兩個細節，0 差異才會成立。

完成後 `dry_cooler_trim`、`air_cooled_chiller`（FC 盤管）、`water_cooled_chiller`（WSE）、`dry_cooler_pure`、`cooling_tower_hx` 全部改為宣告 `stages`，`simulateHour()` 只剩一行 `return runStageChain(this.stages, ctx)`。

---

## 5. 任務清單

### Phase S — 基準
**S-0** 存 `baseline_after_D.json`、`ui_snapshot_after_D.json`；建立 §6 的 `topo_preview.js` 並產出修改前的 9 張截圖（截圖輸出目錄加入 `.gitignore`，不 commit 圖片）。

### Phase P1 — 小型錯誤修正（數值可變，影響小）
**P1-1** K-1：`deserializeProject` 清除 `site.design`。
- 驗收：unit_checks 新增測試——先載入高雄計算、再 deserialize 一個台中專案，`designConditions().designDb` 必須等於台中的值。

**P1-2** T-4 總覽膠囊：`view_cooling.js:97-98` 改用 `CoolingArchRegistry.get(id)?.pillLabel`。在 9 個描述檔新增 `pillLabel`：
| id | pillLabel |
|---|---|
| dry_cooler_trim | 乾冷器+Trim |
| dry_cooler_pure | 純乾冷器 |
| adiabatic_tower | 絕熱塔 |
| cooling_tower_hx | 閉式塔 |
| water_chiller | 水冷冰機 |
| air_cooled_chiller | 氣冷冰機 |
| water_cooled_chiller | 水冷冰機 |
| chilled_water_plant | 廠區冰水 |
| rdhx | RDHX 背板 |
- 允許變動：只有膠囊文字。

**P1-3** Dashboard 噴霧水量：`hourlyProfile[]` 新增 `waterM3`（該小時全廠耗水，m³），`view_dashboard.js:746` 改為顯示 `curHour.waterM3`（m³/h），刪除 `0.91 × 0.0011` 假公式。
- 允許變動：該欄數字。

**P1-4** R-e：經 grep 審查，`getEffectiveFcThresholds` 仍有使用者 `view_weather.js:32,407,471,546`（氣象直方圖與全時自由冷卻標記），`nvidia_dsx_mode2_offset_c` 仍有使用者 `schematic_series_trim.js:34` 及測試 `unit_checks.js:882`。依指示「若 grep 到其他使用者，回報後保留」，兩者皆予以保留並於程式碼中加入審查註解，待後續階段（P4-1）更新。

### Phase P2 — 架構重構（0 差異）
**P2-1** R-b 設備描述：9 個描述檔加 `equipment` 清單（§4.1①）。新增 `AppStore.resolveEquipment(arch, sys)`：依 `equipment[].role/resolver` 呼叫既有的 `resolveCduFromSizing / resolvePumpFromSizing / resolveChillerFromSizing / resolveCrahFromSizing / resolveTowerFromSizing`，回傳 `{ [key]: devices[] }`。`calcHourlyEnergy` 刪除 `store.js:1136-1189` 的寫死 key 查找與 `fwUnitKey` 判斷，改用它。
- 0 差異。

**P2-2** R-d 效能：`resolveEquipment`、`designLiqKw`、`designAirKw`、`loadRatio` 都與小時無關，移到 `AnnualRunner.simulateUnit` 的 8760 迴圈**外面**算一次，透過參數傳入 `calcHourlyEnergy`（保留原簽名相容：多一個可選參數 `pre`，沒傳時照舊在內部算）。
- 0 差異。驗收：10 DU + 1 Pod 的 `calculate()` 從 ~1290 ms 降到 **< 500 ms**（commit 內文附實測）。

**P2-3** R-b 選型：`SizingEngine.generateCduSizing / generateFwSizing` 改為迭代 `arch.equipment`，每個 equipment 再加 `label`、`requiredKw(ctx)`、`derate`、`defaultModelIndex`（把現行 if/else 每段的值原樣搬進描述檔）。`sizing_engine.js` 內不得再有 `arch === '...'`。
- 0 差異（含 `sizing[]` 每個 item 的 `key/label/selectedModel/selectedQty/requiredKw/passed/requiredText` 完全相同）。

**P2-4** R-a 階段鏈：新增 `cooling/stage_chain.js`（§4.3），改寫 stages 為 `availableTemp / rejectionCost` 介面，刪除 `stage_dry_cooler` 的 `isTrimMode` 與 `stage_evap_tower` 的 `isCondenserRejection` 分支（改由 chain 的 `condenserSink` 處理）。把 `AppStore.trimOperatingPoint` 搬到 `liquid_dry_cooler_trim.js` 的 `operatingPoint()`，`AppStore.trimOperatingPoint` 保留為轉呼叫（相容既有呼叫端與測試）。
- 0 差異。
- 可擴充性驗收（只放在 `unit_checks.js`，**不要**加進下拉選單）：在測試內註冊一個 `adiabatic_trim` 架構，內容只有 `stages: [{type:'adiabatic', role:'economizer'}, {type:'chiller', role:'mechanical', chillerType:'water_cooled'}]` 加 `equipment`，不寫任何新物理程式，跑 Alabama 8760 小時必須得到合理結果（冰機負擔 > 0 的小時數 ≤ 純絕熱塔的容量不足小時數；冰機 MWh > 0；deficit 小時 = 0）。

**P2-5** R-c 清除殘留架構字串：以下位置改讀描述檔的 flags / params / topology，完成後 `grep -rnE "=== '(dry_cooler|adiabatic|cooling_tower|water_chiller|rdhx|air_cooled|water_cooled|chilled)" js/ --include=*.js` 在 `js/cooling/archs/` 以外必須 **0 筆**（`item.key ===` 這類設備 key 比對不算，但 `view_dashboard.js:764-772` 請改讀 `equipment[].role`）：
`view_cooling.js:97,98,341,421`、`schematic_air_plant.js:32,43,71,104`、`schematic_series_trim.js:29`、`schematic_single_loop.js:29,35,36,45,53,61,69,162,175,191`、`store.js:1136,1148,1307`、`view_dashboard.js:746`。
- 0 差異（P1-2、P1-3 已先處理會變的部分）。

**P2-6** R-a 樣板：抽出 `cooling/arch_helpers.js`：`emptyHourResult(mode)`、`modeFromEco(eco)`（取代 9 處 `eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC')`）、`chillerFallbackCop(chwSupplyC)`（取代 3 處 `fwBaseCop` 三段式，數值搬進 ASSUMPTIONS：`chiller_fallback_cop_chw_ge20` 5.8、`_ge12` 4.2、`_lt12` 3.0）。
- 0 差異。

### Phase P3 — 拓樸資料模型（拓樸圖可變，數值 0 差異）
**P3-1** 為 9 個架構實作 `operatingPoint()` 與 `topology()`（§4.1②③）；`simulateHour()` 一律透過 `operatingPoint()` 取得溫度鏈。
**P3-2** 三個 renderer 改成只吃 `TopologyModel`（§4.2）。
- 允許變動：只有 Step 4 的拓樸圖區塊（`.bg-slate-950` 兩個方框內）。驗收：
  - `run.js --compare baseline_after_D.json` 0 差異。
  - `ui_snapshot.js --mode full` 只有 step4 不同；step1/2/3/5 必須 0 差異。
  - `grep -n "arch ===\|fwArch ===\|°C" views/schematics/*.js` 不得出現寫死溫度數字或架構判斷（模板中的 `°C` 單位字串可以有，但前面必須是變數）。
  - 截圖目視：與 S-0 的截圖相比，版面位置不變（本任務只換資料來源，還不修正拓樸內容）。

### Phase P4 — 拓樸與物理修正（數值可變、拓樸圖可變）

**P4-1** T-1 Trim 拓樸：
- `operatingPoint()` 的 `thresholds`：`full = FWS供 − dcApproach − pheApproach`；`mech = FWS回 − dcApproach − pheApproach`；`basis: 'db'`。
- 模式橫幅三段：
  - `Mode 1 全自然冷卻 (DB ≤ {full}°C) — 全年 {h1} h`
  - `Mode 2 串聯預冷 + Trim 修整 ({full} < DB < {mech}°C) — 全年 {h2} h`
  - `Mode 3 乾冷器無法預冷，Trim 冰機承擔 100%，乾冷器僅排冷凝熱 (DB ≥ {mech}°C) — 全年 {h3} h`

  小時數取自該單元的逐時模擬結果（`AnnualRunner` 需在每個單元結果多存 `cduModeHours: {free, partial, mechanical}`）。
- 圖上的溫度改用**兩個工況**：
  - 設計工況（0.4% DB）：Mode 1 時標「設計點全自然冷卻，無需修整」，Secondary HX 與冰機迴路畫成灰色停機狀態。
  - 尖峰工況（年最高 DB）：圖右上角加一個小表格「年最高 DB {maxDb}°C 工況：預冷至 {fwsPre}°C／Trim 負擔 {f×Q} kW／冷凝器 {condIn}→{condOut}°C／冰機 COP {cop}」。
- 冷凝器出水：`condOut = condIn + (Q_mech + P_comp) / (m_dc × cp)`，`m_dc = Q_design / (cp × (FWS回 − FWS供))`（平衡流量假設，與 `tCewt` 推導一致），`P_comp` 用 `ChillerEngine.calcPower` 在該工況算出的值。
- 冰機冰水回水：新增參數 `trimChwDtC`（預設 5.0，ASSUMPTIONS `trim_chw_dt_default_c`），`chwRet = chwSup + trimChwDtC`。
- 預期影響：數值 0 差異（只改圖與新增欄位）。

**P4-2** T-2 PHE 一致性（**數值會變**，見 §7-D1）：
- `dry_cooler_pure`、`adiabatic_tower` 的 `params` 加 `hasPhe`（預設 `true`）與 `pheApproachC`（預設 2.0）；計算改用 `hasPhe ? sys.pheApproachC : 0`，刪除 `liquid_dry_cooler_pure.js:50`、`liquid_adiabatic_tower.js:87` 的寫死 0。
- `cooling_tower_hx`：`hasPhe` 預設 `false`；拓樸改為 **CDU 一次側直接接閉式塔盤管**，刪除獨立的「Closed Coil」方框與第二個循環泵。
- `water_chiller`：`hasPhe` 預設 `false`；`hasPhe=true` 時 `t_chws = fwsSupplyC − pheApproachC`。拓樸補上「冰機冷凝器 ⇄ 冷卻水泵 ⇄ 開式冷卻水塔」迴路，冷卻水溫標 `condIn = max(min_cewt, designWb + tower_approach)`。
- 拓樸規則：`hasPhe=false` 就不畫 PHE；PHE 外側泵浦依實際介質命名（乾冷器＝「乙二醇循環泵」、絕熱塔＝「盤管循環泵」、冰機＝「冰水泵／冷卻水泵」）；絕熱塔的噴霧泵畫在塔本體旁的附屬方塊，不在製程迴路上。
- UI：Step 4 的「板換 (PHE) Approach」輸入欄只在 `hasPhe=true` 時顯示（用既有的 `renderArchParamPanel` 機制產生 `hasPhe` 勾選框）。
- `migrateProject`：v5 專案缺 `hasPhe` 時依架構補預設值。
- 預期影響：純乾冷器、絕熱塔的自然冷卻門檻降 2°C → **自然冷卻小時減少、容量不足小時增加、PUE 上升**。閉式塔、全額水冷冰機 0 差異。

**P4-3** T-2 門檻與標題：
- 底部門檻改用 `op.thresholds`：
  - 乾冷器類：`自然冷卻門檻 DB ≤ {full}°C`
  - 閉式塔：`自然冷卻門檻 WB ≤ {fwsSup − ctApproachC}°C`
  - 絕熱塔：`乾式 DB ≤ {switchpoint}°C ／ 噴霧後有效乾球 ≤ {fwsSup − approach − phe}°C`
  - 全額水冷冰機：`無自然冷卻（全年機械製冷）`，並顯示 R-f 的 D5 警示
- 標題：只有 `dry_cooler_trim` 顯示「NVIDIA DSX 參考拓樸」，其他顯示「設施排熱拓樸 (Facility Heat Rejection)」。
- 文字溢出：所有方框標題與內文用 `<text textLength>` 或依方框寬度截斷（超過寬度改為兩行），驗收以截圖確認 9 張圖都沒有文字壓到框線或泵浦標籤。

**P4-4** K-3 絕熱塔切換點（**數值會變**，見 §7-D2）：
- 預設 `drySwitchpoint = FWS供 − dryCoolerApproachC − (hasPhe ? pheApproachC : 0)`（乾式剛好無法達標的溫度）；使用者在 UI 填了實測值時照舊用實測值。
- 刪除 `adiabatic_switchpoint_offset_c` 的使用（ASSUMPTIONS 項目保留，`label` 註明「已改為依需求切換，僅供參考」）。
- 預期影響：絕熱塔**耗水減少、WUE 下降**；PUE 微幅下降（噴霧泵時數減少）。

**P4-5** T-3 Fanwall 拓樸：
- 氣冷冰機：在冰水回水管上、蒸發器之前畫「Free-Cooling 盤管（串聯預冷）」，標示 `全自然冷卻 DB ≤ {chwSup − fcApproach}°C ／ 部分預冷 DB < {chwRet − fcApproach}°C — 全年 {h_free}/{h_partial} h`。刪除「全時連續供冷」。
- 水冷冰機：畫出 WSE 板換，冷卻塔出水同時接板換與冷凝器；`設計 COP` 改顯示設計工況模擬值；冷卻水溫改為 `designWb + tower_approach`。
- RDHX：文字改為描述實際模型（氣冷冰機 + FC 盤管，供回水 {chwSup}/{chwRet}°C），刪除「22°C 高溫供水」「乾冷器直冷」等未建模描述。新增驗證：`chwSupplyC < A('rdhx_min_chws_c')` 時於 `fwSys.validation.checks` 加 ⚠「RDHX 供水低於露點保護溫度，有結露風險」。新常數 `rdhx_min_chws_c` 預設 17.0（ref：ASHRAE TC9.9 A1 建議露點上限 15°C + 2K 安全餘裕）。
- 廠區冰水：COP 文字改顯示 `A('district_chw_cop')`。
- 冷熱通道溫度、氣流溫升保留，但標註「(典型值)」。
- 預期影響：數值 0 差異（只有新增驗證訊息與圖）。

**P4-6** R-f D5 警示：`water_chiller` 的 `validateCdu` 加一條：若 `designWb + A('tower_approach_c') + (hasPhe ? pheApproachC : 0) < fwsSupplyC`，加 ⚠「設計濕球 + 塔 approach 已低於 FWS 供水溫，冷卻水塔可直接供冷；建議改用閉式塔或加裝水側經濟器」。
- 預期影響：數值 0 差異。

**P4-7** Trim 冰機選型基準（見 §7-D3）：照預設做法實作。

### 完成回報格式
1. 每個任務：commit hash、回歸比對摘要、截圖驗收逐條勾選。
2. 9 張最終拓樸截圖的檔名清單。
3. §7 各決定項採用的做法。
4. 任何無法照本文件執行的地方與原因。

---

## 6. 拓樸截圖工具 `tools/pue_regression/topo_preview.js`

以下作法已實測可行（Windows、Chrome headless）。截圖輸出到 `tools/pue_regression/topo_out/`（加入 `.gitignore`）。

1. 讀 `public/Data center Cal/index.html`，在 `<head>` 後插入 `<base href="file:///…/public/Data center Cal/">`（路徑用 `url.pathToFileURL` 產生，資料夾名稱含中文與空白），在 `</body>` 前插入：
   ```html
   <script>
   window.addEventListener('load', () => setTimeout(() => {
     const q = new URLSearchParams(location.search);
     const S = AppStore, city = q.get('city') || '高雄 (Kaohsiung)', d = BUILTIN_WEATHER_DATA[city];
     S.updateSite({ selectedCity: city, hourly: d.hourlyData, isRealEpw: true });
     const du = S.state.halls[0].dus[0];
     du.plantDesign.cduSystem.architecture = q.get('cdu');     du.plantDesign.cduSystem.sizing = [];
     du.plantDesign.fanwallSystem.architecture = q.get('fw');  du.plantDesign.fanwallSystem.sizing = [];
     S.notify(); App.renderStep(4); ViewCooling.collapseAll(); ViewCooling.toggleExpand(du.id);
     document.querySelector('header').style.display = 'none';
     document.querySelector('footer').style.display = 'none';
     const unit = document.getElementById('unit_' + du.id), m = document.querySelector('main');
     const blocks = unit.querySelectorAll('.bg-slate-950');               // [0]=CDU 拓樸, [1]=Fanwall 拓樸
     m.innerHTML = ''; m.appendChild(blocks[q.get('part') === 'fw' ? 1 : 0]);
   }, 800));
   </script>
   ```
   寫到 `os.tmpdir()/pue_topo/preview.html`。
2. 找瀏覽器：`C:/Program Files/Google/Chrome/Application/chrome.exe`，找不到改 `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`。
3. 每張圖用**獨立的** `--user-data-dir`（避免 localStorage 自動存檔互相污染），參數：
   `--headless=new --disable-gpu --allow-file-access-from-files --force-device-scale-factor=1.5 --window-size=1300,560 --virtual-time-budget=10000 --hide-scrollbars --screenshot=<out.png> "<preview.html 的 file URL>?cdu=..&fw=..&part=cdu|fw"`
4. 產出 9 張：CDU 5 張（`cdu=<arch>&fw=air_cooled_chiller&part=cdu`）、Fanwall 4 張（`cdu=dry_cooler_trim&fw=<arch>&part=fw`），檔名 `cdu_<arch>.png`、`fw_<arch>.png`。
5. 支援 `--city` 參數；P4-1 驗收時另外產一張 `--city "美國 (Alabama Andalusia)"` 的 Trim 圖（該地有 Trim 運轉時數，用來確認尖峰工況表格有值）。

---

## 7. 需東旭決定的項目（先照預設做法執行）

| # | 問題 | 預設做法 | 影響 |
|---|---|---|---|
| D1 | 純乾冷器／絕熱塔是否有 PHE 隔離乙二醇迴路？（現在圖上有、計算沒有） | 預設**有**（`hasPhe=true`，2.0°C），可在 Step 4 取消 | 自然冷卻門檻降 2°C，PUE 上升 |
| D2 | 絕熱塔切換點：依需求切換（乾式達不到才噴）還是沿用廠商經驗偏移 9.2°C？ | 預設**依需求切換**；有廠商選型報告時填實測值 | WUE 下降 |
| D3 | Trim 冰機選型基準：0.4% 設計乾球（台灣多數城市 Trim 需求為 0，只剩 50 kW 下限）還是年最高乾球？ | 預設改為**年最高乾球**當 N+1 選型基準；`maxMechanicalKw` 改成 Mode 3 門檻 `T3` 時的需求（=100% 液冷負載）只做資訊顯示 | Trim 冰機選型需求增加，部分專案會從「滿足 N+1」變「容量不足」 |
| D4 | RDHX 露點保護溫度 17°C 是否適用你的案場（依機房溫濕度設定點而定）？ | 預設 17°C，可在假設表覆寫 | 只影響警示 |
