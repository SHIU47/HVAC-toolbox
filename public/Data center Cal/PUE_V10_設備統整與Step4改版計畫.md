# PUE 計算工具 V10 計畫：設備統整、全廠水溫連動、Step 4 改版

> 建立：2026-11-10（由 Fable 5.2 分析撰寫，交由 Opus 5.5 執行）
> 狀態：**執行中**（進度見 §9）
> 前一輪：`PUE_V9_修正升級計畫.md`、`pue_v9_report.md`（已全部完成，commit `1299853`～`2f6f4ab`，尚未 push）

接手的 AI：先讀本檔全文與 `git log -10`，再動手。本檔 §2 的決定事項已由使用者授權（「依照你的判斷」），不需要再問；§8 列出的才是要問的。

---

## 0. 使用者的要求（原話整理）

1. 計算書要有**設備規格表**，要做**設備統整**。
2. 程式要**完整**。
3. UI/UX 要更好用。**Step 4 輸入調整還是不方便**。
4. **供水溫改一個，其他應該自動變成一樣**（整場水溫通常相同）。
5. 0901 專案不用再管，**以 1106 專案為準**：`C:\Users\30468\Desktop\PUE_Project_高雄 (Kaohsiung)_20261106.json`（不進 git）。
   - repo 內的 `projects/PUE_Project_高雄 (Kaohsiung)_20260901.json` 只是單元測試在用，**不要刪**，但回報和驗證不要再提它。

---

## 1. 現況分析（已查證，附位置）

### 1.1 水溫為什麼不會連動

水溫目前存在三個互不相干的地方：

| 位置 | 欄位 | 編輯入口 |
|:--|:--|:--|
| 每個 DU／CorePOD 的 `plantDesign.cduSystem` | `secSupplyC`、`secReturnC`（晶片側 TCS）、`cduApproachC`、`fwsSupplyC`、`fwsReturnC`、`dryCoolerApproachC`、`pheApproachC` | 單元卡片 `updateCduParams()`（`views/view_cooling.js:1744`） |
| 每個 DU／CorePOD 的 `plantDesign.fanwallSystem` | `chwSupplyC`、`chwReturnC` | 單元卡片 `updateFwParams()`（`:1822`） |
| 共用機房 `coolingPlants[].system` | 液冷：`fwsSupplyC`、`fwsReturnC`、`dryCoolerApproachC`、`pheApproachC`；氣冷：`chwSupplyC`、`chwReturnC` | 機房卡片 `updatePlantParams()`（`:1566`） |

連動只有一條：`store.js:1317 syncUnitFromPlant()` 把機房的 FWS／CHW **單向**蓋到成員單元。結果是：

- 在 DU-01 改晶片供水 45 → 43 °C：`updateCduParams` 算出該單元 FWS = 39，但下一次 `calculate()` 就被機房的 41 蓋回去。**其他 4 個單元不會跟著改，機房 FWS 也不會變**，只會多一條「溫度不相容」的紅字（`store.js:2507 checkTempCompat`）。
- 在機房卡片改 FWS 41 → 39：成員的 FWS 跟著變，但成員的晶片供水 `secSupplyC` 不變。
- 5 個單元要改 5 次。1106 專案現況是 5 個單元全部 45／55／approach 4、機房 41／51、冰水 20／30，全部靠手動維持一致。
- `coolingPlants[].system` 裡還殘留一份 `secSupplyC`／`cduApproachC`（從最大單元複製來的，`store.js:1262 applySiteSharedConfig`），沒有任何地方會更新它。

### 1.2 Step 4 為什麼難用

用 1106 專案截圖實測（1400 px 寬），整頁約 6,000 px 高，結構是：

```
標題列（智慧聚焦／全部展開／全部收合）
冷卻系統分組面板（兩欄，勾選成員）
共用機房卡片 × 2（每張：成員列、架構下拉、摘要、示意圖、左水溫 + 右設備卡片）
單元狀態小卡 × 5
單元卡片 × 5（展開後每張又有液冷、氣冷兩大區，各有水溫面板 + 設備卡片）
```

問題：

| # | 問題 | 位置 |
|:--|:--|:--|
| S1 | 沒有「全廠」層級，共同條件（水溫、approach、冗餘等級）要逐張卡片改 | 整頁 |
| S2 | 4 個 DU 完全相同，CDU／CRAH 型號和台數卻要逐一進卡片改，沒有「套用到全部」 | `renderExpandedUnitCard` |
| S3 | 每台設備是一張大卡片（標題、需求文字、3 個欄位、2 行說明），一個系統 4 台設備就 500 px | `:500-670`、`:1208-1285` |
| S4 | 型號下拉是純文字 `[廠商] 型號 (kW)`，看不到「選這台要幾台、餘裕多少」，只能選了再看 | 三處 `modelOptions` |
| S5 | 成員單元的卡片仍顯示完整水溫面板，但 FWS 其實由機房決定，改了沒用（見 1.1） | `:778-812` |
| S6 | 改任何一個數字整頁重繪（`render()` 重設 `innerHTML`，靠記住 scroll／focus 補救） | `:59` |
| S7 | 選型不合格時，點 Step 5 只跳一個 `alert` 擋住（`app.js:146`）；但 V9 已有不合格橫幅，沒必要硬擋 | `app.js` |

