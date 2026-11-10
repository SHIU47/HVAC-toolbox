# PUE 計算工具 V9 修正升級計畫

> 建立：2026-11-10｜狀態：**執行中**（進度見 §6）
> 接手的 AI 請先讀本檔與 `git log`，再讀 `pue_round7_report.md` 了解前一輪架構。

## 1. 目標

1. 修正會讓 PUE 偏低或結果自相矛盾的計算／統計問題。
2. 耗電項目補齊，可分項調整（數值由使用者自行填入）。
3. Step 4 冷卻系統設計的 UX：自動選對型號、少捲動、記住常用設備。
4. 新增 **Step 6 計算書**：網頁版、可列印 A4 PDF，所有數字可由輸入逐步推導驗證。

## 2. 使用者已決定（2026-11-10）

| 題目 | 決定 |
|:--|:--|
| 主版本 | `計算工具\repo_hvac`（GitHub SHIU47/HVAC-toolbox）；桌面 `PUE計算`（08-07）不再更新 |
| 容量不足處理 | (a) 結果標「不合格」，PUE 照常顯示但加註 |
| IT 負載 | (a) 維持 100% 設計值；另加負載曲線情境，兩者並列 |
| 計算書格式 | (a) 網頁版，可列印 PDF |
| 電力損耗／輔助負載數值 | 使用者自行調整；程式提供分項欄位，預設值維持現況總量並標 ⚠ 待確認 |

驗證用專案檔：`C:\Users\30468\Desktop\PUE_Project_高雄 (Kaohsiung)_20261106.json`（不進 git），以及 repo 內 `projects/PUE_Project_高雄 (Kaohsiung)_20260901.json`。

## 3. 現況檢查結果（V9 修正前）

### 3.1 兩份高雄專案實跑

| 項目 | 0901 版 | 1106 版 |
|:--|--:|--:|
| IT 設計負載 | 17,952 kW | 57,228 kW |
| 年 PUE / 尖峰 PUE | 1.162 / 1.183 | 1.167 / 1.225 |
| pPUE（現行定義，不含泵） | 1.087 | 1.055 |
| 電力損耗率 | 4.5% | 8.5% |
| 冰機 MWh | 9,454 | 14,797 |
| CDU 本體 + 一次泵 MWh | 4,795 | 13,382 |
| 排熱 MWh | 2,185 | 7,236 |
| CRAH 風扇 MWh | 1,999 | 5,452 |
| 容量不足時數 | **8,760 h（最大缺 336 kW）** | 0 |
| 熱平衡 | **未閉合 1,911 MWh** | 閉合 |
| 顯示的自然冷卻時數 | 8,760 h（100%） | **8,748 h（99.9%）**，但氣冷側實際只有 275 h 全自然冷卻 |

基準檔：`tools/pue_regression/baseline_proj_kh0901_before_V9.json`、`baseline_proj_kh1106_before_V9.json`、`baseline_after_R8_pumps.json`（140 組）。

### 3.2 問題清單

