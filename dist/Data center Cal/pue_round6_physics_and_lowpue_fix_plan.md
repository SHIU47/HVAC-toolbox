# PUE/WUE 8760h 計算書物理模型驗算與偏低修正計畫 (Round 6 Physics & Architecture Audit Plan)

> **目標讀者 / 執行代理**：Claude Opus 5.5 / Gemini Flash 3.8 / Antigravity 程式碼修正代理
> **適用專案版本**：`Data center Cal`（當前 Commit 狀態：`065e1cb`，已完成 Round 4 氣象整合、尚未套用 Round 5）
> **文件目的**：本文件針對「案前架構設計 PUE 計算結果普遍偏低」進行完整熱力學、流體力學與電力鏈路驗算，定位出 **6 大核心物理低估根因（P0/P1）**、**3 項型錄與契約錯位（P1-CAT）** 以及 **6 項 Excel 計算書 / Dashboard 顯示失真（P1-XLS/UI）**，並提供精確至 `檔案:行號` 的可直接替換程式碼區塊與量化迴歸測試基準。

## 0. 代理執行守則 (Execution Guardrails for Claude Opus 5.5 / Flash 3.8)

1. **禁止破壞既有模組契約**：

   * 所有新增物理常數一律集中註冊於 `js/assumptions.js`，透過 `A('key')` 讀取，**嚴禁在各引擎或 Stage 內新增魔術數字 (Magic Numbers)**。

   * 保持 `CoolingStages`、`CoolingArchRegistry`、`AnnualRunner`、`SizingEngine` 與 `AppStore` 的公開函式簽章向後相容。

2. **禁止無條件覆寫使用者既有專案設定**：

   * 當開啟新專案時，`facilityElectricalLossPct` 預設值改為 `A('electrical_loss_default_pct')`（`4.5%`）；若使用者於 UI 主動將損耗設為 `0%`，必須允許保留 `0%` 並正確序列化至 JSON。

3. **保護既有 `PUE_Round5_Release_Plan.md` 的致命陷阱**：

   * 原 `PUE_Round5_Release_Plan.md` 的 **Task R-1** 要求將 `schneider.json`（額定 `t_chws_c: 20.0°C`）與 `vertiv.json`（額定 `t_chws_c: 9.0°C`）由 `{ "type": "fixed" }` 改為 `{ "type": "ahri_biquadratic", "preset": "air_cooled_vfd_centrifugal" }`。

   * **關鍵物理陷阱**：`js/engines_core.js:68-73` 在載入時將所有 `AHRI_PRESETS` 曲線歸一化於 `t_chws = 7.0°C, t_cond = 35.0°C`。若未在 `ChillerEngine.calcPower` 針對冰機自身的額定水溫 `ch.t_chws_design` 進行二次歸一化，直接套用 `R-1` 會導致 `Uniflair XCAC/XCAF` 在 `20°C` 供水時被重複計算一次 `7°C → 20°C` 的減載增益（`EIR_FT = 0.695`），使 `35°C` 滿載 COP 從額定 `4.24` 虛胖 +44% 至 `6.10`！**務必先執行本計畫 Task P0-C2，再執行型錄更新。**

4. **每完成一個 Task 必須執行的驗證指令**：

   * 執行 `node tests/regression/unit_checks.js` 與 `node tests/regression/run.js`（或本文件第 4 節提供的獨立驗算腳本），確認所有斷言全數通過且無 `NaN` / `Infinity`。

5. **Markdown 與 Canvas 規範**：

   * 修改後匯出的計算書與測試報告須保持繁體中文工程術語一致。

## 1. 為什麼目前設計出來的 PUE 都偏低？— 根因診斷與量化影響總覽

經由在沙盒環境對全系統 20 種液冷/氣冷架構組合、7 個內建氣候測站及真實專案檔 `projects/PUE_Project_高雄 (Kaohsiung)_20260901.json`（17.95 MW IT）進行逐行程式碼與 8,760 小時物理追蹤，確認造成 PUE 系統性偏低的 **6 大物理根因** 如下表：

| 優先級與編號 | 問題根因摘要 | 主要發生位置 (`file:line`) | 物理機制與低估原因 | 單項對全年 PUE 低估幅度 | 
| ----- | ----- | ----- | ----- | ----- | 
| **P0-E1** | **廠務電力轉換損耗預設 `0.0%`、存檔遺失且遺漏機房散熱耦合** | `js/store.js:56, 209-227, 321-407` | 1\. `facilityElectricalLossPct` 預設為 `0.0%`，使計算出的 PUE 退化為純機械冷卻指標 $1 + \text{CLF}$，遺漏變壓器 + Online UPS + PDU 轉換損耗（典型 `4.0%~4.5%`）與照明/BMS 輔助功耗（`~0.5%`）。  2\. `serializeProject` 與 `deserializeProject` **漏存 `facilityElectricalLossPct`**，導致使用者在 Step 5 設定電力損耗後，只要觸發自動存檔重整或匯出 JSON 再匯入，損耗立刻歸零！ | **-0.055 \~ -0.062 PUE 點**  （含室內配電發熱對氣冷空調的二次負載 +0.008） | 
| **P0-F1** | **自然冷卻模式將排熱風扇額定功率直接腰斬 (`fan_kw_fc = 0.5 * fan_kw_dx`)，且缺乏溫差變頻調速** | `js/store.js:1197`  `js/cooling/stages/stage_dry_cooler.js:44`  `js/cooling/stages/stage_adiabatic.js:50`  `js/cooling/stages/stage_evap_tower.js:40` | 1\. `resolveTowerFromSizing` 在型錄無 `fanKwFc` 時強制設為 `fanKwDx * 0.5`。  2\. 乾冷器與絕熱塔在 `w.db <= freeThresh`（溫水液冷全年 **97%\~99.9%** 時數）傳入 `is_fc = true`，導致即使外氣高達 `33°C~35°C`（逼近設計極限，風扇必須 100% 全速運轉才能維持 `5°C` 趨近溫差），風扇功耗仍被直接砍半！  3\. `stage_chain.js:176` 在 `dry_cooler_trim` 模式傳給乾冷器的排熱量為 `Q_kw` 而非包含冰機壓縮機功的 `Q_kw + compressorKw`。 | **-0.004 \~ -0.012 PUE 點**  （排熱風扇全年耗電被低估 18% \~ 45%） | 
| **P0-T1** | **終端設備 (`CDUEngine` / `CRAHEngine`) 將高溫降額與 N+1 備援裕度直接帶入三次方親和律 (**$s^3$**)** | `js/engines_cdu.js:23-31`  `js/engines_crah.js:21-29`  `js/store.js:1167-1184` | 1\. 當一次側供水 `fwsSupplyC = 37~42°C` 高於標稱 `30°C` 時，`SizingEngine` 因板交驅動溫差縮小將 CDU 單機容量降額（`derateFactor = 0.76~0.86`）並增加台數。但水流量 $\dot{m} = Q / (c_p \Delta T)$ 僅取決於熱量與溫差，不會因板交面積降額而減少！  2\. `resolveCduFromSizing` 未將 `derateFactor` 傳給 `CDUEngine`，使 `CDUEngine` 用未降額的總標稱容量作分母計算 `plr`，再直接三次方 `speed³`，導致因高溫降額而多配 CDU 時，水泵功耗反而被不合理削減 **33% \~ 53%**，且 `cduDeficitKw` 永遠為 `0`！  3\. `CRAHEngine` 將最低風速設為 `0.30`，在小負載 N+1 配置（如 2 台跑 61% 負載）時直接算出 $0.61^3 = 0.227$，低估機房維持氣流組織所需的基本風機轉速（`0.65~0.70`）。 | **-0.004 \~ -0.009 PUE 點**  （CDU 內建泵與 CRAH 風機耗電被低估 25% \~ 48%） | 
| **P0-C1** | **氣冷式冰水主機 (`air_cooled_chiller`) 無條件啟用串聯自然冷卻盤管 (`fc_coil`)** | `js/cooling/archs/air_air_cooled_chiller.js:84-115` | `air_cooled_chiller` 架構無條件掛載 `fc_coil` Economizer Stage。然而型錄中 `Carrier 30XA`、`York YVAA`、`Trane CGAF`、`Vertiv CoolLoop` 及 `Uniflair XCAC`（型錄明載：`XCAC=純氣冷不含Economizer；XCAF=內建自然冷卻盤管版`）均無水側自然冷卻盤管！當使用者設定中溫冰水 `20/30°C`（如高雄專案 DU-01）時，`mechThresh = 26°C`，讓純機械氣冷冰機在高雄無中生有獲得全年 **3,440 小時 (39.3%)** 的免費預冷！ | **-0.002 \~ -0.018 PUE 點**  （在中高溫 CHW 氣冷系統低估冰機耗電達 15%\~35%） | 
| **P0-C2** | **冰機 Carnot 揚程修正過度樂觀 (最高 2.0 倍 COP)、忽略氣冷冷凝風扇佔比、且額定水溫未歸一化** | `js/engines_chiller.js:22-29, 79-112`  `js/engines_core.js:68-73`  `js/catalog_manager.js:40-56` | 1\. 內建 13 款冰機與 Schneider/Vertiv 型錄皆使用 `cop_curve: { type: 'fixed' }`，觸發 `carnotLiftFactor`（上限高達 `2.0x`）與線性部分負載 `current_fplr = [0, 1, 0]`（零固定寄生損耗）。  2\. 在 `liquid_water_chiller`（`42°C` 供水）下，`Trane RTHD`（`COP=6.5`）全年被乘上 `2.0x` 變成 **COP = 13.0**！  3\. 氣冷冰機總功耗含約 `25%` 冷凝風扇功耗（見 `schneider.json:82`），風扇功耗不隨蒸發/冷凝 Carnot 壓差等比例下降；原公式使 `Uniflair XCAC` 在 `22°C` 外氣時 COP 暴增 +86.7% 至 `7.92`。  4\. `AHRI_PRESETS` 固定以 `7°C` 歸一化，未對 `ch.t_chws_design`（如 `20°C`）重新歸一化。 | **-0.008 \~ -0.045 PUE 點**  （水冷液冷架構低估達 0.045，一般氣冷冰機低估 0.010） | 
| **P1-H1** | **遺漏水冷冰機之冷卻水泵 (`CW Pump`)、雙迴路板交 (`PHE`) 二次側揚程、閉式塔/絕熱塔噴淋泵與乙二醇物性 (**$c_p$**)** | `js/store.js:1544-1637`  `js/cooling/stages/stage_closed_tower.js`  `js/cooling/stages/stage_adiabatic.js:61` | 1\. `water_chiller` 與 `water_cooled_chiller` 的拓樸圖繪製了 `CW Pump`，但計算引擎只算了一次側 `CHW/FWS Pump`！因冷卻水溫差僅 `5°C`（液冷 FWS 為 `12~15°C`），冷卻水流量高達一次側的 **2.5\~3 倍**，遺漏 CW Pump 會少算超過一半的水泵耗電。  2\. 啟用 `hasPhe = true` 或 `dry_cooler_trim` 雙迴路時，僅算單迴路 `28m` 揚程，未計入板交壓降與外迴路管損（`+14~16m`）。  3\. 閉式冷卻塔 (`closed_tower`) 噴淋水泵功耗為 `0 kW`（型錄 `BAC FXV3` 噴淋泵達 `11.19 kW`，與風機 `11.3 kW` 相當！）；絕熱塔噴淋泵係數 `0.0003` 低估約 6 倍。  4\. 乾冷器/閉式塔使用乙二醇（$c_p \approx 3.90\text{ kJ/(kg}\cdot\text{K)}$），程式固定用純水 `4.186`，低估流量與泵功約 `7.3%`。 | **-0.004 \~ -0.015 PUE 點**  （視是否採用水冷冰機、閉式塔或板交隔離而定） | 