### 1.3 設備資料現況

- 每個選型項目 `sizing[]` 帶著完整的 `catalog[]`（已由 `CatalogManager` 正規化，同時保留型錄原始欄位）。1106 專案實際看到的欄位：

| 設備 key | 可用規格欄位 |
|:--|:--|
| `cdu_unit` | `capKw`、`powerKw`／`power_kw`、`flow_rate_lpm`、`external_pressure_drop_bar`、`pump_type`、`weight_kg`、`dimensions_mm{width,depth,height}`、`_source` |
| `crah_unit` | `capKw`、`fanPowerKw`、`netSensibleCapacityKw`、`airflowM3h`、`chwInletTempC`、`chwDeltaTC`、`widthMm`／`depthMm`／`heightMm`、`_source` |
| `air_cooled_chiller` | `capKw`、`cop`／`cop_design`、`power_input_kw`、`refrigerant`、`t_chws_c`、`water_flow_lh`、`airflow_m3h`、`iplv`、`_source`、`_verified` |
| `trim_chiller`（York YT 2500kW） | 只有 `capKw`、`cop`（**沒有出處、沒有輸入功率**） |
| `dry_cooler` | `capKw`、`fanKwDx`／`fan_kw_dx`、`fanKwFc`／`fan_kw_fc`、`approachC`、`flow_rate_lpm` |
| 各種泵 | `capKw`（馬達 kW）、`designFlowM3h`、`designHeadM`、`pumpEtaDesign`、`motorEtaDesign`、`motor_efficiency_class`、`_source`、`_verified` |

- 欄位命名不一致（同一個意思有 camelCase 和 snake_case 兩種），需要一個正規化函式。
- 計算書 §4 和 Excel「5.冷卻系統設計」目前只列「型號 × 台數」，沒有全案統整，也沒有規格。

---

## 2. 決定事項（Fable 判斷，使用者已授權；使用者可事後否決）

| # | 決定 | 理由 |
|:--|:--|:--|
| D1 | 設備規格表同時做在 Step 6 計算書和 Excel（新工作表） | Excel 方便轉給廠商和採購 |
| D2 | 全案相同型號合併成一列，另列「使用位置」 | 發包和數量統計用 |
| D3 | 終端設備（CDU、CRAH／風牆、RDHX）和主機房設備都統整，分兩區 | 終端設備台數最多 |
| D4 | 水溫預設**全廠連動**；可以關掉，也可以讓單一單元「獨立設定」 | 使用者說整場水溫通常相同，但要保留例外 |
| D5 | 水溫鏈關係固定為 **FWS 供水 = 晶片供水 − CDU approach**，回水依晶片側 ΔT。改晶片供水或 FWS 其中一個，另一個跟著動，**approach 不動**；改 approach 時晶片供水不動、FWS 跟著動 | approach 是設備特性；三個數字永遠一致，不會再出現「溫度不相容」 |
| D6 | 共用機房的成員一律跟機房同一組 FWS（同一條管路，物理上必然） | 獨立設定只允許在非成員單元 |
| D7 | Step 5 不再用 `alert` 擋；可以進去，但顯示不合格橫幅 | V9 已有 `overall.compliance` 和橫幅 |
| D8 | 設備卡片改成表格列；型號下拉顯示「需要台數／餘裕」 | 減少高度，選之前就看得到結果 |
| D9 | 泵揚程、冗餘等級不做連動，只提供「套用到全部」按鈕 | 不同迴路的揚程本來就不同 |

---

## 3. Phase 6：設備統整（先做，獨立、風險最低）

### 3.1 新檔 `js/equipment_schedule.js`

純函式模組，不碰 DOM，掛在 `window.EquipmentSchedule`。**要加進 `index.html`（放在 `sizing_engine.js` 之後、`store.js` 之前都可以）和 `tools/pue_regression/harness.js` 的 `FILES`，兩邊順序要一致**（`check_harness_order.js` 會檢查）。

```js
EquipmentSchedule.build(state) → {
  rows: [ {                       // 一列 = 一個「設備 key + 型號」
    key, category,                // 'cdu_unit' …；category: 'terminal' | 'plant'
    label, model, vendor,
    unitCapKw,                    // 單機容量（泵為馬達 kW）
    unitPowerKw, unitPowerBasis,  // 單機耗電與來源：'catalog' | 'cap/cop' | 'motor' | null
    qtyTotal, qtyRunning, qtyStandby,
    installedCapKw,               // qtyTotal × unitCapKw
    connectedKw,                  // qtyTotal × unitPowerKw
    runningKw,                    // qtyRunning × unitPowerKw
    locations: [ { name, loop, qty, redundancy } ],
    spec: { … 正規化後的規格，見 3.2 },
    source, verified, aiConfidence   // 來自 _source / _verified / _ai_confidence
  } ],
  totals: { connectedKw, runningKw, byGroup: { chiller, heatRejection, pump, cdu, crah } },
  warnings: [ '…型號沒有出處', '…沒有耗電資料' ]
}
```

