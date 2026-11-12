# PUE V11：設備型錄併入計畫（_extracted → device_catalog）

> 狀態：**計畫草案，待使用者確認「待決定事項」後才開始動程式**
> 建立：2026-11-12（Opus 5.5）
> 前一份計畫：`PUE_V10_設備統整與Step4改版計畫.md`（Phase 9、10 尚未做，與本計畫互不衝突）

## 1. 目標
把使用者經 AGV 從 `C:\Users\30468\Desktop\設備資訊` 抽取、並由 Claude 抽查過的設備資料，併入 Data center Cal 的設備型錄，讓 Step 4 可以選到**有出處、已核對**的真實型號，並在報告（Step 6）中顯示出處。

## 2. 現況

### 2.1 已抽取的資料（`C:\Users\30468\Desktop\設備資訊\_extracted\`）
| 檔案 | 筆數 | 內容 | 抽查結果 |
|:--|--:|:--|:--|
| `01_cdu.json` | 43 | CDU（一次側/二次側水溫、容量、耗電、泵） | 已抽查 |
| `02_chiller.json` | 75 | 冰水主機（額定 COP、IPLV/NPLV、部分負載、FC 盤管） | 已抽查 |
| `03_cooling_tower.json` | 37 | 開放式/密閉式冷卻水塔（WB、排熱、風扇、噴淋泵） | 已抽查 |
| `04_dry_cooler.json` | 17 | 乾冷器（DB、排熱、風扇、部分負載、全年資料） | 已抽查 |
| `05_06_crah.json` | 64 | 風牆 33、AHU 8、CRAC DX 23 | 已抽查 |
| `07_08_inrow_rdhx.json` | 24 | InRow CHW/DX、WCDX、RDHx 主動/被動 | 已抽查；ACRC301H 原廠表流量與冷量差 +12.6% ⚠ |
| `10_pump.json` | 2 | Grundfos NK（數值取自圖片） | ⚠ 待使用者看圖確認 |

格式統一為 `{model, vendor, doc_type, rating{…設計工況}, values{…數值}, part_load[], check{}, src, notes[]}`。

### 2.2 程式端型錄（`device_catalog/`）
- 各類別檔案格式不一致（以型號名稱為 key 的物件、或 `models` 陣列），由 `js/catalog_manager.js` 的 `mergeVendorData()` 依類別轉成引擎用欄位（`capKw`、`cop`、`fanKwDx`、`approachC`、`fanPowerKw`、`powerKw`…）。
- 同名型號會被 `upsertItem()` 覆蓋合併。
- 雙擊（file://）時使用 `js/device_catalog_builtin.js`，改 JSON 後要執行 `node device_catalog/build_builtin.js`。
- 大部分既有資料標 `_verified: false`；部分為泛用值，沒有出處。

## 3. 做法（建議）
1. **不手改既有型錄檔**。寫一支轉換腳本 `device_catalog/tools/import_extracted.js`，讀 `_extracted/*.json` → 輸出 `device_catalog/verified/<類別>.json`，格式採用各類別**現有的程式格式**（讓 `mergeVendorData()` 不必大改）。原始 `rating / part_load / src / notes` 全部保留在記錄中。
2. 每筆加 `_verified: true`、`_source`（原始 PDF 檔名＋頁碼）、`_extracted_from`（_extracted 檔名）、`_flags`（⚠ 項目）。
3. 型號名稱加上工況標記，避免和既有同名型號互相覆蓋。例如 `Vertiv FA080HW 320kW (CW 30/40)`。
4. 同時產出**比對報告** `device_catalog/verified/_import_report.md`，內容包括：每個類別的筆數、略過的筆數與原因、跟既有同名或近似型號的數值差異（例如既有 BAC FXV3 和新抽取資料的風扇 kW、approach 對照）。
5. 腳本可以重複執行。之後 AGV 新增或修正資料，重跑一次就能更新。