| # | 問題 | 位置 | 影響 | 處理 Phase |
|:--|:--|:--|:--|:--|
| C1 | 容量不足時 PUE 照算、沒有標示，沒移走的熱也沒有對應的耗電 | `simulation/annual_runner.js` | PUE 偏低、結果不可信 | 1 |
| C2 | 熱平衡沒閉合時畫面沒有警告 | 同上 `thermalLedger` | 同上 | 1 |
| C3 | `overall.fcHours` 只取液冷側；頂部 KPI 顯示的 FC% 是錯的 | `annual_runner.js:1083` 附近 | 誤導 | 1 |
| C4 | pPUE 沒算泵和 CDU 的耗電，跟一般定義（全部冷卻耗電）不同 | `annual_runner.js:983`、`:1003`、`:1119` | 誤導 | 1 |
| C5 | Round 7 報告的方案比較：共用機房的泵耗電從 7,879 跳到 60,670 MWh，疑似重複計算 | 共用機房 / scenario | — | 1：**已無法重現**。用 0901 專案重建三種配置，CDU＋泵耗電都在 4,795～4,915 MWh（R8 修泵時已解決），不改程式 |
| C6 | 冰機 COP 上限 20，要驗證是否偏樂觀 | `engines_chiller.js:30` | ⚠ 待驗證 | 1：新增 `overall.chillerCopStats`。1106 版：季節 COP 5.48，最低 4.31，最高 10.75，COP > 10 共 161 h；型錄額定 COP 4.07（XCAF2524A），但尖峰時段最低值 4.31 仍高於額定，⚠ 待使用者對照型錄部分負載資料。模型不改 |
| C7 | IT 全年固定 100%，沒有部分負載情境 | `annual_runner.js:59` | 年 PUE 偏低 | 2 |
| C8 | 電力損耗只有一個比例，非 IT 輔助負載（照明、辦公空調、MAU 等）沒有獨立項目 | `assumptions.js:399`、`store.js` | 偏低 | 2 |
| C9 | 水力帳本未實作（`no_flow_head_model_yet`），揚程用預設值 | `annual_runner.js`、`sizing_engine.js` | 沒有依據 | 4（計算書列出流量、揚程、效率和出處） |
| U1 | 預設型號寫死成小設備（水冷冰機 500 kW、泵 3/5.5/11 kW），MW 級系統會變成幾十到上百台 | `cooling/archs/*.js` `defaultModel`/`calcQty` | 選型不合理 | 3 |
| U2 | 數量輸入上限 50 台 | `views/view_cooling.js` | 無法輸入 | 3 |
| U3 | Step 4 卡片全部展開，要捲動很久 | `views/view_cooling.js` | UX | 3 |
| U4 | 沒有常用設備／上次選型的紀錄 | — | UX | 3 |

## 4. 各 Phase 做法

每個 Phase 一個 commit，訊息格式 `V9 Phase <N>: <中文說明>`。

### Phase 0：基準與檢核工具 ✅
- 新增 `tools/pue_regression/project_check.js`：載入專案檔 → 印出分項耗電、FC 統計、容量／熱平衡檢核，可用 `--save` / `--compare`。
- 存修正前基準（見 §3.1）。

### Phase 1：計算與統計修正（C1～C6）✅
> 結果：PUE 數值不變（140 組回歸和兩份專案都一致），只有全廠 FC 時數改成正確值（1106：8,748 → 275 h；0901：8,760 → 0 h）。新增 `overall.compliance`、`annualCoolingPpue`／`peakCoolingPpue`、`chillerCopStats`、`fcBasis`、`cdu*ModeHours`。儀表板加上合格判定橫幅（取代原本只看冰機的容量不足警示）。Excel 的合格判定移到 Phase 4 與計算書一起做。
- C3：`overall` 改為同時提供液冷、氣冷、全廠三組 FC 統計；頂部 KPI 和儀表板顯示全廠值，並標明定義（全自然冷卻＝兩側同時為 free）。
- C4：pPUE 改為 (IT + 全部冷卻耗電，含 CDU 與泵) / IT；舊的「不含泵」值改名保留，方便對照。
- C1/C2：結果物件新增 `compliance`（容量不足時數、最大缺口、熱平衡差、是否合格）；儀表板、Excel、計算書顯示「不合格」橫幅，PUE 旁加註。
- C5：用 0901 專案依報告重建三個方案；能重現就修，並在 commit 訊息寫明影響。
- C6：只加 COP 分布統計和警告，不改模型。
- 驗證：`unit_checks.js` 全過；140 組回歸的 PUE 差異只能來自 C4/C5，其他要一致；兩份專案的 PUE 不變（只改統計和標示）。