資料來源（跟 `view_report.js` 的 `collectSystems()` 同一套邏輯，**把那段搬進本模組共用，不要寫兩份**）：
- 共用機房：`state.coolingPlants[].system.sizing`（全部）。
- 非成員單元：`plantDesign.cduSystem.sizing`／`fanwallSystem.sizing`（全部）。
- 成員單元：同上，但只取 `role === 'terminal'`（主機房設備已算在機房）。
- 負載為 0 的系統（`requiredKw <= 0`）不列。停用的 CorePOD（`enabled === false`）不列。
- 運轉／備用台數用 `SizingEngine.standbyUnits(qty, redundancy)`。

### 3.2 規格正規化（只讀型錄，**不可自行補數字**）

| 輸出欄位 | 依序取用的型錄欄位 |
|:--|:--|
| 容量 kW | `capKw` → `cooling_capacity_kw` → `capacityKw` → `heat_rejection_kw` |
| 單機耗電 kW | `powerKw` → `power_kw` → `power_input_kw` → `fanPowerKw` → `fanKwDx`／`fan_kw_dx`；冰機沒有輸入功率時用 `capKw ÷ cop`，並標 `unitPowerBasis = 'cap/cop'`；泵用 `capKw`（馬達額定），標 `'motor'` |
| COP／IPLV | `cop` → `cop_design`；`iplv` |
| 水流量 | `flow_rate_lpm`（L/min）；`water_flow_lh`（L/h，換算成 m³/h）；泵 `designFlowM3h` → `design_flow_m3h` |
| 揚程／壓降 | `designHeadM` → `design_head_m`；`external_pressure_drop_bar` |
| 風量 m³/h | `airflowM3h` → `airflow_m3h` |
| 水溫 | `t_chws_c`、`chwInletTempC`、`chwDeltaTC`、`approachC`／`approach_temp_c` |
| 冷媒 | `refrigerant` |
| 效率 | `pumpEtaDesign`、`motorEtaDesign`、`motor_efficiency_class` |
| 尺寸 mm | `widthMm`／`depthMm`／`heightMm` → `dimensions_mm.{width,depth,height}` |
| 重量 kg | `weight_kg` |

沒有的欄位輸出 `null`，畫面顯示「—」。`_verified === false` 或沒有 `_source` 的列標「⚠ 未驗證」。

### 3.3 計算書新章節

在 `view_report.js` §4「選型核算」之後插入新的 **§5「設備規格與數量統整」**，原 §5～§10 順延為 §6～§11（目錄、`id`、`sec()` 編號、單元測試 V9-P4 裡的 id 清單都要一起改）。

- **5.1 設備總表**：兩區（主機房設備、終端設備）。欄位：設備、型號、廠商、單機容量、單機耗電、台數（運轉＋備用）、總裝置容量、使用位置、出處。
- **5.2 規格明細**：依類別各一張表，欄位依 3.2 該類別有值的項目動態決定（整欄都是 null 就不顯示）。類別：CDU、CRAH／風牆、冰機、排熱設備、泵。
- **5.3 冷卻設備電力需求彙總**：分組（冰機、排熱、泵、CDU、CRAH）列出裝置容量 kW 與運轉 kW，加總。註明「冰機為額定工況輸入功率；泵為馬達額定功率，非軸功率」。**加註：電氣容量檢討請相關專業另行審查。**
- §11 待確認事項：把 `warnings` 併進去。

### 3.4 Excel 新工作表

`excel_export.js` 的 `SN` 加一張 `equip: '13.設備規格表' / '13.Equipment Schedule'`（放最後，不要插在中間，避免動到既有跨表公式 `X()` 的引用）。內容同 5.1＋5.2＋5.3；合計列用 Excel 公式（`SUMPRODUCT` 或逐列 `=台數*單機`），樣式沿用該檔既有的 `titleBlock`／`header`／`put`。目錄頁（約 `:1530`）加一列。

### 3.5 驗收

- 新單元測試：
  - 設備總表各 key 的台數合計 ＝ 直接走訪 `sizing` 加總（用 1106 的等效資料；測試檔拿不到桌面的 1106 檔時，用預設專案 + `applySiteSharedConfig()`）。
  - `connectedKw` ＝ Σ 列的 `qtyTotal × unitPowerKw`。
  - 英文模式下 Excel 新工作表 0 個 CJK（既有 I-5／I-7 類測試的做法照抄）。
- `node ui_preview.js <1106> 6 …` 截圖檢查新章節。
- 1106 專案預期看到：Güntner 6000kW × 10、York YT 2500kW × 7、Uniflair XCAF2524A × 6、CDU2300 × 30（4 DU × 7 + CorePOD × 2）、FWCV40L2A × 28（4 × 6 + 4）。**數字對不上就是統整邏輯有錯。**

commit：`V10 Phase 6: 設備規格與數量統整（計算書新章節、Excel 新工作表）`

> ✅ 結果：1106 專案數量與預期一致（Güntner × 10、York × 7、XCAF2524A × 6、CDU2300 × 30、FWCV40L2A × 28），冷卻設備連接負載 11,222 kW、運轉 9,539 kW。Excel 新工作表沒有方案時排第 12 個位置，有方案時排第 13 個（名稱固定「13.設備規格表」）；I-7、S-2 的工作表數量斷言已同步更新。「總裝置容量」不做跨類別加總（冷卻 kW、排熱 kW、馬達 kW 單位意義不同）。