### 1.1 修正前後量化驗證對照表 (Before vs. After Benchmarks)

以下為沙盒環境實測各階段修正對 **預設專案（1.08 MW IT，高雄）** 與 **使用者實測存檔專案（`PUE_Project_高雄 (Kaohsiung)_20260901.json`，17.95 MW IT）** 的逐項 PUE 累加影響：

#### 表 A：預設專案（1.08 MW IT：DU-01 936 kW \[92.2% DLC, `dry_cooler_trim` + `air_cooled_chiller`\] + CorePOD-A 140 kW \[0% DLC\]，高雄）

| 驗證階段 | 全年 PUE | 全年 pPUE | 尖峰 PUE | 冰機耗電 (MWh) | 排熱風扇 (MWh) | 水泵+CDU (MWh) | CRAH 風機 (MWh) | 電力損耗 (MWh) | DU-01 PUE | CorePOD PUE | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **0. 現行程式碼 (Baseline)** | **1.101** | 1.061 | 1.137 | 351 | 131 | 381 | 92 | 0 | 1.078 | 1.254 | 
| **1. +\[P0-E1\] 廠務電力損耗 (4.5%) 與室內發熱耦合** | **1.161** | 1.075 | 1.200 | 430 | 131 | 386 | 150 | 424 | 1.139 | 1.314 | 
| **2. +\[P0-F1\] 排熱風扇取消 0.5x 腰斬 + 趨近溫差變頻** | **1.164** | 1.078 | 1.200 | 430 | 152 | 386 | 150 | 424 | 1.141 | 1.314 | 
| **3. +\[P0-T1\] CDU/CRAH 降額容量傳遞與最低轉速修正** | **1.167** | 1.078 | 1.203 | 430 | 152 | 420 | 150 | 424 | 1.145 | 1.314 | 
| **4. +\[P0-C1\] 氣冷冰機依機型判定是否具 FC 盤管** | **1.167** | 1.078 | 1.203 | 431 | 152 | 420 | 150 | 424 | 1.145 | 1.314 | 
| **5. +\[P0-C2\] 冰機額定點歸一化、Carnot 阻尼與部分負載** | **1.178** | 1.089 | 1.215 | 536 | 152 | 420 | 150 | 424 | 1.152 | 1.356 | 
| **6. 全部修正 (+\[P1-H1\] CW泵/雙迴路揚程/乙二醇/噴淋泵)** | **1.183** | **1.089** | **1.220** | **536** | **152** | **461** | **150** | **424** | **1.157** | **1.356** | 
| **7. 純空調物理修正對照 (設 `0%` 電損，即純 `1+CLF`)** | **1.124** | **1.076** | **1.160** | **465** | **152** | **455** | **100** | **0** | **1.099** | **1.296** | 

> **關鍵結論**：即便不計入廠務電力損耗（設為 `0%`），純冷卻系統能耗因子（$\text{CLF}$）在修正物理模型後也由 `0.101` 上升至 `0.124`（**空調耗電修正幅度 +22.8%**）；若計入標準 `4.5%` 電力轉換損耗與其散發至機房的熱負載，高雄案場全年 PUE 由 **`1.101`** 校正至合理工程範圍 **`1.183`**（尖峰 **`1.220`**）。

#### 表 B：存檔專案 `PUE_Project_高雄 (Kaohsiung)_20260901.json`（17.95 MW IT：DU-01 14.95 MW \[91.2% DLC, `adiabatic_tower` + `Uniflair XCAC1913A`\] + CorePOD-A 3.00 MW \[0% DLC, `Uniflair XCAC2524A`\]）

| 驗證階段 | 全廠全年 PUE | 全廠 pPUE | 尖峰 PUE | 冰機耗電 (MWh) | 排熱風扇 (MWh) | 水泵+CDU (MWh) | CRAH 風機 (MWh) | 電力損耗 (MWh) | DU-01 PUE | CorePOD PUE | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **0. 現行程式碼 (Baseline)** | **1.092** | 1.070 | 1.120 | 7,816 | 1,742 | 3,489 | 1,392 | 0 | **1.053** | 1.283 | 
| **1. +\[P0-E1\] 廠務電力損耗 (4.5%) 與室內發熱耦合** | **1.148** | 1.080 | 1.179 | 8,843 | 1,793 | 3,548 | 1,999 | 7,077 | 1.109 | 1.343 | 
| **2. +\[P0-F1\] 絕熱塔風扇取消 0.5x 腰斬 + 溫差變頻** | **1.151** | 1.084 | 1.177 | 8,843 | 2,321 | 3,548 | 1,999 | 7,077 | 1.113 | 1.343 | 
| **3. +\[P0-T1\] CDU2300/FWCV 降額與最低轉速修正** | **1.157** | 1.084 | 1.182 | 8,843 | 2,321 | 4,415 | 1,999 | 7,077 | 1.119 | 1.343 | 
| **4. +\[P0-C1\] `Uniflair XCAC` 純氣冷移除幽靈 FC 盤管** | **1.158** | 1.085 | 1.182 | 9,175 | 2,171 | 4,415 | 1,999 | 7,077 | 1.121 | 1.343 | 
| **5. +\[P0-C2\] `XCAC` 20°C 額定點歸一化與 Carnot 阻尼** | **1.160** | 1.087 | 1.179 | 9,454 | 2,171 | 4,415 | 1,999 | 7,077 | 1.123 | 1.343 | 
| **6. 全部修正 (+\[P1-H1\] 雙迴路揚程與絕熱塔噴淋泵)** | **1.164** | **1.087** | **1.185** | **9,454** | **2,185** | **5,080** | **1,999** | **7,077** | **1.128** | **1.343** | 
| **7. 純空調物理修正對照 (設 `0%` 電損，即純 `1+CLF`)** | **1.107** | **1.075** | **1.126** | **8,158** | **2,185** | **5,022** | **1,392** | **0** | **1.071** | **1.283** | 

> **關鍵結論**：原高雄 17.95 MW 專案中，`DU-01` 的全年 PUE 僅 `1.053`（極度偏低），修正純空調物理錯誤後，`DU-01` 的機械冷卻指標上升至 `1.071`（冷卻能耗 $\text{CLF}$ 由 `0.053` 增加至 `0.071`，**增幅 +34.0%**），加計 `4.5%` 廠務電損後 `DU-01` PUE 為 **`1.128`**，全廠總 PUE 為 **`1.164`**（尖峰 **`1.185`**）。

#### 表 C：7 大內建氣候測站修正前後對照表（預設專案配置）

| 內建氣候測站 | 修正前 Baseline PUE (尖峰) | 修正後純機械 PUE (`0%` 電損) | 修正後全廠總 PUE (`4.5%` 電損) | 修正後尖峰 PUE (`4.5%` 電損) | 
| ----- | ----- | ----- | ----- | ----- | 
| **新加坡 (Singapore)** | 1.104 (1.111) | 1.129 | **1.187** | 1.202 | 
| **菲律賓 (Ambulong)** | 1.104 (1.135) | 1.128 | **1.187** | 1.217 | 
| **高雄 (Kaohsiung)** | 1.101 (1.137) | 1.124 | **1.183** | 1.220 | 
| **台中 (Taichung)** | 1.099 (1.129) | 1.121 | **1.179** | 1.210 | 
| **桃園 (Taoyuan Pilot)** | 1.098 (1.111) | 1.119 | **1.177** | 1.203 | 
| **新竹 (Hsinchu)** | 1.098 (1.110) | 1.119 | **1.177** | 1.200 | 
| **美國 (Alabama Andalusia)** | 1.095 (1.156) | 1.117 | **1.175** | 1.243 | 

#### 表 D：高雄測站 $5 \times 4 = 20$ 種液冷/氣冷架構矩陣修正前後對照表