### Phase 2：耗電項目與 IT 負載情境（C7、C8）✅
> 結果：
> - schema 升為 `v8`，新增 `facilityLoads`（lossItems：transformer／ups／pdu／other，各有 pct 和 heatToAir；auxLoads：lighting／officeHvac／mau／other，單位 kW）和 `itLoadScenario`（enabled、factorPct）。舊欄位 `facilityElectricalLossPct` 保留，數值＝各分項合計；舊程式碼直接改這個欄位時，差額會自動補到 other。
> - 引擎：損耗分成「熱進入氣冷區」（`lossKw`）和「只計耗電」（`lossNoHeatKw`）兩部分；輔助負載為 8,760 h 定值，計入 `breakdownKwh.loss`，明細在 `breakdownKwh.lossDetail`；熱平衡只算熱進入氣冷區的部分。Excel 的逐時損耗公式改為 `IT × 損耗率 + 輔助負載`，需排除的熱量改用熱進入氣冷區的損耗率。
> - 部分負載情境：`AnnualRunner.run(..., { itLoadFactor })`，先以 100% 負載 bridge（選型、水力），再縮放負載進行模擬；結果放在 `results.partialLoad`，儀表板「損耗分項、輔助負載與 IT 負載情境」區塊並列顯示。
> - 驗證：PUE 不變（140 組回歸、兩份專案）；unit_checks 268 passed（新增 V9-P2a～d）。1106 專案：100% 負載 1.167；90% 1.159；70% 1.153；50% 1.160。
> - ⚠ **待使用者決定**：配電損耗按 IT 比例計算，沒有模擬變壓器空載損失與 UPS 低負載效率曲線，因此部分負載的 PUE 會偏低。是否要在分項加上「固定部分（kW）＋比例部分（%）」，由使用者決定。
> - 只做固定負載率；24 h 負載曲線需要改寫逐時快取（目前依乾濕球快取），暫不做。
> - 新增 `tools/pue_regression/ui_preview.js`：載入專案後用 Edge headless 截圖指定步驟（會停用 alert，且不能加 virtual-time-budget）。
- 電力損耗拆成變壓器、UPS、PDU／配電三項（%，隨 IT 負載變化），另外加固定負載 kW：照明、辦公／支援空調、MAU／除濕、其他（BMS、發電機加熱器等）。
- **向下相容**：舊專案只有 `facilityElectricalLossPct` 時，全部歸到「其他配電損耗」，結果不變。新欄位預設值維持現況總量，UI 標「⚠ 待確認，請依案場電力設計填入」。
- 每一項可設定「熱是否進入空調區」（預設維持現況：全部進入氣冷側）。
- IT 負載情境：除了 100% 設計值，可再設定固定負載率（例如 70%）或 24 h 曲線；儀表板和計算書兩組結果並列。
- 會改 schema（新增欄位、版本號 +1），已在本計畫取得同意。

### Phase 3：Step 4 UX（U1～U4）✅
> 結果：
> - `SizingEngine._maybeAutoSelect`：非泵設備依「運轉台數 > 8 排後 → 超量比 > 2 排後 → 上次選型 → 常用設備 → 台數最少 → 超量比最小」挑型號（降額依各設備原本的降額公式）。觸發條件只有兩種：新建立的選型項目（`autoSelectRequested`），或按下「自動選型」。**既有專案存好的型號不會被改**（兩份高雄專案的結果不變）。
> - 數量上限 50 → 999；超過 20 台時提示改選大型號。
> - 系統示意圖改成 `<details>`，預設收合；共用機房卡片加一行設備摘要（✓／✗ 型號 × 台數）。
> - 常用設備（★）與上次選型存在 `equipmentPrefs`（專案檔＋localStorage `pue_equipment_prefs`）。
> - 影響：140 組回歸的 PUE 全部下降 0.001～0.019，主要原因是預設 CDU 從 CoolIT 100 kW × 11 台（型錄耗電 4.2 kW/台）改成 CoolIT CHx1200 × 2 台（35 kW/台），每 kW 散熱的 CDU 耗電較低。新基準：`baseline_after_V9_P3.json`。預設專案 PUE 1.179 → 1.164（相關單元測試已改為新數值，並註明原因）。
> - ⚠ 待確認：CDU 型錄中只有 CDU2300 附出處，其他 CDU 的 power_kw 都沒有出處。自動選型會依這些數值比較，所以型錄數值的可信度會直接影響結果。
> - 沒有做：卡片整張收合（示意圖收合後高度已大幅減少，所以先不做）。
- 自動選型：在型錄中挑「降額後能滿足需求、台數最少」的型號，同台數再比效率；拿掉寫死的 500 kW 和小泵預設。
- 數量上限改成 999；台數超過 20 台時提示「建議改選較大型號」。
- 每個系統卡片可以收合，收合時一行顯示：型號 × 台數、有效容量／需求、合格與否；預設只展開不合格的卡片。
- 常用設備：每類設備可以加星號存成常用；「沿用上次選型」會套用同一類系統最近一次的選型。存在專案裡，也存在 localStorage。