---

## 4. Phase 7：全廠設計條件與水溫連動（資料層）

### 4.1 資料模型

`state.siteCooling`（新增，schema 升 `v9`）：

```js
siteCooling: {
  linkTemps: true,                 // 全廠水溫連動
  liquid: { secSupplyC, secReturnC, cduApproachC, dryCoolerApproachC, pheApproachC },
  air:    { chwSupplyC, chwReturnC }
}
```

單元可獨立：`plantDesign.cduSystem.tempOverride = true`、`plantDesign.fanwallSystem.tempOverride = true`（預設 `false`／未定義）。

**FWS 不存在 `siteCooling` 裡**，永遠由 `secSupplyC − cduApproachC`、`secReturnC − cduApproachC` 算出（D5），避免再出現兩個來源。

### 4.2 store API（全部放 `store.js`，畫面不可以直接改 state）

```js
getSiteCooling()                       // 沒有就從現況推導後建立
setSiteCoolingTemp(loop, key, value)   // loop: 'liquid' | 'air'；key 可為 'fwsSupplyC'（虛擬鍵，見下）
setTempLink(on)
setUnitTempOverride(unitId, loop, on)
applySiteCoolingToAll()                // 把 siteCooling 寫到所有受連動的機房與單元
applyToAllUnits(loop, equipKey, { model, qty, redundancy })   // Phase 8 用：終端設備套用到全部
applyPumpHeadToAll(loop, headM)        // D9
```

`setSiteCoolingTemp('liquid', key, v)` 規則（D5）：

| 改的欄位 | 動作 |
|:--|:--|
| `secSupplyC` | 寫入；`secReturnC` 保持 ΔT（= 原 `secReturnC − secSupplyC`）跟著平移 |
| `secReturnC` | 寫入（等於改 ΔT） |
| `cduApproachC` | 寫入（FWS 自動變） |
| `fwsSupplyC`（虛擬） | `secSupplyC = v + cduApproachC`，`secReturnC` 保持 ΔT |
| `fwsReturnC`（虛擬） | `secReturnC = v + cduApproachC` |
| `dryCoolerApproachC`、`pheApproachC` | 寫入 |

寫入後呼叫 `applySiteCoolingToAll()` → `notify()`。

`applySiteCoolingToAll()`：
- `linkTemps === false` 時不做事。
- 液冷：每個 liquid 機房的 `system` 寫入 `fwsSupplyC`、`fwsReturnC`、兩個 approach，**同時也寫 `secSupplyC`／`secReturnC`／`cduApproachC`**（消掉 1.1 的殘留值）。每個單元（`tempOverride !== true`）的 `cduSystem` 寫入全部 7 個欄位。
- 氣冷：同理寫 `chwSupplyC`、`chwReturnC`。
- 成員單元即使 `tempOverride === true`，FWS／CHW 仍然跟機房（D6）；override 只影響晶片側 `secSupplyC`／`secReturnC`／`cduApproachC`。這時既有的 `checkTempCompat` 仍然有效，保留。

**連動關閉時**（`linkTemps === false`）：機房仍是成員的主控。修改 `syncUnitFromPlant()`：成員 `tempOverride !== true` 時，除了 FWS 也同步 `secSupplyC = plant.fwsSupplyC + unit.cduApproachC`（回水同理）。這樣「改機房 → 成員全部一致」在兩種模式下都成立。

### 4.3 既有入口改走新 API

| 現有函式 | 改法 |
|:--|:--|
| `ViewCooling.updateCduParams(targetId)` | 讀到的 `secSupplyC`／`secReturnC`／`cduApproachC`／兩個 approach：若連動開啟且該單元未 override → 逐一比對有變的欄位，呼叫 `setSiteCoolingTemp`；否則維持原行為只寫該單元。架構專屬參數、泵揚程維持原邏輯 |
| `ViewCooling.updateFwParams(targetId)` | 同上（`chwSupplyC`／`chwReturnC`） |
| `ViewCooling.updatePlantParams(plantId)` | 連動開啟 → `setSiteCoolingTemp`（FWS 用虛擬鍵）；關閉 → 寫機房，並依 4.2 同步成員 |
| `applyCduPreset`、`applyFwTemps` | 連動開啟 → 套到全廠；關閉 → 只套該單元（原行為） |
| `applySiteSharedConfig`、`applyHallGroupedConfig`、`addCoolingPlant`、`addPlantMember` | 結尾呼叫 `applySiteCoolingToAll()`，新機房／新成員立刻一致 |
| 新增 DU／CorePOD、套用範本（`view_hall_su.js` 的範本功能） | 同上 |

### 4.4 舊專案遷移（`deserializeProject`）