| 液冷架構 (`cduSystem.architecture`) | 氣冷架構 (`fanwallSystem.architecture`) | 修正前 PUE | 修正後純機械 PUE (`0%` 電損) | 修正後全廠 PUE (`4.5%` 電損) | 修正後 WUE (L/kWh) | 
| ----- | ----- | ----- | ----- | ----- | ----- | 
| `dry_cooler_pure` (純乾冷器) | `air_cooled_chiller` (氣冷冰機) | 1.101 | 1.124 | **1.183** | 0.000 | 
| `dry_cooler_pure` (純乾冷器) | `water_cooled_chiller` (水冷冰機) | 1.110 | 1.130 | **1.187** | 0.189 | 
| `dry_cooler_pure` (純乾冷器) | `chilled_water_plant` (園區冰水) | 1.102 | 1.119 | **1.178** | 0.000 | 
| `dry_cooler_pure` (純乾冷器) | `rdhx` (背門熱交換器) | 1.100 | 1.123 | **1.178** | 0.000 | 
| `dry_cooler_trim` (乾冷器+Trim冰機) | `air_cooled_chiller` (氣冷冰機) | 1.101 | 1.124 | **1.183** | 0.000 | 
| `dry_cooler_trim` (乾冷器+Trim冰機) | `water_cooled_chiller` (水冷冰機) | 1.110 | 1.130 | **1.187** | 0.189 | 
| `dry_cooler_trim` (乾冷器+Trim冰機) | `chilled_water_plant` (園區冰水) | 1.102 | 1.119 | **1.178** | 0.000 | 
| `dry_cooler_trim` (乾冷器+Trim冰機) | `rdhx` (背門熱交換器) | 1.100 | 1.123 | **1.178** | 0.000 | 
| `adiabatic_tower` (絕熱預冷塔) | `air_cooled_chiller` (氣冷冰機) | 1.099 | 1.121 | **1.179** | 0.000 | 
| `adiabatic_tower` (絕熱預冷塔) | `water_cooled_chiller` (水冷冰機) | 1.108 | 1.126 | **1.183** | 0.189 | 
| `adiabatic_tower` (絕熱預冷塔) | `chilled_water_plant` (園區冰水) | 1.100 | 1.115 | **1.175** | 0.000 | 
| `adiabatic_tower` (絕熱預冷塔) | `rdhx` (背門熱交換器) | 1.098 | 1.119 | **1.175** | 0.000 | 
| `cooling_tower_hx` (閉式冷卻塔) | `air_cooled_chiller` (氣冷冰機) | 1.099 | 1.129 | **1.187** | 1.243 | 
| `cooling_tower_hx` (閉式冷卻塔) | `water_cooled_chiller` (水冷冰機) | 1.108 | 1.134 | **1.191** | 1.431 | 
| `cooling_tower_hx` (閉式冷卻塔) | `chilled_water_plant` (園區冰水) | 1.100 | 1.123 | **1.183** | 1.243 | 
| `cooling_tower_hx` (閉式冷卻塔) | `rdhx` (背門熱交換器) | 1.098 | 1.127 | **1.183** | 1.243 | 
| `water_chiller` (水冷冰機全機械) | `air_cooled_chiller` (氣冷冰機) | 1.177 | 1.227 | **1.286** | 1.378 | 
| `water_chiller` (水冷冰機全機械) | `water_cooled_chiller` (水冷冰機) | 1.186 | 1.233 | **1.290** | 1.567 | 
| `water_chiller` (水冷冰機全機械) | `chilled_water_plant` (園區冰水) | 1.178 | 1.221 | **1.281** | 1.378 | 
| `water_chiller` (水冷冰機全機械) | `rdhx` (背門熱交換器) | 1.176 | 1.226 | **1.281** | 1.378 | 

## 2. Phase A — 核心物理與熱力學引擎修正詳解 (P0 / P1 Physics Tasks)

### Task P0-E1：廠務電力轉換損耗預設值 (`4.5%`)、專案序列化修復與死欄位清理

#### 檔案位置

* `js/assumptions.js:186`（新增預設廠務電力損耗率常數）

* `js/store.js:56`（初始化預設值）

* `js/store.js:209-227`（`serializeProject` 補入 `facilityElectricalLossPct`）

* `js/store.js:321-350`（`deserializeProject` 還原 `facilityElectricalLossPct`）

#### 物理依據

依據 ISO/IEC 30134-2 與 LBNL 資料中心能效報告，全廠總 PUE 定義為：

$$
\text{PUE} = \frac{E_{\text{IT}} + E_{\text{Cooling}} + E_{\text{PowerDistLoss}} + E_{\text{Lighting/Aux}}}{E_{\text{IT}}}
$$


其中高壓變壓器（MV/LV Transformer，`~1.0%`）+ 雙轉換在線式 UPS（Online Double-Conversion UPS，`~2.5%~3.0%`）+ 機房 PDU/匯流排配電損耗（`~0.5%`）+ 照明/BMS/安防輔助（`~0.5%`）合計約為 IT 負載之 **`4.5%`**。若設為 `0%`，計算結果實為 `1 + CLF`（純機械冷卻負載因子），而非全廠 PUE。

#### 修改步驟 1：在 `js/assumptions.js` 新增常數

在 `js/assumptions.js` 末尾（約第 186 行 `chiller_max_cewt_hightemp_c` 之後）新增以下工程假設常數（供 P0-E1 至 P1-H1 統一使用）：

```
  // ── [Round 6 Physics Audit] 電力損耗、風扇變頻、終端最低轉速與附屬水泵常數 ──
  electrical_loss_default_pct: {
    val: 4.5, unit: '%',
    label: '預設全廠電力轉換與分配損耗率 (變壓器 + UPS + PDU + 照明輔助)',
    ref: 'ISO/IEC 30134-2 / LBNL Data Center Efficiency Report — MV/LV Transformer (~1.0%) + Online UPS (~2.5%) + PDU/Line (~0.5%) + Lighting/BMS (~0.5%)'
  },
  cdu_pump_min_speed_active: {
    val: 0.75, unit: 'ratio',
    label: 'CDU 內建變頻水泵運轉中最低轉速下限（維持冷板流道最低壓差 ΔP 與最小雷諾數）',
    ref: 'ASHRAE TC9.9 Liquid Cooling Guidelines / NVIDIA Vera Rubin NVL72 Manifold ΔP Control Spec'
  },
  crah_fan_min_speed_active: {
    val: 0.70, unit: 'ratio',
    label: 'CRAH/Fanwall 機房空調 EC 風機運轉中最低轉速下限（維持冷熱通道氣流組織與送風量）',
    ref: 'ASHRAE TC9.9 Thermal Guidelines — Server Aisle Airflow & ΔT Containment Control'
  },
  heat_rej_vfd_slope_per_k: {
    val: 0.022, unit: '1/K',
    label: '乾冷器/絕熱塔外氣低於自然冷卻門檻時之風扇轉速線性調降斜率 (每低 1°C 降速 2.2%)',
    ref: 'ASHRAE 90.1 / EnergyPlus Variable-Speed Cooler Approach Control Model'
  },
  evap_tower_vfd_slope_per_k: {
    val: 0.025, unit: '1/K',
    label: '蒸發冷卻水塔濕球溫度低於設計基準時之風扇轉速線性調降斜率 (每低 1°C 降速 2.5%)',
    ref: 'ASHRAE 90.1 / CTI ATC-105 Variable-Speed Cooling Tower Control'
  },
  heat_rej_fan_min_speed: {
    val: 0.45, unit: 'ratio',
    label: '室外排熱風扇 (乾冷器/冷卻塔/絕熱塔) 連續運轉最低變頻轉速下限',
    ref: 'EC Fan / VFD Motor Thermal & Coil Face Velocity Floor (45% speed ≈ 13.7% power)'
  },
  chiller_carnot_damp_air: {
    val: 0.40, unit: 'ratio',
    label: '氣冷式冰機 Carnot 揚程效率修正阻尼係數（扣除佔總功耗 ~25% 之冷凝風扇與固定壓損）',
    ref: 'AHRI 550/590 Air-Cooled Chiller EER vs OAT Sensitivity (~1.8%/°C)'
  },
  chiller_carnot_damp_water: {
    val: 0.65, unit: 'ratio',
    label: '水冷式冰機 Carnot 揚程效率修正阻尼係數（反映壓縮機壓比極限與馬達/變頻固定損耗）',
    ref: 'AHRI 550/590 Water-Cooled Chiller EIR-FT Sensitivity'
  },
  chiller_evap_temp_cap_c: {
    val: 20.0, unit: '°C',
    label: '標準冰水主機蒸發器飽和溫度上限（高於此供水溫度不再獲得額外 Carnot 減載增益）',
    ref: 'Compressor Suction Pressure / MOP (Maximum Operating Pressure) Envelope Limit'
  },
  glycol_cp_kj_kgk: {
    val: 3.90, unit: 'kJ/(kg·K)',
    label: '30% 乙二醇/丙二醇水溶液比熱容（乾冷器與閉式塔防凍/防腐迴路）',
    ref: 'ASHRAE Fundamentals Handbook Chapter 31 — Physical Properties of Secondary Coolants (EG/PG 25-30%)'
  },
  phe_secondary_loop_head_m: {
    val: 16.0, unit: 'm',
    label: '板式熱交換器 (PHE) 雙迴路隔離或串聯雙熱交換器之附加水頭損失 (含 PHE 壓降 + 二次側管損)',
    ref: 'Alfa Laval / SWEP Brazed & Gasketed PHE Hydraulic Drop (50-70 kPa) + Secondary Loop Piping (90-100 kPa)'
  },
  cw_pump_head_default_m: {
    val: 22.0, unit: 'm',
    label: '水冷式冰水主機之冷卻水迴路 (CW Loop: 冷凝器 + 冷卻塔噴嘴 + 管路) 預設揚程',
    ref: 'ASHRAE HVAC Systems and Equipment Handbook — Condenser Water Pump Sizing'
  },
  cw_loop_delta_t_c: {
    val: 5.5, unit: '°C',
    label: '水冷式冰機冷凝器冷卻水設計溫差 (AHRI 550/590 標準 30°C 進 / 35.5°C 出)',
    ref: 'AHRI Standard 550/590 Condenser Water Rating ΔT'
  },
  closed_tower_spray_pump_kw_per_kw: {
    val: 0.0055, unit: 'kW/kW_th',
    label: '閉式冷卻水塔 (Closed-Circuit Tower) 盤管外部噴淋水泵單位排熱量功耗比 (~5.5 W/kW)',
    ref: 'BAC FXV3 / Evapcoeco-ATWB Catalog Spray Pump Motor Spec (e.g. 7.5-11 kW per 1500 kW cell)'
  },
  adiabatic_spray_pump_kw_per_kw: {
    val: 0.0020, unit: 'kW/kW_th',
    label: '絕熱預冷塔 (Adiabatic Cooler) 濕模式增濕循環水泵與水處理電磁閥單位排熱量功耗比 (~2.0 W/kW)',
    ref: 'BAC TrilliumSeries / Güntner HydroPad Recirculation Pump Spec'
  },

```

同時將 `js/assumptions.js:68` 的 `chiller_lift_factor_max` 由 `2.0` 調降為物理合理上限 `1.35`：

```
  // 修改前 (js/assumptions.js:68)
  chiller_lift_factor_max:   { val: 2.0, unit: '-', label: 'Carnot 揚程修正因子上限', ref: '溫水供水（40°C）相對 7°C 設計點的理論效率增益上限' },

  // 修改後
  chiller_lift_factor_max:   { val: 1.35, unit: '-', label: 'Carnot 揚程修正因子上限', ref: '受限於壓縮機吸氣壓力上限 (MOP) 與最小壓比，溫水供水最大 COP 增益上限為 1.35x' },

```

#### 修改步驟 2：在 `js/store.js` 修正預設值與專案序列化/反序列化

1. **`js/store.js:56`**：

```
// 修改前
facilityElectricalLossPct: 0.0,

// 修改後
facilityElectricalLossPct: (typeof A === 'function') ? A('electrical_loss_default_pct') : 4.5,

```

2. **`js/store.js:209-227` (`serializeProject`)**：