### 3.1 類別對應（⚠ 需要對照程式確認，Phase 1 先查清楚）
| 抽取類別 | 引擎類別 | 主要欄位對應 |
|:--|:--|:--|
| CDU | `cdu` | capacity_kw→capKw、power_kw→powerKw、approach_c |
| 冰水主機 | `chiller_water` / `chiller_air` | cooling_capacity_kw→capKw、cop、iplv、chws/cond 工況、part_load |
| 冷卻水塔 | `cooling_tower` | heat_rejection_kw(_per_unit)→capKw、fan_kw→fanKwDx、approach_c、tower_type、wb_c |
| 乾冷器 | `dry_cooler` | heat_rejection_kw_per_unit→capKw、fan_kw→fanKwDx、approach_c、design_db_c |
| 風牆 / AHU | `crah` | total/sensible_cooling_kw→capKw、fan_power_kw→fanPowerKw、chw_in/out |
| CRAC DX、InRow DX | ⚠ 目前引擎沒有對應類別 | 先收進 verified 檔，不顯示在選單 |
| InRow CHW | `crah`（⚠ 待確認是否另開類別） | 同風牆 |
| WCDX | `wcdx`（既有 `wcdx.json` 格式：operating_points[]） | |
| RDHx | `rdhx` | total_cooling_kw→capKw、fan_power_kw→fanPowerKw |
| 泵 | `pump` | motor_rated_kw→capKw、design_flow/head、pump/motor efficiency |

**capKw 統一採「單台」額定值**。選型報告中多台合計的數值，用 `units_in_selection` 換算成單台後再填入。

### 3.2 匯入條件
- 只匯入關鍵欄位齊全的記錄：容量加上耗電（或 COP、風扇 kW）。缺任何一項就略過，並寫進報告。
- 數值取自圖片（nVent RDHx 4 筆、Grundfos NK 2 筆）：**等使用者確認後才匯入**。
- `check` 不通過的記錄（例如 ACRC301H）：照型錄值匯入，在 `_flags` 標 ⚠，報告中列出。

## 4. 不改變既有結果的保證
- 既有專案是用 `selectedModel` 名稱記錄所選型號。新型號名稱不同，所以**舊專案載入後結果不會變**。
- 唯一的風險是**自動選型**（`_maybeAutoSelect`／`defaultModelIndex`）：如果候選清單變多，新專案或「重新自動選型」可能選到新型號。處理方式見待決定事項 2。
- 驗證方式：`unit_checks.js` 全部通過、`run.js --compare baseline_after_V10_A.json` 差異為 0、泰國兩案載入後 PUE 不變。

## 5. 分階段（每個 Phase 一個 commit，訊息 `V11 Phase <N>: …`）
| Phase | 內容 | 修改的檔案 | 驗證 |
|:--|:--|:--|:--|
| 1 | 轉換腳本＋verified 檔＋比對報告（**不接進程式**） | `device_catalog/tools/import_extracted.js`、`device_catalog/verified/*` | 人工看報告；使用者確認對應是否正確 |
| 2 | 接進程式：`catalog_index.json` 加入 verified 檔，`catalog_manager.js` 補新欄位對應，重建 builtin | `catalog_index.json`、`js/catalog_manager.js`、`js/device_catalog_builtin.js` | unit_checks、run.js 差異 0、file:// 雙擊確認選單 |
| 3 | UI／報告：選單中已核對型號標 ✔ 並排在前面，Step 6 設備表顯示出處與 ⚠ | `js/views/view_cooling.js`、`js/views/view_report.js`、`js/equipment_schedule.js`、i18n | dom_harness 測試＋截圖 |
| 4 | 泰國兩案改用已核對型號重算，列出 PUE 變化與原因 | 不改程式；產出 `PUE_V11_泰國案重算報告.md` | 數值對照表 |
| 之後 | 用 part_load 實測曲線取代引擎的預設曲線（V10 計畫的 B 項） | 另開計畫 | |

## 6. 待決定事項
1. **舊的未核對型號怎麼處理**
   - (a) **保留，但在選單中標「未核對」並排在後面**（建議；舊專案不受影響）
   - (b) 從選單隱藏，只保留給舊專案載入
2. **自動選型能不能選到新型號**
   - (a) **可以，但只從「已核對」型號中選**（建議；新專案預設就用真實資料，舊專案不受影響）
   - (b) 維持現狀，新型號只能手動選
3. **CRAC DX、InRow DX 這類引擎還沒有對應類別的設備**
   - (a) **這次只收進 verified 檔，不加新類別**（建議；需要的話之後另開計畫）
   - (b) 這次一起新增 DX 類別（需要改引擎，範圍較大）