沒有 `siteCooling` 時：
1. 收集所有單元和機房的 7＋2 個欄位。
2. 液冷全部一致（容許 0.05 °C）→ `linkTemps = true`，`liquid` 取該值；氣冷同理。**兩邊都一致才開連動。**
3. 有任何不一致 → `linkTemps = false`，`liquid`／`air` 取 IT 負載最大單元的值，**不改動任何單元的現有數值**。
4. 載入時**不可以**呼叫會改數值的 `applySiteCoolingToAll()`（除非步驟 2 成立，這時它是 no-op）。

驗收條件：**1106 專案載入前後 PUE、各分項 MWh 完全不變**（1106 現況全部一致，會進入連動模式）。

### 4.5 驗收

新單元測試（放 `unit_checks.js` 結尾 summary 之前）：
- 連動開啟，在任一單元改晶片供水 45 → 43：所有單元 `secSupplyC = 43`、`fwsSupplyC = 39`，機房 `fwsSupplyC = 39`，`canProceedStep4()` 沒有溫度不相容。
- 用虛擬鍵把 FWS 改成 37：`secSupplyC = 41`，approach 不變。
- 改 approach 4 → 3：`secSupplyC` 不變，FWS +1。
- 氣冷 CHW 同樣測一次。
- 一個非成員單元設 `tempOverride`：改全廠值時它不動；它自己改時別人不動。
- 連動關閉：改機房 FWS，成員 FWS 和晶片供水都跟著變；非成員不變。
- 遷移：全部一致的舊專案 → `linkTemps = true` 且結果不變；故意把一個單元改成不同再序列化載入 → `linkTemps = false` 且數值不變。
- 序列化往返保留 `siteCooling` 與 `tempOverride`。
- schema 版本斷言由 `'v8'` 改 `'v9'`（`unit_checks.js` 內約 7 處）。

回歸：`node run.js --compare baseline_after_V9_P3.json` 必須 **0 差異**（預設專案水溫本來就一致）。

commit：`V10 Phase 7: 全廠設計條件與水溫連動（資料層、舊專案遷移）`

> ✅ 結果與偏離：
> - 「新增／複製單元、建立機房、加入成員、套用範本」改用**包裝函式**（`store.js` 檔尾，執行後呼叫 `applySiteCoolingToAll()`，有變動才 `notify()`），沒有逐一修改各函式本體。**不在 `calculate()` 裡強制套用**：既有測試會直接改單元水溫再計算，強制套用會把它們改回去。
> - 氣冷 CHW 也比照液冷：改供水時保持 ΔT。
> - `applyToAllUnits`、`applyPumpHeadToAll` 已先在 store 實作（Phase 8 畫面要用）。
> - 1106 專案載入後 `linkTemps = true`（液冷 45/55、approach 4、FWS 41/51；冰水 20/30）。第一次套用只清掉機房殘留的 `secReturnC` 57→55，PUE 不變。把晶片供水改成 43 °C → 5 個單元＋機房全部 43/39，PUE 1.167→1.169，沒有溫度不相容。
> - 測試 V10-P7a～g 共 7 項；unit_checks 283 passed；140 組回歸 0 差異；1106 與基準一致。

---

## 5. Phase 8：Step 4 介面改版

目標：**1106 專案在 1400 px 寬時，預設畫面不超過約 2,500 px 高；常見修改（水溫、型號、台數）不需要展開任何卡片。**

### 5.1 新版面

```
┌ Step 4 標題 ─────────────────────────────────── [合格狀態] ┐
│ A. 全廠設計條件（固定在最上面，一列）                          │
│  液冷  晶片供水[45] 回水[55]  CDU approach[4] → FWS 41/51 °C  │
│        排熱 approach[5]  PHE approach[2]   [NVIDIA 45/57] [… ]│
│  氣冷  冰水供水[20] 回水[30]              [20/30] [12/18] …   │
│  [✓] 全廠水溫連動    泵揚程 [套用到全部…]   冗餘 [套用到全部…]   │
├───────────────────────────────────────────────────────────┤
│ B. 冷卻系統分組（沿用現有面板，預設收合成一行摘要）              │
├───────────────────────────────────────────────────────────┤
│ C. 主機房設備（每個機房一個區塊，設備用表格）                   │
│  全廠共用液冷系統  50,915 kW  5 成員  架構[▼]  揚程[28]        │
│  ┌設備──────┬型號（下拉）────────┬冗餘┬台數┬有效/需求┬餘裕┬─┐ │
│  │乾冷器    │Güntner 6000kW ▼     │N+1 │−10+│54,000/50,915│6%│✓│ │
│  │Trim 冰機 │York YT 2500kW ▼     │N+1 │− 7+│14,565/13,747│6%│✓│ │
│  │FWS 泵    │NB 150-315/336 ▼     │N+1 │− 9+│ …          │  │✓│ │
│  └──────────┴─────────────────────┴────┴────┴────────────┴──┴─┘ │
│  ▸ 系統示意圖   ▸ 架構專屬參數                                 │
├───────────────────────────────────────────────────────────┤
│ D. 終端設備（全部單元一張表）                                  │
│  ┌單元──┬IT kW┬液冷 kW┬CDU 型號▼┬台數┬餘裕┬氣冷 kW┬CRAH 型號▼┬台數┬餘裕┬─┐│
│  │DU-01 │13,632│12,324│CDU2300  │−7+ │12% │2,467 │FWCV40L2A │−6+ │2.5%│✓││
│  │DU-02 │ …                                                          ││
│  │CorePOD-A│ …                                                        ││
│  └──────┴─────┴──────┴─────────┴────┴────┴──────┴──────────┴────┴────┴─┘│
│  [把 DU-01 的 CDU／CRAH 設定套用到所有 DU]                       │
│  ▸ 各單元詳細（獨立設定水溫、非共用單元的主機房設備）             │
└───────────────────────────────────────────────────────────┘
```