```
// 修改前
        serializeProject() {
            const exportData = {
                version: '30.0',
                timestamp: new Date().toISOString(),
                state: {
                    site: {
                        selectedCity: this.state.site.selectedCity,
                        stationId: this.state.site.stationId || null,
                        stationSource: this.state.site.stationSource || (this.state.site.userUploaded ? 'epw' : 'builtin'),
                        userUploaded: this.state.site.userUploaded,
                        stats: this.state.site.stats,
                        designConditions: this.state.site.designConditions || null
                    },
                    halls: this.state.halls,
                    corePods: this.state.corePods,
                    assumptions_override: this.state.assumptions_override
                }
            };
            return JSON.stringify(exportData, null, 2);
        },

// 修改後
        serializeProject() {
            const exportData = {
                version: '30.0',
                timestamp: new Date().toISOString(),
                state: {
                    facilityElectricalLossPct: this.state.facilityElectricalLossPct ?? ((typeof A === 'function') ? A('electrical_loss_default_pct') : 4.5),
                    site: {
                        selectedCity: this.state.site.selectedCity,
                        stationId: this.state.site.stationId || null,
                        stationSource: this.state.site.stationSource || (this.state.site.userUploaded ? 'epw' : 'builtin'),
                        userUploaded: this.state.site.userUploaded,
                        stats: this.state.site.stats,
                        designConditions: this.state.site.designConditions || null
                    },
                    halls: this.state.halls,
                    corePods: this.state.corePods,
                    assumptions_override: this.state.assumptions_override
                }
            };
            return JSON.stringify(exportData, null, 2);
        },

```

3. **`js/store.js:321-340` (`deserializeProject`)**：

```
// 於 deserializeProject 內 if (stateData.assumptions_override) 區塊旁加入：
                if (typeof stateData.facilityElectricalLossPct === 'number' && !Number.isNaN(stateData.facilityElectricalLossPct)) {
                    this.state.facilityElectricalLossPct = Math.max(0, Math.min(50, stateData.facilityElectricalLossPct));
                } else {
                    this.state.facilityElectricalLossPct = (typeof A === 'function') ? A('electrical_loss_default_pct') : 4.5;
                }

```

### Task P0-F1：排熱風扇 (`Dry Cooler` / `Adiabatic` / `Evap Tower` / `Closed Tower`) 取消 `0.5x` 額定功率腰斬、補齊溫差變頻調速與串聯冰機排熱量

#### 檔案位置

* `js/store.js:1190-1203` (`resolveTowerFromSizing`)

* `js/cooling/stages/stage_dry_cooler.js:29-59` (`rejectionCost`)

* `js/cooling/stages/stage_adiabatic.js:36-75` (`rejectionCost`)

* `js/cooling/stages/stage_evap_tower.js:32-53` (`rejectionCost`)

* `js/cooling/stages/stage_closed_tower.js:21-35` (`rejectionCost`)

* `js/cooling/stage_chain.js:161-235` (`runStageChain` 排熱量修正)

#### 物理依據

1. **風扇額定功率不可在自然冷卻模式直接乘 `0.5`**：
   當外氣乾球溫度 $T_{\text{db}}$ 恰好等於自然冷卻上限門檻 $T_{\text{freeThresh}} = T_{\text{supply}} - \text{Approach}_{\text{design}}$（例如 $40^\circ\text{C} - 5^\circ\text{C} - 2^\circ\text{C} = 33^\circ\text{C}$）時，乾冷器或絕熱塔**必須以 100% 設計風量與 100% 額定風扇功率 (`fan_kw_dx`) 運轉**，才能達成 $5^\circ\text{C}$ 的設計趨近溫差！原程式碼將 `fan_kw_fc` 設為 `0.5 * fanKwDx`，並在 `w.db <= freeThresh`（全年 99% 時數）傳入 `is_fc = true`，等於無條件將全年風扇功耗砍半。

2. **外氣低於門檻時之 VFD 變頻調速模型**：
   當外氣溫度 $T_{\text{amb}}$ 低於設計門檻 $T_{\text{thresh}}$ 時，線圈具備過冷裕度 $\Delta T_{\text{margin}} = \max(0, T_{\text{thresh}} - T_{\text{amb}})$。依據 ASHRAE 90.1 變頻排熱風機控制模型，風扇轉速隨過冷裕度線性調降（每低 $1^\circ\text{C}$ 降速 $2.2\%\sim 2.5\%$，最低轉速下限 `heat_rej_fan_min_speed = 0.45` 以維持盤管迎面風速與控制穩定性），再代入 `CoolingTowerEngine.calcFanPower` 的三次方親和律計算實際功耗：
   

   $$
   s = \text{clamp}\Big(\text{loadRatio} \times \big(1 - k_{\text{vfd}} \cdot \max(0, T_{\text{thresh}} - T_{\text{amb}})\big),\; s_{\min},\; 1.0\Big)
   $$

3. **移除絕對溫度比 `(w.db + 273.15) / (freeThresh + 273.15)` 錯誤公式**：
   原 `stage_dry_cooler.js:47,51` 使用克耳文溫度比（在 $15^\circ\text{C}$ 時仍高達 $288/308 = 0.935$），完全不具熱傳物理意義，應統一改用上述三次方 VFD 模型。

4. **`stage_chain.js` 串聯 Trim Chiller 排熱量修正**：
   在 `dry_cooler_trim`（水對水 Trim 冰機將冷凝熱排入乾冷器迴路）中，乾冷器必須排出的總熱量為 $Q_{\text{reject}} = Q_{\text{IT,liq}} + P_{\text{compressor}}$。原 `stage_chain.js:176` 在計算 `mechanical.simulate` 之前就先呼叫 `ecoStage.rejectionCost(stageCtx, Q_kw, isFullFc)`，漏算了壓縮機輸入功率轉化的冷凝熱。

#### 修改程式碼

1. **`js/store.js:1190-1203` (`resolveTowerFromSizing`)**：

```
        resolveTowerFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const fanKwDx = catEntry?.fanKwDx;
            if (!fanKwDx) return [];
            return [{
                model: item.selectedModel,
                fan_kw_dx: fanKwDx,
                // 修正 P0-F1：不再無條件將自然冷卻額定風扇功率乘 0.5；低溫減載統一由各 Stage 的 VFD speedRatio 三次方曲線處理
                fan_kw_fc: catEntry?.fanKwFc ?? fanKwDx,
                qty_running: this.runningQtyFromSelected(item.selectedQty),
                qty_total: item.selectedQty,
                fan_control: 'vfd'
            }];
        },

```

2. **`js/cooling/stages/stage_dry_cooler.js:29-59` (`rejectionCost`)**：

```
        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            if (Q_reject_kw <= 0) return { fanKw: 0, waterM3: 0 };
            const dcDevices = ctx.equip?.dry_cooler || ctx.devices || [];
            const loadRatio = ctx.loadRatio ?? 1.0;
            const defaultMinSpd = (typeof root.A === 'function') ? root.A('heat_rej_fan_min_speed') : 0.45;
            const fanMinSpeed = Math.max(ctx.fanMinSpeed ?? defaultMinSpd, defaultMinSpd);
            const w = ctx.w || { db: 25, wb: 20 };
            const approach = ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.dryCoolerApproachC || 5.0);
            const pheApproach = ctx.hx_approach_c ?? ctx.params?.hx_approach_c ?? 0.0;
            const t_supply_c = ctx.t_supply_c ?? ctx.sys?.fwsSupplyC ?? 42.0;
            const freeThresh = t_supply_c - approach - pheApproach;

            // P0-F1: 在 w.db >= freeThresh 時風扇需 100% 轉速；低於 freeThresh 時依過冷裕度線性降速並套用三次方親和律
            const vfdSlope = (typeof root.A === 'function') ? root.A('heat_rej_vfd_slope_per_k') : 0.022;
            const subcoolMarginC = Math.max(0, freeThresh - w.db);
            const ambSpeed = isFullFc ? Math.max(fanMinSpeed, 1.0 - vfdSlope * subcoolMarginC) : 1.0;
            const speedRatio = Math.max(fanMinSpeed, Math.min(1.0, loadRatio * ambSpeed));

            let fanKw = 0;
            if (dcDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined') {
                fanKw = root.CoolingTowerEngine.calcFanPower(dcDevices, speedRatio, false, fanMinSpeed);
            } else {
                const fStatic = (typeof root.A === 'function') ? root.A('ct_vfd_static_fraction') : 0.05;
                fanKw = (Q_reject_kw / 500) * 14.0 * (fStatic + (1 - fStatic) * Math.pow(speedRatio, 3));
            }
            return { fanKw, waterM3: 0 };
        },

```

3. **`js/cooling/stages/stage_adiabatic.js:36-75` (`rejectionCost`)**：

```
        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            if (Q_reject_kw <= 0) return { fanKw: 0, waterM3: 0, diag: {} };
            const sys = ctx.sys || {};
            const w = ctx.w || { db: 25, wb: 20 };
            const t_supply_c = ctx.t_supply_c ?? sys.fwsSupplyC ?? 42.0;
            const satEff = (sys.adiabaticSaturationEfficiencyPct || 85) / 100;
            const approach = ctx.approach_c ?? ctx.params?.approach_c ?? (sys.dryCoolerApproachC || 5.0);
            const drySwitchpoint = resolveDrySwitchpoint(ctx, sys, t_supply_c, approach);
            const isDry = w.db <= drySwitchpoint;
            const atDevices = ctx.equip?.adiabatic_tower || ctx.devices || [];
            const loadRatio = ctx.loadRatio ?? 1.0;
            const defaultMinSpd = (typeof root.A === 'function') ? root.A('heat_rej_fan_min_speed') : 0.45;
            const fanMinSpeed = Math.max(ctx.fanMinSpeed ?? defaultMinSpd, defaultMinSpd);
            const cycles = ctx.cycles ?? (sys.cyclesOfConcentration || 5);

            const effectiveDb = isDry ? w.db : (w.db - (w.db - w.wb) * satEff);
            const vfdSlope = (typeof root.A === 'function') ? root.A('heat_rej_vfd_slope_per_k') : 0.022;
            const subcoolMarginC = Math.max(0, drySwitchpoint - effectiveDb);
            const ambSpeed = Math.max(fanMinSpeed, 1.0 - vfdSlope * subcoolMarginC);
            const speedRatio = Math.max(fanMinSpeed, Math.min(1.0, loadRatio * ambSpeed));

            const fStatic = (typeof root.A === 'function') ? root.A('ct_vfd_static_fraction') : 0.05;
            let fanKw = (atDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                ? root.CoolingTowerEngine.calcFanPower(atDevices, speedRatio, false, fanMinSpeed)
                : ((Q_reject_kw / 500) * 14.0 * (fStatic + (1 - fStatic) * Math.pow(speedRatio, 3)));

            let waterM3 = 0;
            let sprayPumpKw = 0;

            if (!isDry) {
                const sprayRatio = (typeof root.A === 'function') ? root.A('adiabatic_spray_pump_kw_per_kw') : 0.0020;
                sprayPumpKw = Q_reject_kw * sprayRatio;
                fanKw += sprayPumpKw;

                const T_eff = effectiveDb;
                const dtAir = (typeof root.A === 'function') ? root.A('adiabatic_coil_air_dt_k') : 10.0;
                const m_air = Q_reject_kw / (1.006 * Math.max(1.0, dtAir));
                const m_evap = Math.max(0, m_air * 1.006 * (w.db - T_eff) / 2450.0);
                const evap = m_evap * 3.6;
                const bd = evap / Math.max(1, cycles - 1);
                waterM3 = evap + bd;
            }

            return { fanKw, waterM3, diag: { isDry, drySwitchpoint, sprayPumpKw } };
        },

```