### 6.1 使用者決定（2026-11-12）
1 → (a) 保留舊型號、標「未核對」排後面；2 → (a) 自動選型只從已核對型號選；3 → (a) DX 類只收進資料檔。

## 7. 進度
| Phase | 狀態 | commit |
|:--|:--|:--|
| 1 | ✅ 完成（2026-11-12） | 見 git log `V11 Phase 1` |
| 2 | 未開始 | |
| 3 | 未開始 | |
| 4 | 未開始 | |

## 8. Phase 1 結果（2026-11-12）

- 重跑指令：`node device_catalog/tools/import_extracted.js "<_extracted 資料夾>"`（在 `public/Data center Cal` 下執行）
- 產出：`device_catalog/verified/` 的 `chiller.json` 72、`cooling_tower.json` 37、`dry_cooler.json` 8、`cdu_xdu.json` 10、`crah.json` 23、`rdhx.json` 9，合計 **159 筆**；未匯入 103 筆列在 `_unmapped.json`，原因與同型號比對見 `_import_report.md`。
- 換算規則：
  - capKw 一律取單台值。
  - 良機 LCC-S 的型錄只列流量，排熱量以 1.163 × 流量 × ΔT 換算，並標 `_derived`。
  - 冰機缺 COP 但有冷量和耗電時，COP = 冷量 / 耗電，並標 `_derived`。
  - 冰機 `cop_curve: {type:'fixed'}`：依壓縮機型式套用 AHRI 曲線，並以本機額定點歸一化。
  - 乾冷器 `fan_kw_dx` 取選型點（設計外氣、額定排熱）的實際風扇功率。引擎在設計負載時把它當 100% 轉速點，兩者語意一致。
- 人工排除：XCAF1212A [CHW 25/35] 是依「需求冷量 1000 kW」計算的運轉點，不是滿載額定，EER 6.15 屬於部分負載值，所以不匯入（寫在腳本的 `MANUAL_EXCLUDE`）。

### 8.1 和舊型錄比對的重要差異（舊檔未修改）
| 型號 | 舊型錄 | 已核對 | 判斷 |
|:--|:--|:--|:--|
| BAC FXV3-1426-28D-40 風扇 | 11.3 kW（用他案逐時表 WB 27.3 °C、70.5% 轉速反推） | **30.0 kW**（CTI 認證選型報告，WB 29 °C 全速，排熱 2,888 kW） | 舊值低估約 2.7 倍；以已核對值為準 |
| Schneider DSAF1200A 風扇 | 46.6 kW（83.1% 轉速反推 100%） | 28.7 kW（選型點實際值） | 引擎以設計負載點作為 100% 轉速點，應採選型點實際值；舊值偏保守 |
| Uniflair FWCV 風牆容量 | 202.7 kW 等（總冷量） | 192.5 kW 等（顯熱） | 新版以顯熱選台數（IT 負載為顯熱），台數會略增 |
| Vertiv CM40xx、XCAC/XCAF、TDFS1238N、CDU2300 | — | — | 數值一致 |

### 8.2 計畫外發現（記錄，未修改）
1. `js/store.js` 的 `resolveChillerFromSizing()` 沒有把型錄的 `t_cewt_design_c` 傳給 ChillerEngine，引擎一律用預設值（氣冷 35 °C、水冷 30 °C）當額定冷凝溫度。已核對資料中，額定外氣不是 35 °C 的機型（Mitsubishi i-FR2 40 °C、King Sun 31.5 °C）會受影響。建議在 Phase 2 一併修正（只影響選用這些新型號的專案，舊型錄沒有填這個欄位）。
2. 密閉式水塔噴淋泵耗電用的是假設比例 `closed_tower_spray_pump_kw_per_kw`（約 5.5 W/kW），沒有讀型錄值。型錄實際值：BAC FXV3-1426-28D-40 為 11/2888 = 3.8 W/kW，良機 LCC-S-50 為 1.49/227 = 6.6 W/kW。改用型錄值屬於 B 項，之後另外處理。
3. 抽取檔中有 25 筆風牆（STULZ CyberWall 等）缺風扇功率，32 筆 Motivair MCDU 缺耗電，都沒有匯入。要補的話，需要找原廠更完整的資料。