### 5.2 各區做法

**A. 全廠設計條件**（新函式 `renderSitePanel()`）
- 輸入框 `onchange` → `AppStore.setSiteCoolingTemp(...)`。FWS 顯示為可編輯欄位（走虛擬鍵）。
- 連動關閉時：這一列變成唯讀摘要「各系統獨立設定」，並顯示目前有幾組不同水溫。
- 現有的預設值按鈕（`applyCduPreset` 的 `'nvidia'`／`'site'`、`applyFwTemps` 的 22/32、12/18 等）搬到這裡。**按鈕上的數值沿用現有程式裡的，不要新增或更改任何溫度數字。**
- 溫度輸入框旁顯示即時算出的自然冷卻門檻（現有公式 `fwsSupplyC − dryCoolerApproachC − pheApproachC`，`view_cooling.js:487`）。

**C. 主機房設備表**（改寫 `renderSharedPlantCard` 的設備區，以及非成員單元的主機房設備）
- 抽一個共用函式 `renderEquipTable(ownerId, sysType, sizingList)`，現有三段幾乎相同的卡片樣板（`:500`、`:596`、`:1208`）全部改呼叫它。
- 一列一台設備。「需求」的長文字（`item.requiredText`）放 `title` tooltip 和列下方可展開的小字，不佔主列。
- Trim 冰機的 Mode 3 檢核（`maxMechanicalPassed`）保留，顯示成該列的第二個狀態標記。
- 泵的三項檢核（`pumpChecks`：馬達、流量、揚程）不合格時在該列顯示哪一項不足。
- 台數：`−`／`+` 按鈕加數字框；`onchange` 才提交（不要 `oninput`）。
- 「自動選型」「★」按鈕（V9 的 `equipToolsHtml`）併進列尾，改成小圖示按鈕。

**型號下拉（D8）**
- 選項文字改成：`★ [廠商] 型號｜單機 2,500 kW｜需 7 台｜餘裕 6%`。
- 「需幾台／餘裕」要用跟引擎一樣的算法。**不要在畫面重寫降額公式**：在 `SizingEngine` 加 `previewOptions(item)`，回傳 `[{ model, requiredUnits, marginPct, feasible }]`，內部重用 `_maybeAutoSelect` 已經抽出的 `derateOf`（`evaluateCduSizing`／`evaluateFwSizing` 評估時把每個項目的預覽結果存到 `item.optionPreview`，畫面只讀）。
- 排序：常用（★）→ 可行且台數少 → 其他。泵的選項顯示流量／揚程是否足夠。
- 選項多的型錄（泵、冰機）在下拉上方加一個文字篩選框。

**D. 終端設備總表**（新函式 `renderTerminalTable(targets)`）
- 每個單元一列，CDU 和 CRAH／RDHX 各一組欄位。
- 「套用到所有 DU」：呼叫 `AppStore.applyToAllUnits(loop, equipKey, {...})`。只套用到**同類型**（DU 對 DU）且該設備負載 > 0 的單元；台數不照抄，改成各單元依自己的負載用同一型號重新算需求台數（`userEdited = false` 讓引擎補）。套用前用 `confirm` 列出會被改的單元。
- 1106 專案有 4 個相同的 DU，這是最常用的操作，按鈕要明顯。

**各單元詳細**
- 預設收合。展開後只放「例外」的東西：獨立設定水溫的開關（成員單元只顯示晶片側三個欄位）、非成員單元自己的架構與主機房設備、示意圖。
- **移除成員單元卡片裡改了沒用的 FWS 面板（S5）。**

**重繪（S6）**
- 這一輪**不要**改成局部更新（風險高、範圍大）。維持整頁重繪，但確認新版面所有輸入框都有固定 `id`，讓既有的 focus／selection 還原（`:64-68`）繼續有效。`−`／`+` 按鈕按完後焦點要留在同一顆按鈕上（給 `id`）。

**Step 5 放行（D7）**
- `app.js:146` 拿掉 `alert` 和 `return`。`canProceedStep4()` 保留，Step 4 頁尾和導覽列用它顯示警示。
- 檢查 `unit_checks.js` 內依賴「被擋住」行為的測試（搜尋 `step5Blocked`、`canProceedStep4`），改成檢查橫幅存在。

### 5.3 i18n 與測試（重要，容易漏）