4. **`js/cooling/stages/stage_evap_tower.js:32-53` 與 `js/cooling/stages/stage_closed_tower.js:21-35`**：

```
        // stage_evap_tower.js: rejectionCost
        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            if (Q_reject_kw <= 0) return { fanKw: 0, waterM3: 0, diag: { evap: 0, bd: 0 } };
            const ctDevices = ctx.equip?.cooling_tower || ctx.devices || [];
            const loadRatio = ctx.loadRatio ?? 1.0;
            const defaultMinSpd = (typeof root.A === 'function') ? root.A('heat_rej_fan_min_speed') : 0.45;
            const fanMinSpeed = Math.max(ctx.fanMinSpeed ?? defaultMinSpd, defaultMinSpd);
            const evapFactor = ctx.evapFactor ?? ((typeof root.A === 'function') ? root.A('ct_evap_m3h_per_kw') : 0.00124);
            const cycles = ctx.cycles ?? (ctx.sys?.cyclesOfConcentration || 5);
            const w = ctx.w || { db: 25, wb: 20 };
            const t_supply_c = ctx.t_supply_c ?? ctx.sys?.fwsSupplyC ?? 35.0;
            const approach = ctx.approach_c ?? (ctx.sys?.ctApproachC ?? 4.0);

            const refWb = Math.min(28.0, t_supply_c - approach);
            const vfdSlope = (typeof root.A === 'function') ? root.A('evap_tower_vfd_slope_per_k') : 0.025;
            const subcoolMarginC = Math.max(0, refWb - w.wb);
            const ambSpeed = Math.max(fanMinSpeed, 1.0 - vfdSlope * subcoolMarginC);
            const speedRatio = Math.max(fanMinSpeed, Math.min(1.0, loadRatio * ambSpeed));

            const fStatic = (typeof root.A === 'function') ? root.A('ct_vfd_static_fraction') : 0.05;
            let fanKw = (ctDevices.length > 0 && typeof root.CoolingTowerEngine !== 'undefined')
                ? root.CoolingTowerEngine.calcFanPower(ctDevices, speedRatio, false, fanMinSpeed)
                : (((ctx.heatLoadKw ?? Q_reject_kw) / 500) * 14.0 * (fStatic + (1 - fStatic) * Math.pow(speedRatio, 3)));

            if (ctx.isClosedTower) {
                const sprayRatio = (typeof root.A === 'function') ? root.A('closed_tower_spray_pump_kw_per_kw') : 0.0055;
                fanKw += Q_reject_kw * sprayRatio;
            }

            const evap = Q_reject_kw * evapFactor;
            const bd = evap / Math.max(1, cycles - 1);
            const waterM3 = evap + bd;

            return { fanKw, waterM3, diag: { evap, bd } };
        },

```

並在 `js/cooling/stages/stage_closed_tower.js:21-35` 的 `closedCtx` 加入 `isClosedTower: true`：

```
        rejectionCost(ctx, Q_reject_kw, isFullFc) {
            const closedCtx = {
                ...ctx,
                isClosedTower: true,
                approach_c: ctx.approach_c ?? ctx.params?.approach_c ?? (ctx.sys?.ctApproachC ?? 6.0)
            };
            return CoolingStages.get('evap_tower').rejectionCost(closedCtx, Q_reject_kw, isFullFc);
        },

```

### Task P0-T1：終端設備 (`CDUEngine` & `CRAHEngine`) 補入降額因子傳遞並修正三次方親和律最低轉速下限

#### 檔案位置

* `js/store.js:1167-1174` (`resolveCduFromSizing`)

* `js/engines_cdu.js:20-33` (`CDUEngine.calcPower`)

* `js/engines_crah.js:18-31` (`CRAHEngine.calcPower`)

#### 物理依據

1. **CDU 高溫降額 (`derateFactor`) 必須傳入模擬引擎**：
   在預設專案中，`fwsSupplyC = 42°C`，`SizingEngine` 計算出 `derateFactor = 0.76`，9 台運轉中 100kW CDU 的實際可用容量僅 `684 kW < 862.6 kW`（Step 4 亮紅燈「🔴 容量不足」）。但 `resolveCduFromSizing` 卻將未降額的 `capacity_kw: 100`（合計 `900 kW`）傳給 `CDUEngine.calcPower`，導致模擬引擎誤判 `deficit_kw = 0` 且將 `plr` 低估為 `862.6 / 900`！

2. **CDU 與 CRAH 運轉中最低轉速下限**：

   * 液冷 CDU 內建泵必須維持伺服器冷板歧管（Manifold）之最低壓差 $\Delta P_{\min}$ 與最小湍流雷諾數；當多台 CDU 並聯或高溫降額增加台數時，單機變頻轉速不應低於 `cdu_pump_min_speed_active = 0.75`。

   * 機房 CRAH / Fanwall 的 EC 風機受限於冷熱通道氣流組織（防止熱風短路回流），運轉中風機轉速下限為 `crah_fan_min_speed_active = 0.70`（原 `0.30` 會使 60% 負載時風機功耗暴跌至額定的 $29\%$）。

#### 修改程式碼

1. **`js/store.js:1167-1174` (`resolveCduFromSizing`)**：

```
        resolveCduFromSizing(item) {
            if (!item || !item.selectedQty) return [];
            const catEntry = (item.catalog || []).find(c => c.model === item.selectedModel);
            const nominalCapKw = catEntry?.capKw ?? item.unitCapKw;
            const powerKw = catEntry?.powerKw;
            if (!nominalCapKw || !powerKw) return [];
            const derateFactor = (typeof item.derateFactor === 'number' && item.derateFactor > 0) ? item.derateFactor : 1.0;
            return [{
                model: item.selectedModel,
                nominal_capacity_kw: nominalCapKw,
                capacity_kw: nominalCapKw * derateFactor,
                derate_factor: derateFactor,
                power_kw: powerKw,
                qty_running: this.runningQtyFromSelected(item.selectedQty),
                qty_total: item.selectedQty
            }];
        },

```

2. **`js/engines_cdu.js:20-33` (`CDUEngine.calcPower`)**：

```
  calcPower(cdu_list, it_liquid_kw) {
    if (!cdu_list?.length || it_liquid_kw <= 0)
      return { power_kw: 0, plr: 0, speed: 0, delta_t_actual: 0, flow_m3h: 0 };

    const cap_total   = sumRunning(cdu_list, 'capacity_kw');
    const power_rated = sumRunning(cdu_list, 'power_kw');
    const plr_raw     = cap_total > 0 ? (it_liquid_kw / cap_total) : (it_liquid_kw > 0 ? 1.0 : 0);
    const plr         = Math.min(1.0, plr_raw);
    const deficit_kw  = Math.max(0, it_liquid_kw - cap_total);
    const min_spd     = (typeof A === 'function') ? A('cdu_pump_min_speed_active') : 0.75;
    const speed       = Math.max(min_spd, Math.min(1.0, plr));
    const power_kw    = power_rated * (0.15 + 0.85 * Math.pow(speed, 3));

    return { power_kw, plr, plr_raw, deficit_kw, speed, cap_total, power_rated };
  },

```

3. **`js/engines_crah.js:18-31` (`CRAHEngine.calcPower`)**：

```
  calcPower(crah_list, it_air_kw) {
    if (!crah_list?.length || it_air_kw <= 0) return { power_kw: 0, plr: 0, speed: 0, cap_total: 0 };

    const cap_total   = sumRunning(crah_list, 'cooling_capacity_kw');
    const power_rated = sumRunning(crah_list, 'power_kw');
    const plr_raw     = cap_total > 0 ? (it_air_kw / cap_total) : (it_air_kw > 0 ? 1.0 : 0);
    const plr         = Math.min(1.0, plr_raw);
    const deficit_kw  = Math.max(0, it_air_kw - cap_total);
    const min_spd     = (typeof A === 'function') ? A('crah_fan_min_speed_active') : 0.70;
    const speed       = Math.max(min_spd, Math.min(1.0, plr));
    // CRAH fan: 10% static base (AHU filter & duct resistance)
    const power_kw    = power_rated * (0.10 + 0.90 * Math.pow(speed, 3));

    return { power_kw, plr, plr_raw, deficit_kw, speed, cap_total };
  },

```

### Task P0-C1：氣冷式冰水主機 (`air_cooled_chiller`) 依機型規格判定是否具備內建自然冷卻盤管 (`fc_coil`)

#### 檔案位置

* `js/cooling/archs/air_air_cooled_chiller.js:84-115, 223-227`

#### 物理依據

在 `device_catalog/chiller/schneider.json` 中明確記載：

* `Uniflair XCAC` 系列為**純氣冷式冰水主機（不含 Economizer 自然冷卻盤管）**；

* `Uniflair XCAF` 系列才是內建自然冷卻盤管（Free-Cooling Coil，20% 乙二醇）版本（其額定 COP 亦因盤管水壓降與乙二醇而較 `XCAC` 低約 4.5%）。
  同樣地，`Carrier 30XA`、`Trane CGAF`、`York YVAA` 標準型皆為純氣冷壓縮循環冰機。原 `air_air_cooled_chiller.js` 對所有機型一律串聯 `fc_coil`，導致純氣冷冰機在中高溫冰水（如 `20/30°C`）下被誤算大量免費自然冷卻時數。

#### 修改程式碼 (`js/cooling/archs/air_air_cooled_chiller.js`)

在 `CoolingArchRegistry.register({...})` 物件內新增 `hasIntegratedFcCoil(sys, equip)` 輔助方法，並動態決定 `operatingPoint` 與 `simulateHour` 所使用的 `stages`：