### Phase 4：Step 6 計算書 ✅
> 結果：新增 `js/views/view_report.js`（導覽列第 6 步「可驗證計算書」）。封面欄位存在 `state.reportMeta`，隨專案儲存。章節依下列規劃，另加 §10「待確認事項」，會依專案狀態自動列出。列印時隱藏頁首和工具列，A4 直式。§9 驗算範例取 PUE 最高的小時，手算結果與引擎一致（單元測試 V9-P4 檢核誤差 < 0.05 kW）。Excel「計算基準」工作表加了「合格判定」列。附錄 B 的逐時 CSV 沿用儀表板的 `download8760DetailedCsv`。
> 注意：Step 6 不受 Step 5 的 N+1 阻擋（不合格的專案也能看計算書，封面會蓋「不合格」）。
新增 `js/views/view_report.js`，導覽列加第 6 步，提供 A4 列印 CSS。章節：
1. 封面與簽核欄（專案名稱、案號、文件編號、版次、業主、計算／審核／核准、日期都可編輯，存在專案裡）
2. 設計依據與標準（ASHRAE TC 9.9、ASHRAE 90.4、ISO/IEC 30134-2/-9、AHRI 550/590、CTI）
3. 設計條件：氣象資料來源、設計點（0.4% / n=20 年，寫明採用哪個）
4. 負載彙總：Hall／DU／SU／CorePOD，液冷／氣冷拆分
5. 假設值總表：`assumptions.js` 全部列出，附出處；使用者改過的值另外標示
6. 各系統選型核算：需求 → 降額係數 → 單機有效容量 → N / N+1 → 判定
7. 水力與泵耗：Q = ρ·cp·V·ΔT 求流量 → 揚程 → η_pump × η_motor → kW，列出代入的數值
8. 8,760 h 能量帳本：月別表、運轉模式時數、冰機 COP 分布
9. PUE / WUE 計算：依 ISO/IEC 30134-2 / -9 的公式，代入年總量
10. 檢核：能量平衡、熱平衡、容量不足、警告清單
11. 驗算範例：挑尖峰時刻做一次完整的手算推導
- 附件：逐時 8,760 h CSV 下載，讓審查方可以用 Excel 自行重算。

### Phase 5：總驗證與文件
- 全部檢核、兩份專案前後對照表、Edge headless 截圖檢查 Step 4／Step 6；寫 `pue_v9_report.md`。

## 5. 驗證方式（每個 Phase）

```
cd tools/pue_regression
node unit_checks.js
node run.js --compare baseline_after_R8_pumps.json      # 差異要能逐項解釋
node project_check.js "<1106 專案路徑>" --compare baseline_proj_kh1106_before_V9.json
node project_check.js "../../public/Data center Cal/projects/PUE_Project_高雄 (Kaohsiung)_20260901.json" --compare baseline_proj_kh0901_before_V9.json
```
有預期內的差異時，存新基準 `baseline_after_V9_P<N>.json`，並在 commit 訊息說明原因和影響大小。

## 6. 進度

| Phase | 狀態 | commit |
|:--|:--|:--|
| 0 | ✅ 完成 | 見 git log |
| 1 | ✅ 完成 | 見 git log |
| 2 | ✅ 完成 | 見 git log |
| 3 | ✅ 完成 | 見 git log |
| 4 | ✅ 完成 | 見 git log |
| 5 | 待執行 | |

## 7. 注意事項
- 不要動 `dist/`，不要執行 `build.js`（部署由使用者決定）。push 前要先問使用者。
- 工程假設集中放在 `js/assumptions.js`，附 label 和出處；裕度不要重複疊乘。
- 有修改 `device_catalog/**/*.json` 時，要執行 `node device_catalog/build_builtin.js`。
- 中英 i18n 鍵值要同步（`i18n_zh.js` / `i18n_en.js`）。