- Step 4、5 有英文模式 0 CJK 的測試（`I-4`、`I-5`）。**所有新文字都要走 `_t('key', params, '中文預設')`，並在 `i18n_zh.js`、`i18n_en.js` 各加一筆**（兩檔鍵值數量要一致，有測試）。
- 既有 DOM 測試會找特定元素 id（例如 `qty_cdu_<id>_<key>`、`qty_plant_<plantId>_<loop>_<key>`、`cduSecSupplyIn_<id>`、`plantFwsSupplyIn_<plantId>`）。**先 `grep -n "getElementById\|querySelector" unit_checks.js` 列出 Step 4 相關的 id，新版面盡量保留同名 id**；真的要改名，就同步改測試並在 commit 訊息說明。
- 新增 DOM 測試：全廠面板存在；改全廠晶片供水後，終端設備表所有列反映新值；「套用到所有 DU」後 4 個 DU 型號一致；型號下拉選項含需求台數。

### 5.4 驗收

- `node ui_preview.js <1106> 4 out.png --h 3000` 截圖：一個畫面內看得到 A～D 四區，量一下總高度並寫進回報。
- 手動流程（用截圖或 DOM 測試證明）：改一次晶片供水 → 5 個單元＋機房全部更新，PUE 有變化，沒有紅字。
- 回歸：`run.js --compare baseline_after_V9_P3.json` 0 差異（純介面）。

commit：`V10 Phase 8: Step 4 改版（全廠設計條件列、設備表格化、終端設備總表、Step 5 放行）`

> ✅ 結果與偏離：
> - 1106 專案 1400 px 寬、細節收合時，整頁約 3,400 px（原本約 6,000 px）。沒達到 2,500 px 的原因：兩張共用機房卡片保留了成員清單、架構下拉和設備摘要。若要再縮，下一步可把機房卡片也做成可收合。
> - 舊的三段設備卡片樣板（`cduSizingHtml`／`fwSizingHtml`／`sizingHtml` 的迴圈）**仍在程式裡但已不輸出**，留待 9-4 清理。
> - 連動開啟時，共用機房卡片的水溫面板改成一行摘要加「本系統泵揚程」；關閉時顯示原面板。
> - 「全廠冷卻單元即時狀態總覽」小卡改為預設收合（功能由終端設備總表取代）。
> - Trim 冰機 Mode 3 不足、台數 > 20 改成琥珀色提示，不算不合格。
> - 型號下拉排序：★常用 → 可行且台數少 → 其他；沒有出處的型號前面加 ⚠（9-2 已一併完成）。
> - Step 5 不再被擋；Step 4 下一步按鈕在不合格時改成琥珀色並說明。
> - 型號下拉的「需要台數／餘裕」由 `SizingEngine._buildPreview`／`_buildPumpPreview` 在評估時計算，存在 `item.optionPreview`。
> - 測試 V10-P8a～c；unit_checks 286 passed；140 組回歸 0 差異；1106 與基準一致。

> Phase 8 很大。如果做到一半 context 不夠，可以拆成 8a（A 區＋表格化）、8b（終端總表＋套用全部＋型號預覽）、8c（Step 5 放行＋清理），各自 commit。

---

## 6. Phase 9：完整性補強（小項，各自獨立）

| # | 項目 | 做法 | 備註 |
|:--|:--|:--|:--|
| 9-1 | 配電損耗固定部分 | `facilityLoads.lossItems[]` 每項加 `fixedKw`（預設 0）。逐時損耗 = `IT × pct% + fixedKw`；部分負載情境下 `fixedKw` 不隨負載縮放。Step 5 損耗表多一欄。預設 0 → 既有結果不變 | 解決 `pue_v9_report.md` §5 第 3 點。**數值由使用者填，AI 不可填** |
| 9-2 ✅（Phase 8 已做：下拉 ⚠） | 型錄可信度標示 | Step 4 型號下拉和設備表：`_verified === false` 或沒有 `_source` 的型號加「⚠」，tooltip 顯示出處與 `_ai_confidence` | 只做標示，不改型錄 |
| 9-3 | 計算書補「輸入總表」 | Step 6 §2 設計條件加上全廠水溫鏈（晶片供回水、approach、FWS、CHW、自然冷卻門檻），資料來自 `siteCooling`；連動關閉時列出各系統 | 依賴 Phase 7 |
| 9-4 | 清掉殘留 | `coolingPlants[].system` 不再需要的欄位不要刪（舊檔相容），但確認都由 `applySiteCoolingToAll` 維護；`view_cooling.js` 改版後沒用到的函式和 i18n 鍵刪掉（i18n 兩檔要同步刪） | |
| 9-5 | 版本標示 | `app.js` 內的版本字樣（測試會檢查含 `(V33)`，`unit_checks.js:3457` 附近）依該檔慣例更新，同步改測試 | |

commit：每項一個，或合併成 `V10 Phase 9: 完整性補強（…）`。

---

## 7. Phase 10：總驗證與文件

1. 四道檢查全過（§10.2）。
2. 1106 專案前後對照表：PUE、各分項 MWh、設備總表關鍵數量。Phase 6～8 預期 PUE 不變；Phase 9-1 預設值下也不變。
3. 截圖 Step 4、Step 6（新 §5）各一張，確認沒有破版、沒有 `undefined`／`NaN`。
4. 寫 `pue_v10_report.md`（格式比照 `pue_v9_report.md`：結論、前後對照、各 Phase、驗證、待使用者確認、已知限制）。
5. 更新本檔 §9 進度。
6. **不要 push、不要動 `dist/`、不要執行 `build.js`**，等使用者指示。