```
        hasIntegratedFcCoil(sys, equip) {
            if (sys?.hasFcCoil === true) return true;
            if (sys?.hasFcCoil === false) return false;
            const item = (sys?.sizing || []).find(s => s.key === 'air_cooled_chiller');
            const model = String(item?.selectedModel || equip?.air_cooled_chiller?.[0]?.model || '');
            return /XCAF|FreeCool|Economizer|自然冷卻/i.test(model);
        },

        operatingPoint(sys, w, equip) {
            const db_c = (typeof w === 'number') ? w : (w?.db ?? 25.0);
            const chwSupplyC = sys?.chwSupplyC ?? 12.0;
            const chwReturnC = sys?.chwReturnC ?? 18.0;
            const fcApproach = (typeof root.A === 'function') ? root.A('air_chiller_fc_coil_approach_c') : 4.0;
            const tAvail = db_c + fcApproach;

            if (!this.hasIntegratedFcCoil(sys, equip)) {
                return {
                    fc_fraction: 0.0,
                    chiller_fraction: 1.0,
                    mode: 'mechanical',
                    tAvail,
                    chwSupplyC,
                    chwReturnC,
                    chwPre: chwReturnC,
                    temps: { chwSup: chwSupplyC, chwRet: chwReturnC, chwPre: chwReturnC, coilAvail: tAvail, tAvail },
                    thresholds: { basis: 'db', full: -99, mech: -99 }
                };
            }

            const eco = (typeof root.FreeCoolingEngine?.calcSeriesEconomizer === 'function')
                ? root.FreeCoolingEngine.calcSeriesEconomizer(tAvail, chwSupplyC, chwReturnC)
                : { fc_fraction: (tAvail <= chwSupplyC ? 1.0 : 0.0), chiller_fraction: (tAvail <= chwSupplyC ? 0.0 : 1.0), mode: (tAvail <= chwSupplyC ? 'FULL_FC' : 'MECH') };
            const mode = (typeof root.CoolingArchHelpers !== 'undefined')
                ? root.CoolingArchHelpers.modeFromEco(eco)
                : ((eco.mode === (root.FreeCoolingEngine?.MODE?.FULL_FC || 'FULL_FC'))
                    ? 'free'
                    : ((eco.mode === (root.FreeCoolingEngine?.MODE?.PARTIAL_FC || 'PARTIAL_FC')) ? 'partial' : 'mechanical'));
            const fullThresh = Number((chwSupplyC - fcApproach).toFixed(1));
            const mechThresh = Number((chwReturnC - fcApproach).toFixed(1));
            const chwPre = Number((eco.t_precooled_c ?? Math.min(chwReturnC, Math.max(chwSupplyC, tAvail))).toFixed(1));
            return {
                ...eco,
                mode,
                tAvail,
                chwSupplyC,
                chwReturnC,
                chwPre,
                temps: { chwSup: chwSupplyC, chwRet: chwReturnC, chwPre, coilAvail: tAvail, tAvail },
                thresholds: { basis: 'db', full: fullThresh, mech: mechThresh }
            };
        },

```

並將 `simulateHour(ctx)`（第 223–227 行）改為依 `hasIntegratedFcCoil` 選擇是否串接 `fc_coil`：

```
        simulateHour(ctx) {
            const activeStages = this.hasIntegratedFcCoil(ctx.sys, ctx.equip)
                ? this.stages
                : [{ type: 'chiller', role: 'mechanical', chillerType: 'air_cooled', equipKey: 'air_cooled_chiller' }];
            return (typeof root.runStageChain === 'function')
                ? root.runStageChain(activeStages, ctx, this)
                : this._simulateHourFallback(ctx);
        },

```

### Task P0-C2：冰機 `AHRI_PRESETS` 額定工況動態歸一化、`carnotLiftFactor` 物理阻尼與部分負載固定損耗修正

#### 檔案位置

* `js/engines_chiller.js:22-29` (`carnotLiftFactor`)

* `js/engines_chiller.js:79-115` (`calcPower` 內 `ahri_biquadratic` 與 `fixed` 分支)

#### 物理依據

1. **解決額定供水溫度 (`t_chws_design`) 與 `AHRI_PRESETS` 7°C 基準不一致之雙重減載 Bug**：
   `engines_core.js` 中的 `AHRI_PRESETS` 係以 $(T_{\text{chws,0}}, T_{\text{cond,0}}) = (7^\circ\text{C}, 30^\circ\text{C}/\text{35}^\circ\text{C})$ 歸一化。當型錄機型（如 `Uniflair XCAC` 額定 `t_chws_c = 20°C`、`Vertiv CoolLoop` 額定 `t_chws_c = 9°C`）套用 `ahri_biquadratic` 曲線時，必須除以該機型自身額定點 $(T_{\text{chws,design}}, T_{\text{cond,design}})$ 的多項式值：
   

   $$
   \text{CapFT}_{\text{norm}}(T, C) = \frac{\text{biQuad}(\text{CapFT}, T, C)}{\text{biQuad}(\text{CapFT}, T_{\text{chws,design}}, T_{\text{cond,design}})}, \quad \text{EIR\_FT}_{\text{norm}}(T, C) = \frac{\text{biQuad}(\text{EIR\_FT}, T, C)}{\text{biQuad}(\text{EIR\_FT}, T_{\text{chws,design}}, T_{\text{cond,design}})}
   $$

   
   如此可保證任何機型在自身型錄額定工況點 $(T_{\text{chws,design}}, T_{\text{cond,design}}, \text{PLR}=1.0)$ 的計算 COP **100% 精確等於型錄標稱 `cop_design`**！

2. **`carnotLiftFactor` 阻尼與吸氣飽和溫度上限 (`20°C`)**：

   * 標準冰機受限於膨脹閥與壓縮機最大操作壓力（MOP），當供水溫度超過 `20°C` 時無法無限提高蒸發壓力；

   * 氣冷式冰機總輸入功率包含約 `25%` 的冷凝風扇功率，不隨壓縮機 Carnot 揚程下降而等比減少，故引入阻尼係數 `chiller_carnot_damp_air = 0.40`（水冷式為 `0.65`）。

3. **`fixed` 模式改用對應壓縮機型式之標準歸一化雙二次曲線與部分負載多項式**：
   當機型未指定曲線或為 `{ type: 'fixed' }` 時，不再使用理想線性 `current_fplr = [0, 1, 0]`（零固定損耗），而是自動對映至經該機型額定點歸一化後的 `air_cooled_screw` / `air_cooled_vfd_centrifugal` / `centrifugal_standard` 曲線。

#### 修改程式碼 (`js/engines_chiller.js:22-115`)

```
  carnotLiftFactor(T_chws, T_cond_in, is_air_cooled, ref) {
    const tCap = (typeof A === 'function') ? A('chiller_evap_temp_cap_c') : 20.0;
    const t_chws_eff = Math.min(T_chws, Math.max(ref?.t_chws ?? 7.0, tCap));
    const Te  = (x) => x - A('chiller_evap_approach_k') + 273.15;
    const off = is_air_cooled ? A('chiller_cond_offset_air_k') : A('chiller_cond_offset_water_k');
    const Tc  = (x, te) => Math.max(x + off + 273.15, te + A('chiller_min_lift_k'));
    const cop = (tchws, tcond) => { const te = Te(tchws); const tc = Tc(tcond, te); return te / (tc - te); };
    const rawRatio = cop(t_chws_eff, T_cond_in) / cop(ref.t_chws, ref.t_cond);
    const damp = is_air_cooled
      ? ((typeof A === 'function') ? A('chiller_carnot_damp_air') : 0.40)
      : ((typeof A === 'function') ? A('chiller_carnot_damp_water') : 0.65);
    const f = 1.0 + (rawRatio - 1.0) * damp;
    return clamp(f, 0.45, A('chiller_lift_factor_max'));
  },

```

並將 `calcPower` 內（第 79–115 行）的曲線評估邏輯替換為：

```
      const t_chws_ref = ch.t_chws_design ?? ch.t_chws_c ?? 7.0;
      const t_cond_ref = ch.t_cewt_design_c ?? (is_air_cooled ? 35.0 : 30.0);

      if (curve.type === 'ahri_biquadratic') {
        const coefs = AHRI_PRESETS[curve.preset] ?? curve.coef_override;
        if (coefs) {
          const [T_lo, T_hi] = coefs.t_chws_range ?? [4, 14];
          const [C_lo, C_hi] = coefs.t_cewt_range ?? [18, 42];
          const T_c = clamp(T_chws, T_lo, T_hi);
          const C_c = clamp(T_cond, C_lo, C_hi);
          const T_ref_c = clamp(t_chws_ref, T_lo, T_hi);
          const C_ref_c = clamp(t_cond_ref, C_lo, C_hi);
          const normCap = Math.max(0.2, biQuad(coefs.CapFT, T_ref_c, C_ref_c));
          const normEir = Math.max(0.2, biQuad(coefs.EIR_FT, T_ref_c, C_ref_c));
          CapFT  = clamp(biQuad(coefs.CapFT,  T_c, C_c) / normCap, 0.4, 1.6);
          EIR_FT = clamp(biQuad(coefs.EIR_FT, T_c, C_c) / normEir, 0.4, 2.0);
          if (T_chws !== T_c || T_cond !== C_c) {
            warnings.push({ code: 'CHILLER_OUT_OF_RANGE', severity: 'info',
              message: `冰機工況超出曲線範圍：CHWS ${T_chws.toFixed(1)}°C [${T_lo}-${T_hi}], CEWT/DB ${T_cond.toFixed(1)}°C [${C_lo}-${C_hi}]，已截斷至邊界值計算` });
            const ref = { t_chws: T_ref_c, t_cond: C_ref_c };
            const liftClamped = ChillerEngine.carnotLiftFactor(T_c, C_c, is_air_cooled, ref);
            const liftActual = ChillerEngine.carnotLiftFactor(T_chws, T_cond, is_air_cooled, ref);
            EIR_FT = clamp(EIR_FT * (liftClamped / liftActual), 0.4, 3.0);
          }
          current_fplr = coefs.EIR_FPLR;
        }
      } else if (curve.type === 'custom_poly') {
        const { a, b, c = 0 } = curve.coef;
        const cop_t = Math.max(1.0, a + b * T_cond + c * T_cond * T_cond);
        EIR_FT = cop / cop_t;
        current_fplr = is_air_cooled ? [0.12, 0.68, 0.20] : [0.06, 0.70, 0.24];
      } else {
        // type === 'fixed' 或預設：對映至經機型額定點 (t_chws_ref, t_cond_ref) 歸一化之 AHRI 曲線與真實部分負載曲線
        const fallbackPresetKey = is_air_cooled
          ? ((cat.includes('centrifugal') || cat.includes('mag')) ? 'air_cooled_vfd_centrifugal' : 'air_cooled_screw')
          : ((cat.includes('mag') || cat.includes('higheff')) ? 'centrifugal_higheff' : 'centrifugal_standard');
        const coefs = AHRI_PRESETS[fallbackPresetKey];
        if (coefs) {
          const [T_lo, T_hi] = coefs.t_chws_range ?? [4, 22];
          const [C_lo, C_hi] = coefs.t_cewt_range ?? [15, 48];
          const T_c = clamp(T_chws, T_lo, T_hi);
          const C_c = clamp(T_cond, C_lo, C_hi);
          const T_ref_c = clamp(t_chws_ref, T_lo, T_hi);
          const C_ref_c = clamp(t_cond_ref, C_lo, C_hi);
          const normCap = Math.max(0.2, biQuad(coefs.CapFT, T_ref_c, C_ref_c));
          const normEir = Math.max(0.2, biQuad(coefs.EIR_FT, T_ref_c, C_ref_c));
          CapFT  = clamp(biQuad(coefs.CapFT,  T_c, C_c) / normCap, 0.4, 1.6);
          EIR_FT = clamp(biQuad(coefs.EIR_FT, T_c, C_c) / normEir, 0.4, 2.0);
          current_fplr = is_air_cooled ? [0.12, 0.68, 0.20] : coefs.EIR_FPLR;
        } else {
          const ref = { t_chws: t_chws_ref, t_cond: t_cond_ref };
          CapFT  = 1.0;
          EIR_FT = 1.0 / ChillerEngine.carnotLiftFactor(T_chws, T_cond, is_air_cooled, ref);
          current_fplr = is_air_cooled ? [0.12, 0.68, 0.20] : [0.06, 0.70, 0.24];
        }
      }

```

### Task P1-H1：水力迴路補齊冷卻水泵 (`CW Pump`)、板交雙迴路附加揚程 (`PHE Head`) 與乙二醇比熱容 ($c_p$)

#### 檔案位置

* `js/store.js:1544-1637` (`bridgeDuToPlantModel`)

#### 物理依據

1. **乙二醇迴路比熱容修正**：
   當液冷排熱架構為 `dry_cooler_pure`、`dry_cooler_trim` 或 `cooling_tower_hx` 時，室外側流體為 25%\~30% 乙二醇/丙二醇水溶液（$c_p = 3.90\text{ kJ/(kg}\cdot\text{K)}$），體積流量較純水高出 `7.3%`。

2. **雙迴路板交 (`hasPhe = true`) 或串聯雙 HX (`dry_cooler_trim`) 附加水頭**：
   當系統啟用中間板式熱交換器隔離（Primary Loop + Secondary Glycol Loop）時，總水力壓降除了管網基準揚程（`28 m`）外，還必須克服板交壓降與二次側管網阻力（`phe_secondary_loop_head_m = 16.0 m`）。

3. **水冷式冰水主機之冷卻水泵 (`CW Pump`)**：
   當液冷採用 `water_chiller` 或氣冷採用 `water_cooled_chiller` 時，除了冰水側循環泵（CHW/FWS Pump）外，冷凝器至冷卻水塔之間必須配置冷卻水泵（CW Pump）：
   

   $$
   \dot{V}_{\text{cw}} = \frac{Q_{\text{evap}} \times (1 + 1/\text{COP}_{\text{design}}) \times 60}{4.186 \times \Delta T_{\text{cw}}}, \quad P_{\text{cw\_pump}} = \frac{\dot{V}_{\text{cw}} \cdot H_{\text{cw}} \cdot g}{60000 \cdot \eta_{\text{pump}} \cdot \eta_{\text{motor}}}
   $$

   
   其中 $\Delta T_{\text{cw}} = 5.5^\circ\text{C}$、$H_{\text{cw}} = 22.0\text{ m}$。

#### 修改程式碼 (`js/store.js:1544-1637`)

在 `bridgeDuToPlantModel(du, duSumm)` 計算 `flowLpm_cdu`、`cduPumpPowerKw` 與 `fwPumpPowerKw` 時替換為：

```
            const arch = cduSys.architecture || 'dry_cooler_hx';
            const hasGlycol = (arch === 'dry_cooler_hx' || arch === 'dry_cooler_pure' || arch === 'dry_cooler_trim' || arch === 'cooling_tower_hx');
            const cpCdu = hasGlycol ? ((typeof A === 'function') ? A('glycol_cp_kj_kgk') : 3.90) : 4.186;
            const dT_cdu = Math.max(1.0, (cduSys.fwsReturnC || 55) - (cduSys.fwsSupplyC || 40));
            const flowLpm_cdu = duSumm.liquidHeatKw > 0 ? Math.round((duSumm.liquidHeatKw * 60) / (cpCdu * 1.0 * dT_cdu)) : 0;
            const pipeCdu = this.selectPipeDnAndVelocity(flowLpm_cdu);

            const baseCduHeadM = cduSys.pumpHeadM ?? ((typeof A === 'function') ? A('cdu_pump_head_default_m') : 28);
            const extraPheHeadM = (cduSys.hasPhe !== false || arch === 'dry_cooler_trim')
                ? ((typeof A === 'function') ? A('phe_secondary_loop_head_m') : 16.0)
                : 0.0;
            const cduHeadM = baseCduHeadM + extraPheHeadM;

            const pumpItemCdu = (cduSys.sizing || []).find(s => s.key === 'cdu_pump');
            const catEntryCdu = pumpItemCdu ? (pumpItemCdu.catalog || []).find(c => c.model === pumpItemCdu.selectedModel) : null;
            const etaPumpCdu = catEntryCdu?.pumpEtaDesign ?? catEntryCdu?.pump_eta_design ?? ((typeof A === 'function') ? A('pump_eta_default') : 0.75);
            const etaMotorCdu = (typeof catEntryCdu?.motor_efficiency_pct === 'number' && catEntryCdu.motor_efficiency_pct > 0)
                ? (catEntryCdu.motor_efficiency_pct / 100)
                : (catEntryCdu?.motorEtaDesign ?? ((typeof A === 'function') ? A('motor_eta_default') : 0.92));
            let cduPumpPowerKw = flowLpm_cdu > 0
                ? (flowLpm_cdu * cduHeadM * 9.80665) / (60000 * etaPumpCdu * etaMotorCdu)
                : 0;

            // P1-H1: 若液冷採用水冷式冰機 (water_chiller)，加計冷凝器側冷卻水泵 (CW Pump) 水力功耗
            if (arch === 'water_chiller' && duSumm.liquidHeatKw > 0) {
                const cwDt = (typeof A === 'function') ? A('cw_loop_delta_t_c') : 5.5;
                const cwHeadM = (typeof A === 'function') ? A('cw_pump_head_default_m') : 22.0;
                const qRejCdu = duSumm.liquidHeatKw * 1.18;
                const flowLpmCw = (qRejCdu * 60) / (4.186 * cwDt);
                cduPumpPowerKw += (flowLpmCw * cwHeadM * 9.80665) / (60000 * etaPumpCdu * etaMotorCdu);
            }

```

並在氣冷迴路計算 `fwPumpPowerKw`（約第 1605–1620 行）後加入水冷式冰機之冷卻水泵功耗：

```
            const fwArch = fwSys.architecture || 'air_cooled_chiller';
            let fwPumpPowerKw = flowLpm_fw > 0
                ? (flowLpm_fw * fwHeadM * 9.80665) / (60000 * etaPumpFw * etaMotorFw)
                : 0;
            if (fwArch === 'water_cooled_chiller' && airHeatTotal > 0) {
                const cwDt = (typeof A === 'function') ? A('cw_loop_delta_t_c') : 5.5;
                const cwHeadM = (typeof A === 'function') ? A('cw_pump_head_default_m') : 22.0;
                const qRejFw = airHeatTotal * 1.20;
                const flowLpmCwFw = (qRejFw * 60) / (4.186 * cwDt);
                fwPumpPowerKw += (flowLpmCwFw * cwHeadM * 9.80665) / (60000 * etaPumpFw * etaMotorFw);
            }

```

## 3. Phase B — 設備型錄、Excel 計算書匯出與 Dashboard 失真修正 (P1-CAT / P1-XLS / P1-UI)

### Task P1-CAT：設備型錄分類錯位與內建型錄欄位補齊

#### 發現問題與檔案位置

1. **`device_catalog/chiller.json:105`**：`"Carrier 30XA 1000kW"` 漏填 `"chiller_type": "air_cooled"`，且 `cop_curve.preset` 誤填為水冷式的 `"screw_standard"`，導致 `CatalogManager` 將氣冷冰機混入 `chiller_water` 水冷冰機選單！

   * **修正**：在 `device_catalog/chiller.json:105` 補上 `"chiller_type": "air_cooled"`，並將 `cop_curve.preset` 改為 `"air_cooled_screw"`。

2. **`device_catalog/cooling_tower/gunther.json` & `js/catalog_manager.js:244-275`**：`gunther.json` 中的 3 款 Güntner 乾冷器（`tower_type: "dry_cooler"`）在 `CatalogManager._mergeExternalCatalog` 中因目錄名為 `cooling_tower` 而被全部塞入 `cooling_tower` 清單，未分流至 `dry_cooler`。

   * **修正**：在 `js/catalog_manager.js` 轉換 `cooling_tower` 條目時，若 `rawItem.tower_type === 'dry_cooler'`，將其推入 `dry_cooler` 分類而非 `cooling_tower`。

3. **`device_catalog/chiller/schneider.json`、`vertiv.json`、`carrier.json`、`trane.json`、`york.json`**：

   * 在完成 **Task P0-C2**（`ChillerEngine` 支援依 `t_chws_design` 動態歸一化）後，可安全地將各廠牌氣冷冰機設定對應之 `cop_curve`：

     * `schneider.json`（6 款 `Uniflair XCAC/XCAF`）與 `vertiv.json`（6 款 `Vertiv CoolLoop`）：`"cop_curve": { "type": "ahri_biquadratic", "preset": "air_cooled_vfd_centrifugal" }`

     * `carrier.json`（2 款 `30XA`）、`trane.json`（`CGAF 800kW`）、`york.json`（2 款 `YVAA`）：`"cop_curve": { "type": "ahri_biquadratic", "preset": "air_cooled_screw" }`

   * 執行 `node device_catalog/build_builtin.js` 重新打包 `js/device_catalog_builtin.js`。

### Task P1-XLS：Excel 8760h 計算書匯出 (`js/excel_export.js`) 四大公式與缺漏修正

#### 發現問題與精確修改位置