---

## 8. 需要問使用者的事（執行中遇到才問，一次問完）

1. Phase 8 完成後請使用者看截圖，確認版面方向再做 Phase 9。
2. 型錄裡 York YT 2500kW 等沒有出處的設備：只標示，還是要使用者提供型錄再補？（預設：只標示）
3. 其餘 V9 遺留的待確認事項（損耗數值、損耗熱去向、冰機 COP、泵揚程）見 `pue_v9_report.md` §5，那些是使用者要填的資料，不是程式工作。

---

## 9. 進度

| Phase | 內容 | 狀態 | commit |
|:--|:--|:--|:--|
| 6 | 設備統整 | ✅ 完成 | 見 git log |
| 7 | 水溫連動（資料層） | ✅ 完成 | 見 git log |
| 8 | Step 4 改版 | ✅ 完成（待使用者看截圖確認） | 見 git log |
| 9 | 完整性補強 | 待執行 | |
| 10 | 總驗證與報告 | 待執行 | |

---

## 10. 執行須知（V9 踩過的坑，務必先讀）

### 10.1 環境

- Windows 11，沒有 Python。用 Node v24 和 Git Bash。
- **原始碼是 CRLF 換行**。用 Edit 工具通常沒問題；如果寫 Node 腳本做字串取代，要先把 `\r\n` 轉成 `\n` 比對，寫回時再轉回 CRLF。
- **Git Bash 的 heredoc 和 `node -e "…"` 會吃掉反斜線**（`\n` 變成真的換行，V9 因此弄壞過一個 CSV 字串）。含反斜線或樣板字串的修補腳本，**用 Write 工具寫成 `.js` 檔再執行**，不要用 heredoc。
- 路徑含中文和空白，一律加引號。

### 10.2 每個 Phase commit 前必跑

```bash
cd "/c/Users/30468/Desktop/計算工具/repo_hvac/tools/pue_regression"
node unit_checks.js                                   # 目前 273 passed，只能增加
node run.js --compare baseline_after_V9_P3.json       # 預期 0 差異；有差異要逐項解釋並存新基準
node project_check.js "C:\\Users\\30468\\Desktop\\PUE_Project_高雄 (Kaohsiung)_20261106.json" --compare baseline_proj_kh1106_after_V9.json
```

- **Phase 6 開工第一步**：先存 1106 的新基準（舊的 `baseline_proj_kh1106_before_V9.json` 是 V9 之前的，FC 時數不同）：
  `node project_check.js "<1106 路徑>" --save baseline_proj_kh1106_after_V9.json`，跟 Phase 6 一起 commit。預期 PUE 1.167、尖峰 1.225、冷卻 pPUE 1.082。
- 新增 JS 檔要同時加進 `index.html` 和 `harness.js`（計算模組）或 `dom_harness.js`（畫面模組），順序一致。
- 單元測試加在 `unit_checks.js` 最後的 `console.log(\`\n${passCount} passed…` 那一行**之前**。

### 10.3 截圖

```bash
node ui_preview.js "<專案.json>" <步驟 1-6> "C:\\Users\\30468\\AppData\\Local\\Temp\\out.png" --h 3000 \
  [--js "載入後、切換步驟前執行的 JS"] [--after "切換步驟後執行的 JS"]
```

- **不可以加 `--virtual-time-budget`**（本機 Edge 會卡住並殘留幾十個程序）。
- 腳本已停用 `alert`／`confirm`。Phase 8 新增的 `confirm` 在截圖時會自動回 `true`。
- 做完檢查有沒有殘留的 headless Edge，只殺命令列含 `edge-preview-` 的程序，**不要動到使用者正在用的 Edge**：
  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'edge-preview-' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  ```
- 截圖會產生暫存檔 `public/Data center Cal/_ui_preview.html`，腳本會自己刪；commit 前確認它不在。

### 10.4 程式慣例

- 雙擊 `index.html` 要能用（file://）：不用 ES modules、不用 `fetch` 讀本機檔，全部 `<script>` + `window.X`。
- 工程假設只放 `js/assumptions.js`，附 `label`、`label_en`、`ref`。**不可以自己編工程數值、設備規格、規範條文**；沒有依據就留空並標「⚠ 待確認」。
- 裕度不可重複疊乘。
- 畫面文字走 i18n（Step 1～5 用 `_t()`；`view_report.js` 用自己的 `L(zh, en)`）。
- 計算結果只能由 `AppStore.calculate()` 產生；畫面層只讀 `state.results`，不要在 view 裡重算。
- schema 改版要寫遷移，舊專案載入後結果不可改變。

### 10.5 git

- 每個 Phase 一個 commit，訊息 `V10 Phase <N>: <中文說明>`；修正計算或行為時寫清楚「原本錯在哪、影響多大」。
- commit 訊息結尾加：`Co-Authored-By: Claude <noreply@anthropic.com>`
- 只在本機 commit。push 要先問使用者。
- 每完成一個 Phase 更新本檔 §9，並用幾句話回報使用者（做了什麼、驗證結果、待確認）。