1. **\[XLS-1\] Sheet 7 (`7.8760h全年能耗模擬`) 第 B 欄「全廠總能耗 (MWh)」全為 `0.0` (`js/excel_export.js:582` & `js/simulation/annual_runner.js:680-684`)**：

   * **根因**：`excel_export.js:582` 讀取 `m.totalMwh || 0`，但 `annual_runner.js:680-684` 的 `monthlyPue` 陣列只回傳 `{ month, pue, coolingMwh }`，完全沒有 `totalMwh` 與 `itMwh` 欄位！

   * **修正 (`js/simulation/annual_runner.js:680-684`)**：

     ```
     monthlyPue: monthlyStats.map((m, idx) => ({
         month: idx + 1,
         pue: parseFloat((m.totalKwh / (m.itKwh || 1)).toFixed(3)),
         totalMwh: Math.round(m.totalKwh / 1000),
         itMwh: Math.round(m.itKwh / 1000),
         coolingMwh: Math.round(m.coolKwh / 1000)
     })),
     
     ```

2. **\[XLS-2\] Sheet 5 (`5.逐DU冷卻系統設計`) 漏乘 `item.derateFactor` 導致高溫降額容量不足被誤判為「✅ 滿足 N+1」 (`js/excel_export.js:370, 383, 411, 424`)**：

   * **根因**：第 I 欄寫入未降額的標稱 `item.unitCapKw`，第 J 欄公式寫為 `=MAX(0,(H${r}-1))*G${r}`，完全忽略 `item.derateFactor`（例如 `CoolIT CDU 100kW` 在 42°C 下 `derateFactor = 0.76`，9 台實質容量 `684 kW < 862.6 kW`，UI Step 4 顯示「🔴 容量不足」，但匯出的 Excel Sheet 5 卻算出 `900 kW >= 862.6 kW` 並顯示「✅ 滿足 N+1」）。

   * **修正 (`js/excel_export.js:370, 411`)**：將寫入第 G 欄（單機現場容量）的值改為降額後有效容量 `Number(((item.unitCapKw || 0) * (item.derateFactor ?? 1.0)).toFixed(1))`。

3. **\[XLS-3\] Sheet 5 (`5.逐DU冷卻系統設計`) 完全遺漏所有 `CorePOD` 機房的冷卻設備選型表 (`js/excel_export.js:322-450`)**：

   * **根因**：`buildDuCoolingSheet` 只迭代 `state.halls` 下的 `du`，未迭代 `state.corePods.filter(p => p.enabled !== false)`（在高雄 17.95 MW 專案中，CorePOD-A 佔了 3.0 MW IT 與 3 台大型氣冷磁浮冰機，匯出計算書卻完全沒有其選型明細）。

   * **修正**：在 `buildDuCoolingSheet` 的 `(state.halls || []).forEach(...)` 迴圈結束後，對 `(state.corePods || []).filter(p => p.enabled !== false)` 執行相同的 CDU 與 Fanwall 選型表格輸出。

4. **\[XLS-4\] Sheet 3 (`3.氣象與Bin分析`) 寫死 `mode1DbMax = 34.8` 與 `mode2DbMax = 40.5` (`js/excel_export.js:208-214`)**：

   * **根因**：未呼叫 `AppStore.dominantCduThresholds()`，導致不論使用者選擇乾冷器、絕熱塔或水冷冰機，Sheet 3 的自然冷卻溫度門檻永遠固定顯示 `34.8°C / 40.5°C`。

   * **修正 (`js/excel_export.js:208-214`)**：

     ```
     const dom = (typeof window !== 'undefined' && window.AppStore?.dominantCduThresholds)
         ? window.AppStore.dominantCduThresholds()
         : { thresholds: { full: 33.0, mech: 48.0 } };
     const mode1DbMax = Number.isFinite(dom?.thresholds?.full) ? dom.thresholds.full : 33.0;
     const mode2DbMax = Number.isFinite(dom?.thresholds?.mech) ? dom.thresholds.mech : 48.0;
     
     ```

### Task P1-UI：Step 5 Dashboard 即時系統狀態卡片解除硬編碼假數據 (`js/views/view_dashboard.js:992-1079`)

#### 發現問題與檔案位置

在 `js/views/view_dashboard.js:992-1079` 的 4 張即時監控子系統卡片中，多處文字被寫死為靜態常數，與使用者實際設定不符：

1. **第 1003 行 (`CDU 液冷分配單元`)**：寫死 `45°C ⇄ 57°C` 且台數寫死 `allCduSystems.length * 4 台`，功耗寫死 `Math.round(curHour.cduPumpKw * 0.65)`。

   * **修正**：讀取主導液冷系統實際設定之 `${cduSys.fwsSupplyC || 40}°C ⇄ ${cduSys.fwsReturnC || 55}°C`，台數加總各單元 `sizing` 中 `key === 'cdu_unit'` 之 `selectedQty`。

2. **第 1020 行 (`一次側排熱系統`)**：寫死 `40°C ⇄ 55°C`。

   * **修正**：讀取實際 `${cduSys.fwsSupplyC || 40}°C ⇄ ${cduSys.fwsReturnC || 55}°C`。

3. **第 1054 行 (`Fan Wall 機房風牆`)**：寫死 `20°C ⇄ 30°C`、台數寫死 `allFwSystems.length * 8 台`、功耗寫死 `Math.round(curHour.itKw * 0.088)`。

   * **修正**：讀取主導氣冷系統實際設定之 `${fwSys.chwSupplyC || 12}°C ⇄ ${fwSys.chwReturnC || 18}°C`，台數加總 `crah_unit` / `rdhx_unit` 之 `selectedQty`，功耗顯示 `Math.round((res.overall.breakdownKwh.crahFan || 0) / 8760)`。

4. **同步完成 `PUE_Round5_Release_Plan.md` 尚未套用之項目 R-2 \~ R-4**：

   * **R-2**：`index.html:103, 198, 224` 與 `js/app.js:3` 版本號統一升級至 `V33`。

   * **R-3**：`js/store.js:353` 與 `js/views/view_weather.js:581, 614` 改用 `const globalScope = (typeof window !== 'undefined') ? window : globalThis;` 存取 `BUILTIN_WEATHER_DATA`。

   * **R-4**：`js/views/view_cooling.js:339-341` 將 `cduSys.sizing = null` 改為保留使用者手動微調之型號與台數覆寫（或僅重算需求容量）。

## 4. 自動化驗證與迴歸測試腳本 (Verification & Regression Test Suite)

請依下列 Commit 順序執行修改，並在每個 Commit 後執行驗算：

1. **Commit 1 (`fix(physics): P0-E1 electrical loss default 4.5% and project serialization`)**

2. **Commit 2 (`fix(physics): P0-F1 heat rejection fan VFD modulation without 0.5x halving`)**

3. **Commit 3 (`fix(physics): P0-T1 terminal CDU/CRAH derating propagation and active speed floor`)**

4. **Commit 4 (`fix(physics): P0-C1 & P0-C2 chiller FC coil gating, rating-point normalization and Carnot damping`)**

5. **Commit 5 (`fix(hydraulics): P1-H1 condenser water pump, PHE loop head and glycol Cp`)**

6. **Commit 6 (`fix(catalog,excel,ui): P1-CAT, P1-XLS, P1-UI and Round 5 release items`)**

### 4.1 驗算斷言基準 (Acceptance Criteria Assertions)

在 `tests/regression/unit_checks.js` 新增以下核心物理驗算斷言，確保修改後 100% 符合本計畫之驗算數值：

```
// === Round 6 Physics Audit Verification Assertions ===
// 1. P0-E1: 預設廠務電損為 4.5%，且 serializeProject / deserializeProject 完整保留
assert(Math.abs(AppStore.state.facilityElectricalLossPct - 4.5) < 1e-6, 'Default facilityElectricalLossPct must be 4.5%');
AppStore.setFacilityElectricalLossPct(3.8);
const dumped = AppStore.serializeProject();
AppStore.setFacilityElectricalLossPct(0.0);
AppStore.deserializeProject(dumped);
assert(Math.abs(AppStore.state.facilityElectricalLossPct - 3.8) < 1e-6, 'serializeProject/deserializeProject must preserve facilityElectricalLossPct');

// 2. P0-C2: 額定 20°C 供水之 Uniflair XCAC2524A 在 (20°C CHWS, 35°C OAT, PLR=1.0) 時，計算 COP 必須精確等於額定 4.24 (±0.02)
const xcacRes = ChillerEngine.calcPower(2482.2, [{
  model: 'Uniflair XCAC2524A',
  chiller_type: 'air_cooled',
  category: 'Oil-Free Centrifugal Chiller (Air-Cooled)',
  cooling_capacity_kw: 2482.2,
  cop_design: 4.24,
  t_chws_design: 20.0,
  cop_curve: { type: 'ahri_biquadratic', preset: 'air_cooled_vfd_centrifugal' },
  qty_running: 1,
  qty_total: 1
}], 20.0, 35.0, 35.0);
assert(Math.abs(xcacRes.cop_actual - 4.24) < 0.02, `Uniflair XCAC2524A rating point COP must be 4.24, got ${xcacRes.cop_actual}`);

// 3. P0-C1: 純氣冷冰機 (Uniflair XCAC1913A) 不得啟用 fc_coil 自然冷卻，在 20°C 外氣、20/30°C 冰水下仍為 mechanical 模式
const airArch = CoolingArchRegistry.get('air_cooled_chiller');
const opXcac = airArch.operatingPoint(
  { chwSupplyC: 20, chwReturnC: 30, sizing: [{ key: 'air_cooled_chiller', selectedModel: 'Uniflair XCAC1913A' }] },
  { db: 20, wb: 16 }
);
assert(opXcac.mode === 'mechanical' && opXcac.fc_fraction === 0, 'Pure air-cooled chiller XCAC must not enable free-cooling coil');

const opXcaf = airArch.operatingPoint(
  { chwSupplyC: 20, chwReturnC: 30, sizing: [{ key: 'air_cooled_chiller', selectedModel: 'Uniflair XCAF1913A (含自然冷卻盤管)' }] },
  { db: 20, wb: 16 }
);
assert(opXcaf.mode !== 'mechanical' && opXcaf.fc_fraction > 0, 'Integrated FC chiller XCAF must enable free-cooling coil when DB + approach < chwReturnC');

// 4. 全系統高雄預設專案與 17.95 MW 高雄存檔專案 PUE 合理性區間斷言
// 預設專案 (高雄, 4.5% 電損): Annual PUE = 1.183 ± 0.005 (純機械 0% 電損 PUE = 1.124 ± 0.005)
// 17.95 MW 高雄存檔專案 (4.5% 電損): Annual PUE = 1.164 ± 0.005, DU-01 PUE = 1.128 ± 0.005

```