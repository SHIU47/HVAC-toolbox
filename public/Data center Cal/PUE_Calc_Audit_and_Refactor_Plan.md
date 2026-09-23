# PUE 計算系統（Data center Cal）— 檢驗報告與修正／重構執行計畫

- 審查範圍：`public/Data center Cal/`（index.html、js/engines_*.js、js/store.js、js/views/*.js、js/catalog_manager.js）
- 審查者：Claude Opus 5.5（2026-09-23）
- 執行者：Claude Sonnet 5（依本文件逐項執行）
- 本文件的「Phase 4」＝ UI 的 **Step 4「逐 DU 雙冷卻系統」**（`views/view_cooling.js` + `store.js` 的 `calcHourlyEnergy` / `bridgeDuToPlantModel` / `generate*Sizing`）

---

## 0. 給 Sonnet 的執行守則（必讀，違反任一條視為任務失敗）

1. **只動這些路徑**：`public/Data center Cal/**`、新建的 `tools/pue_regression/**`、本文件。
   **不要**動 `dist/`（那是 build 產物）、不要跑 `build.js`、不要部署 Firebase、不要 push。
2. 開分支：`git checkout -b pue-audit-fixes`。**一個任務一個 commit**，commit message 用任務編號開頭（例：`P0-3: normalize AHRI presets`）。工作目錄裡已經有大量未提交的 `dist/*` 變更，**不要 `git add -A`**，只 add 自己改的檔案。
3. **UI 不能跑掉**：不改任何 Tailwind class、DOM 結構、元素 id、`onchange` 函式名稱。允許改的只有「顯示出來的數字」以及本文件明確列出的文字。每個任務完成後跑 §6 的 UI 結構快照比對。
4. **結果欄位契約不能變**：`AppStore.state.results` 底下所有既有欄位名稱與型別（見 §5.4）必須保留，Dashboard / Excel 匯出都靠它們。可以新增欄位，不可改名或刪除。
5. **公式照本文件寫**。本文件沒給的數字不要自己發明；需要新常數時，一律加到 `js/assumptions.js` 的 `ASSUMPTIONS`（附 `label` 與 `ref`），程式用 `A('key')` 取值。
6. 每個任務完成後跑 §6 的回歸測試，把「修改前 → 修改後」的 PUE / WUE / 冰機 MWh 差異貼在 commit message 內文。差異方向必須符合該任務寫的「預期影響」，不符合就停下來回報，不要硬調參數讓它符合。
7. 執行順序：**Phase A → B → C → D**，同一 Phase 內照編號順序。Phase E 是未來規劃，本次不做。
8. 遇到本文件 §7「需東旭決定」的項目，採用文件寫的預設做法，並在最後回報中列出。

---

## 1. 總覽

### 1.1 結論

| 類別 | 數量 | 說明 |
|---|---|---|
| P0 計算錯誤（結果明顯失真或功能失效） | 7 | 部分自然冷卻模型錯、Trim 冰機工況參數錯、AHRI 曲線未正規化、全額水冷架構抓不到選型設備、新增的 CorePOD 不進計算、Fanwall 自然冷卻門檻錯 |
| P1 計算問題（系統性偏差／不一致） | 10 | 選型沒用降額容量、電力損失熱沒被冷卻、耗水公式不一致、容量不足警示永遠不會觸發、Dashboard 設備台帳是假數字… |
| M 維護性問題 | 9 | store.js 2355 行包山包海、架構字串 if/else 散落 6 個檔案、DU/CorePOD 迴圈重複、魔術數字… |

### 1.2 修正前基準（已實測）

以 Node 載入全部引擎 + `AppStore.calculate()`，預設專案（1 Hall / 1 DU / 1 CorePOD，IT 1.08 MW）：

| 城市 | PUE | pPUE | WUE | CDU FC % | 尖峰 PUE | 容量不足小時 | 冰機 MWh |
|---|---|---|---|---|---|---|---|
| 新加坡 | 1.112 | 1.065 | 0 | 99.8 | 1.152 | 0 | 387 |
| 桃園 | 1.103 | 1.056 | 0 | 99.9 | 1.159 | 0 | 278 |
| 高雄 | 1.109 | 1.062 | 0 | 99.3 | 1.187 | 12 | 350 |
| 新竹 | 1.103 | 1.056 | 0 | 100 | 1.133 | 0 | 282 |
| 台中 | 1.106 | 1.059 | 0 | 98.7 | 1.175 | 9 | 314 |
| 菲律賓 | 1.113 | 1.066 | 0 | 96.6 | 1.183 | 18 | 392 |
| 美國 Alabama | 1.102 | 1.055 | 0 | 94.7 | 1.188 | 222 | 256 |

---

## 2. P0 計算錯誤

### P0-1　新增的 CorePOD 完全不進計算

- **位置**：`store.js:457-493`（`addCorePod` 建立的物件沒有 `enabled`）；`store.js:1161`、`store.js:1864` 用 `p.enabled` 過濾；但 `view_cooling.js:40`、`excel_export.js:280` 用 `p.enabled !== false`。
- **後果**：使用者在 Step 3 新增的 CorePOD 會出現在 Step 4 畫面和 Excel，但 **PUE 計算與 N+1 檢核都把它排除**。IT 容量、能耗全部漏掉，且不會有任何提示。
- **修正**：
  1. `addCorePod` 的 `newPod` 加 `enabled: true`。
  2. `store.js:1161`、`store.js:1864` 改成 `p.enabled !== false`（全專案統一這個寫法）。
  3. `deserializeProject` 載入後，把缺 `enabled` 的 pod 補成 `true`。
- **驗收**：Node 測試中呼叫 `addCorePod()` 後 `calculate()`，`results.byCorePod.length` 要 +1，`overall.totalItKw` 要增加該 pod 的 IT。

### P0-2　「全額水冷式冰機」架構永遠抓不到選型的冰機

- **位置**：`store.js:883` 選型清單 key 是 `'water_cooled_chiller'`，但 `store.js:1472` 找的是 `s.key === 'water_chiller'`。
- **後果**：`water_chiller` 架構下使用者在 Step 4 選什麼冰機、幾台都無效，一律走 `liquidHeatKw / 5.5` 的固定 COP 近似值。
- **修正**：`store.js:1472` 改找 `'water_cooled_chiller'`。
- **⚠ 必須跟 P0-4 在同一個 commit 一起做**。實測：key 修好但冰機模型沒修時，CHWS=40°C、CEWT=32°C 會算出 COP 14.6（`fixed` 曲線線性外推到 T_chws=40°C 沒有截斷），PUE 會從 1.268 掉到不合理的低值。

### P0-3　AHRI 雙二次曲線預設值未正規化（額定點不等於 1.0）

- **位置**：`engines_core.js:34-80`（`AHRI_PRESETS`）。
- **實測**（額定點水冷 7/30°C、氣冷 7/35°C，理論上 CapFT = EIR_FT = 1.000）：

| preset | CapFT | EIR_FT | 影響 |
|---|---|---|---|
| centrifugal_standard | 1.000 | 1.000 | 正確 |
| centrifugal_higheff | 0.990 | **0.852** | 額定點耗電被低估 15%（COP 虛高 17%） |
| screw_standard | 1.002 | **1.115** | 額定點耗電被高估 11.5% |
| air_cooled_screw | **0.833** | 1.002 | 額定點容量只剩 83%，逐時容量不足誤判 |
| air_cooled_vfd_centrifugal | **0.917** | **0.844** | 容量與耗電都偏 |

  `device_catalog_builtin.js` 內的 Trane/York/Carrier 冰機都掛了這些 preset，所以選到這些型號時 PUE 直接受影響。
- **修正**：在 `engines_core.js` 的 `AHRI_PRESETS` 宣告之後加一段載入時正規化（整組係數除以額定點的值，曲線形狀不變，額定點變成精確 1.0）：

```js
// 額定點：AHRI 550/590 水冷 LCHWT 7°C / ECWT 30°C；氣冷 LCHWT 7°C / 外氣 DB 35°C
const AHRI_RATING_POINT = { water: { t_chws: 7, t_cond: 30 }, air: { t_chws: 7, t_cond: 35 } };
for (const [key, p] of Object.entries(AHRI_PRESETS)) {
  const r = key.startsWith('air_') ? AHRI_RATING_POINT.air : AHRI_RATING_POINT.water;
  const fCap = biQuad(p.CapFT, r.t_chws, r.t_cond);
  const fEir = biQuad(p.EIR_FT, r.t_chws, r.t_cond);
  p.CapFT  = p.CapFT.map(c => c / fCap);
  p.EIR_FT = p.EIR_FT.map(c => c / fEir);
  p.rating = r;
}
```

- 同時修 `engines_chiller.js:186-191`：氣冷機 `deratedCapacityKW` 在 `cop_curve.type === 'ahri_biquadratic'` 時要改用曲線 `CapFT(T_chws_design, db_design)`，不能只用線性 1.2%/°C，否則「選型判定」跟「逐時容量」用不同模型（選型說夠、逐時說不夠）。
- **驗收**：新增測試斷言五個 preset 在各自額定點 `CapFT`、`EIR_FT` 皆為 1.000 ± 1e-9。

### P0-4　冰機在曲線範圍外的工況被錯誤外推／截斷（缺少「揚程」物理）

- **位置**：`engines_chiller.js:70-104`。
  - `ahri_biquadratic`：工況超出 `t_chws_range`/`t_cewt_range` 就直接 clamp 到邊界值 → CHWS 30°C 被當成 14°C 算，COP 完全不反映溫升。
  - `fixed`：`EIR_FT = 1 + 0.016(Tc−30) − 0.018(Tchws−7)` 線性外推**沒有範圍保護**，CHWS=40°C 時 EIR_FT 跌到 0.5 下限、CapFT 撞 1.5 上限。
- **為什麼這很重要**：液冷系統的 Trim 冰機／全額水冷冰機都在 CHWS 30–40°C 運轉，遠超出 AHRI 曲線（4–14°C）的定義域。這正是本工具最核心的工況。
- **修正**：在 `ChillerEngine` 加「Carnot 揚程比例」修正（固定 Carnot 效率假設，業界常用的外推方法），用於曲線定義域外：

```js
// 新增到 assumptions.js
chiller_evap_approach_k:   { val: 2.0,  unit: 'K', label: '冰機蒸發溫度 = 冰水出水溫 − 此值', ref: '殼管/板式蒸發器典型 1.5–3 K' },
chiller_cond_offset_water_k:{ val: 7.0, unit: 'K', label: '水冷冰機冷凝溫度 = 冷卻水進水溫 + 此值（含冷卻水溫升 5K + approach 2K）', ref: 'AHRI 550/590 標準工況 30→35°C，冷凝器 approach ≈ 2K' },
chiller_cond_offset_air_k: { val: 15.0, unit: 'K', label: '氣冷冰機冷凝溫度 = 外氣乾球 + 此值', ref: '氣冷冷凝器典型 TD 12–17 K' },
chiller_min_lift_k:        { val: 10.0, unit: 'K', label: '壓縮機最小揚程（冷凝−蒸發），低於此值以此值計', ref: '離心/螺旋機油壓差與防喘振限制，磁浮機可低至 5–8 K' },
chiller_lift_factor_max:   { val: 2.0,  unit: '-', label: '揚程修正後 COP 最多為設計 COP 的倍數', ref: '保守上限，避免低揚程外推過度樂觀' },
```

```js
// engines_chiller.js 內新增
carnotLiftFactor(T_chws, T_cond_in, is_air_cooled, ref) {
  const Te  = (x) => x - A('chiller_evap_approach_k') + 273.15;
  const off = is_air_cooled ? A('chiller_cond_offset_air_k') : A('chiller_cond_offset_water_k');
  const Tc  = (x, te) => Math.max(x + off + 273.15, te + A('chiller_min_lift_k'));
  const cop = (tchws, tcond) => { const te = Te(tchws); const tc = Tc(tcond, te); return te / (tc - te); };
  const f = cop(T_chws, T_cond_in) / cop(ref.t_chws, ref.t_cond);
  return clamp(f, 0.3, A('chiller_lift_factor_max'));
}
```

  使用規則：
  1. `fixed`（或 `cop_curve` 缺漏）：`CapFT = 1.0`（不臆測容量變化），`EIR_FT = 1 / carnotLiftFactor(T_chws, T_cond, air, ref)`，`ref` 用 `{ t_chws: ch.t_chws_design ?? 7, t_cond: air ? 35 : 30 }`。**刪掉**原本的線性公式。
  2. `ahri_biquadratic` 且工況在定義域內：照舊。
  3. `ahri_biquadratic` 且工況超出定義域：先用 clamp 後的點算曲線值（照舊），再把 `EIR_FT` 乘上 `carnotLiftFactor(clamped) / carnotLiftFactor(actual)`（`ref` 用 preset 的 `rating`）。這樣在邊界上連續，超出後依揚程變化。`CHILLER_OUT_OF_RANGE` 警告保留。
  4. `custom_poly` 不動。
- **resolveChillerFromSizing（store.js:1203-1219）** 一併把型錄的 `category`、`chiller_type`（若型錄有）帶進去，讓 `MIN_PLR` 依壓縮機型式判定，而不是永遠用 default。
- **驗收**：
  - 7/30 水冷、7/35 氣冷：`fixed` 曲線 COP = `cop_design`（誤差 < 1e-9）。
  - 水冷 CHWS 30 / CEWT 45 的 COP 必須 **低於** CHWS 30 / CEWT 35 的 COP（揚程越大 COP 越低）。
  - CHWS 40 / CEWT 32 時 COP ≤ `cop_design × 2.0`，且不再出現 COP 14.6。

### P0-5　「部分自然冷卻」用固定 3°C 帶寬線性內插，物理上錯誤

- **位置**：`engines_free_cooling.js:63-80`（`calcWatersideFC`）、`:113-126`（`calcDryCoolerFC`）、`:154-167`（`calcCoolingTowerFC`）、`:379-392`（`calcDLCWarmWaterFC`）、`:336-349`（`calcSeaWaterFC`）。
- **問題**：串聯預冷（乾冷器／板換先把回水預冷，冰機只修整剩下的溫差）的冰機負擔比例應該是
  `f_mech = (T_avail − T_sup) / (T_ret − T_sup)`，
  分母是**迴路溫差**（例如 FWS 40/55 → 15K），不是固定 3K。現行公式把分母寫死 3K，等於冰機負擔被放大 ΔT/3 倍；T_avail 超過 T_sup+3 就直接判 100% 機械製冷，但此時乾冷器其實還能預冷大半負載。
- **實測（高雄，FWS 40/55）**：需要 Trim 的 61 小時裡，Σ冰機負擔比例：現行模型 25.0，正確串聯模型 5.0（**高估 5 倍**）。FWS 越低（例如「案場慣用值」37/47）、氣候越熱，偏差越大。
- **修正**：
  1. `FreeCoolingEngine` 新增共用函式：
     ```js
     calcSeriesEconomizer(t_available_c, t_supply_c, t_return_c) {
       const dt = t_return_c - t_supply_c;
       if (!(dt > 0)) return { mode: t_available_c <= t_supply_c ? this.MODE.FULL_FC : this.MODE.MECHANICAL,
                               fc_fraction: t_available_c <= t_supply_c ? 1 : 0, chiller_fraction: t_available_c <= t_supply_c ? 0 : 1 };
       const f_mech = clamp((t_available_c - t_supply_c) / dt, 0, 1);
       const mode = f_mech <= 0 ? this.MODE.FULL_FC : (f_mech >= 1 ? this.MODE.MECHANICAL : this.MODE.PARTIAL_FC);
       return { mode, fc_fraction: 1 - f_mech, chiller_fraction: f_mech, t_precooled_c: clamp(t_available_c, t_supply_c, t_return_c) };
     }
     ```
  2. 上面五個函式都多收一個回水溫（`cc.t_return_cdu_c` 或 `cc.t_return_chw_c`）；有給就走 `calcSeriesEconomizer`，沒給才保留舊的帶寬邏輯並 `console.warn` 一次（相容舊呼叫端）。回傳物件原有欄位保留，另外帶出 `t_precooled_c`。
  3. 所有 store.js 呼叫端都必須傳回水溫（見 P0-6、P0-7）。
- **預期影響**：Trim 冰機 MWh 下降；熱氣候（菲律賓、Alabama）與低 FWS 設定下降較多。PUE 小幅下降。

### P0-6　Trim 冰機（NVIDIA DSX 乾冷器＋串聯修整）運轉工況參數用錯

- **位置**：`store.js:1349-1383`、`store.js:2236-2248`；對照 UI 拓樸 `view_cooling.js:720-725`。
- **問題**：
  1. 冰機冰水出水溫用 `cduSys.fwsSupplyC`（40°C），但 Step 4 拓樸圖畫的是冰機產出 `min(30, FWS−7)` 的冰水進 Secondary HX。**計算與圖不一致**。
  2. 冷凝器進水溫用 `w.db + cduSys.cduApproachC`——`cduApproachC` 是 **CDU 板換 approach（二次側↔一次側）**，跟冷凝器無關，參數拿錯。依拓樸圖，冷凝器串在乾冷器迴路、位於 Primary HX 之後，進水溫應該是「乾冷器出水 + 吸收預冷熱後的溫升」。
  3. 乾冷器 approach 在程式裡被命名成 `cduApproach`（`store.js:1281`、`view_cooling.js:288`），跟真正的 `cduApproachC` 同名不同義，是 2 的根源。
  4. 選型 `peakRatio` 寫死 `peakDb = 38.0`，且用**二次側**溫差 `secReturnC − secSupplyC` 當分母；逐時模擬卻用 3K 帶寬。三處（`generateCduSizing` 的 0.35、`bridgeDuToPlantModel` 的 peakRatio、逐時）各算各的。
- **修正**（全部集中在一個 helper，Step 4 拓樸圖也改呼叫它，確保圖＝算）：

```js
// store.js（Phase C 後搬到 cooling/archs/cdu_dry_cooler_trim.js）
trimOperatingPoint(cduSys, db_c) {
  const dcApp   = cduSys.dryCoolerApproachC ?? 5.0;          // 乾冷器 approach
  const pheApp  = cduSys.pheApproachC ?? 2.0;                // Primary HX approach
  const tSup    = cduSys.fwsSupplyC, tRet = cduSys.fwsReturnC;
  const tDc     = db_c + dcApp;                              // 乾冷器出水
  const eco     = FreeCoolingEngine.calcSeriesEconomizer(tDc + pheApp, tSup, tRet);
  const tPre    = eco.t_precooled_c;                         // FWS 經 Primary HX 預冷後溫度
  const tChws   = cduSys.trimChwSupplyC ?? Math.min(30, tSup - 7);   // 與 view_cooling.js:724 同一公式
  // 乾冷器側水在 Primary HX 吸收預冷熱後進冷凝器（平衡流量假設，與拓樸圖一致）
  const tCewt   = Math.max(A('min_cewt_c'), tDc + (tRet - tPre));
  return { ...eco, tDc, tPre, tChws, tCewt };
}
```

  - 逐時：`trimLoadKw = liquidHeatKw × op.chiller_fraction`；`ChillerEngine.calcPower(trimLoadKw, staged, op.tChws, op.tCewt, w.db)`（冰機維持 `water_cooled`，冷凝器是水側）。
  - 乾冷器風扇：全自然冷卻時 `plr_ct = cduLoadRatio`；有 Trim 時乾冷器要排 `Q_liq + P_trim`，`plr_ct = 1.0`。
  - `view_cooling.js:720-725` 的 `precoolTemp / condWaterEnterExact / chwSupplyTemp` 改用 `trimOperatingPoint(cduSys, 設計DB)` 的 `tPre / tCewt / tChws`，`0.4`、`+4.8` 這些魔術數字刪除（拓樸圖上只有數字改變，DOM 不變）。
  - 選型：新增 `designConditions()`（見 P1-1）取得案場設計 DB（0.4% 超越值）。`trim_chiller.requiredKw = liquidHeatKw × trimOperatingPoint(cduSys, designDb).chiller_fraction`，下限 50 kW 保留；`maxMechanicalKw = liquidHeatKw × trimOperatingPoint(cduSys, 年最高DB).chiller_fraction`。`generateCduSizing` 的 `0.35` 改呼叫同一函式。`peakRatio` 欄位保留（UI 有用），值改成上面算出的比例。
  - `dry_cooler.requiredKw` 改為 `liquidHeatKw + 設計點 Trim 冰機耗電`（冷凝熱也經乾冷器排出）。
  - 變數改名：`store.js` 與 `view_cooling.js` 內指乾冷器 approach 的區域變數 `cduApproach` 全部改名 `dcApproach`（只改區域變數名，不改 state 欄位名）。
- **預期影響**：Trim 冰機 COP 變得合理（揚程約 20–25K，不再是 ≈0K）；Trim 小時數與負擔比例下降（P0-5）。兩者方向相反，淨效果依氣候而定——**請在 commit 內文列出 7 城市的 Trim 冰機 MWh 與平均 COP**。

### P0-7　Fanwall 氣冷系統的自然冷卻門檻物理錯誤（大幅高估）

- **位置**：`store.js:1550`（rdhx）、`store.js:1605`（air_cooled_chiller）：`w.db <= airSideEconomizerThresholdC (18)` 就判 100% 自然冷卻。
- **問題**：CHW 12/18°C 的氣冷冰機要靠 free-cooling coil 全自然冷卻，外氣必須 **低於供水溫減盤管 approach**（≈ 8°C），不是低於回水溫 18°C。18°C 只是部分預冷的起點。
- **實測（CHW 12/18，盤管 approach 4K）**：

| 城市 | 現行模型判「全自然冷卻」小時 | 物理上可全自然冷卻 | 物理上部分預冷 |
|---|---|---|---|
| 桃園 | 2052 | 9 | 497 |
| 高雄 | 623 | 0 | 15 |

- **修正**：
  1. `assumptions.js` 新增：
     ```js
     air_chiller_fc_coil_approach_c: { val: 4.0, unit: '°C', label: '氣冷冰機 free-cooling 盤管 approach（外氣 DB → 預冷後回水）', ref: '廠商型錄典型 3–5°C' },
     air_chiller_fc_fan_kw_per_kw:   { val: 0.05, unit: 'kW/kW', label: '氣冷冰機自然冷卻模式風扇耗電（每 kW 自然冷卻量）', ref: '沿用原程式 5% 概估，待型錄風扇功率資料取代' },
     rdhx_fc_fan_kw_per_kw:          { val: 0.03, unit: 'kW/kW', label: 'RDHX 系統自然冷卻模式排熱風扇耗電', ref: '沿用原程式 3% 概估' },
     ```
  2. rdhx 與 air_cooled_chiller 都改成串聯預冷：
     `eco = calcSeriesEconomizer(w.db + A('air_chiller_fc_coil_approach_c'), chwSupplyC, chwReturnC)`；
     `Q_fc = airHeatTotal × eco.fc_fraction` → 風扇 `Q_fc × A(...)`；
     `Q_mech = airHeatTotal × eco.chiller_fraction` → `ChillerEngine.calcPower`；
     `fwMode` 依 `eco.mode`。
  3. `water_cooled_chiller`（`store.js:1565-1598`）同樣改：`T_avail = w.wb + A('tower_approach_c') + A('hx_approach_c')`，走 `calcSeriesEconomizer`；原本 `calcCoolingTowerFC` 寫死的 `safety_margin = 1.5` 不再用。
  4. `fwSys.airSideEconomizerThresholdC` 不再參與計算（欄位保留在 state 以相容舊專案，不必刪）。
- **預期影響**：Fanwall 冰機運轉時數大增 → **PUE 上升**（桃園約 +0.01 量級）、`fwFcStats.freeHours` 大幅下降。這是修正高估，不是退步。

---

## 3. P1 計算問題

### P1-1　設備選型用型錄「標稱容量」，降額函式寫了卻沒人呼叫

- **位置**：`ChillerEngine.deratedCapacityKW`、`CoolingTowerEngine.deratedCapacityKW`、`CDUEngine.deratedCapacityKW` 全專案零呼叫；`store.js:2250-2254`、`:2316-2320` 直接 `effectiveCapKw = (qty−1) × capKw`。
- **後果**：台灣夏季 WB 28°C 下冷卻塔實際容量 ≈ 94%、氣冷冰機 38°C 約 96%，Step 4 仍顯示「🟢 滿足 N+1」。
- **修正**：
  1. `AppStore` 新增 `designConditions()`：從 `site.hourly` 取 **DB 0.4% 超越值**（8760 小時排序後第 35 大）、**WB 0.4% 超越值**、年最高 DB；沒有逐時資料時 DB 用 `site.stats.maxDB`、WB 用 `A('design_wb_fallback_c')`。結果快取到 `state.site.design`，`updateSite` 時失效。
  2. `bridgeDuToPlantModel` 算 `effectiveCapKw` 時乘上降額係數：
     - 冰機：`ChillerEngine.deratedCapacityKW(catEntry → spec, T_chws, T_cewt 或 designDb)`
     - 冷卻塔／絕熱塔／閉式塔：`CoolingTowerEngine.deratedCapacityKW(spec, designWb)`
     - CDU：`CDUEngine.deratedCapacityKW(capKw, fwsSupplyC)`
     - 乾冷器、泵、CRAH、RDHX、板換：係數 1.0（目前沒有可靠模型，不臆測）
  3. 新增欄位 `s.derateFactor`；`s.unitCapKw` 保持標稱值（UI 的「總容量」那行不變），`effectiveCapKw = (qty−1) × unitCapKw × derateFactor`。`requiredText` 在降額 < 0.999 時尾巴加 `（已依設計工況降額 ×0.94）`。
- **預期影響**：部分原本通過的選型會變「容量不足」，這是正確行為。

### P1-2　電力損失產生的熱沒有被冷卻，熱平衡帳本是套套邏輯

- **位置**：`calcDuSummary` / `calcCorePodSummary`（`store.js:299-351`）永遠回傳 `lossKw: 0`；`calcHourlyEnergy` 用 `summ.airHeatKw + summ.lossKw`（`store.js:1504`）→ 損失熱永遠是 0；但 `byDu[].lossKw = IT × facilityLossPct`，`thermalLedger`（`store.js:2021-2028`）又把它加進「已移除熱量」，所以帳本永遠平衡。
- **修正**（預設做法，見 §7-D1）：
  1. `calculate()` 裡，對每個 DU/Pod 先算 `summ.lossKw = summ.totalItKw × facilityLossPct/100`，**再**傳進 `bridgeDuToPlantModel` 與 `calcHourlyEnergy`（損失熱由該單元的氣冷系統負擔）。
  2. `calcHourlyEnergy` 回傳新增 `heatRemovedKw`（= CDU 實際處理的液冷熱 + Fanwall 實際處理的氣冷熱 − 容量缺口）。`thermalLedger.total_heat_removed_kwh` 改用逐時累加的 `heatRemovedKw`，才是真正的雙路徑交叉驗證；`is_balanced=false` 時 Dashboard 既有的警示自然會亮。
- **預期影響**：`facilityElectricalLossPct = 0`（預設）時無變化；>0 時 Fanwall 負載與冰機耗電增加。

### P1-3　耗水計算前後不一致

- `store.js:1277` 寫死 `evapFactor = 0.00124`，沒用 `A('ct_evap_m3h_per_kw')`（值一樣但改假設表不會生效）→ 改用 `A()`。
- `ASSUMPTIONS.ct_evap_m3h_per_kw` 的 `ref` 寫「1.8 L/min / 100 kW」= 0.00108，跟 0.00124 對不上。0.00124 本身合理（h_fg ≈ 2430 kJ/kg、潛熱佔 ~84%）。把 ref 改成：`'蒸發量 = Q × 潛熱比 / h_fg；h_fg≈2430 kJ/kg、潛熱比≈0.84 → 0.00124 m³/h/kW'`。
- Fanwall 水冷冰機（`store.js:1596`）蒸發量只用 `airHeatTotal`，漏了壓縮機熱；CDU 的 `water_chiller`（`store.js:1490`）已經在 v41 修正成 `Q + P_chiller`。Fanwall 比照：自然冷卻部分 `Q_fc`、機械部分 `Q_mech + P_chiller`。
- `cooling_tower_hx`（`store.js:1447`）：`cycles − 1` 在 `cyclesOfConcentration = 1` 時除以 0 → 改 `Math.max(1, cycles − 1)`（adiabatic 那段已有保護，統一）。

### P1-4　絕熱冷卻塔耗水是經驗係數，不是熱平衡

- **位置**：`store.js:1408-1416`（`evapFactor × 0.45 × wetFraction`）。
- **修正**（絕熱預冷的水量 = 把空氣從 DB 降到有效乾球所需的蒸發量）：
  ```
  T_eff   = db − (db − wb) × satEff
  ΔT_air  = A('adiabatic_coil_air_dt_k')                 // 新增，預設 10 K，盤管空氣側溫升
  m_air   = Q_rej / (1.006 × ΔT_air)                    // kg/s
  m_evap  = m_air × 1.006 × (db − T_eff) / 2450          // kg/s，h_fg≈2450 kJ/kg
  evapM3h = m_evap × 3.6                                // m³/h
  blowdown = evap / max(1, cycles − 1)
  ```
  新增 assumption `adiabatic_coil_air_dt_k`（val 10, ref「乾冷器／絕熱盤管空氣側溫升典型 8–12 K」）。`drySwitchpoint` 的 `9.2` 也搬進 ASSUMPTIONS（`adiabatic_switchpoint_offset_c`，ref 照 UI 那段說明）。
- **預期影響**：絕熱塔 WUE 會變（方向依氣候），commit 內文列出 7 城市 WUE。

### P1-5　容量不足警示永遠不會觸發

- `CDUEngine.calcPower`（`engines_cdu.js:26`）與 `CRAHEngine.calcPower`（`engines_crah.js:23`）把 `plr` 先 `min(1.0)` 再回傳，`validate()` 裡 `plr > 1.0` / `plr > 1.02` 永遠 false；而且整個專案沒有任何地方呼叫這些 `validate()`。
- **修正**：兩個 `calcPower` 多回傳 `plr_raw`（未截斷）與 `deficit_kw = max(0, load − cap_total)`。`calcHourlyEnergy` 把 CDU、CRAH/RDHX 的 `deficit_kw` 累加進 `capacityDeficitKw`（跟冰機缺口同一個欄位），Dashboard 既有的容量不足警示就會涵蓋它們。

### P1-6　`fcPotential` / `getEffectiveFcThresholds` 是死碼

- `store.js:1689-1722` 算好的 `fcPotential` 會在 `store.js:2120` 被整個 `this.state.results = {...}` 覆蓋掉；`getEffectiveFcThresholds` 只有這裡用，而且對濕球驅動的架構（閉式塔）也用乾球門檻。
- **修正**：刪除 `store.js:1680-1722` 這段與 `getEffectiveFcThresholds`（先 grep 確認沒有其他呼叫端）。

### P1-7　`isFreeHour` 定義不一致

- `store.js:1552`、`:1580` Fanwall 自然冷卻時 `isFreeHour = true`，即使 CDU 正在機械製冷；`air_cooled_chiller` 分支（`:1605`）卻不設。`byDu[].fcHours` 因此意義混亂。
- **修正**：`calcHourlyEnergy` 結尾統一：`isFreeHour = (liquidHeatKw === 0 || cduMode === 'free') && (airHeatTotal === 0 || fwMode === 'free')`，刪掉各分支裡的設定。

### P1-8　Dashboard「設備 FLH 台帳」是假數字

- **位置**：`view_dashboard.js:762-819`。台數寫死 `系統數 × 4 / × 8 / × 2 + 1`；額定功率寫死 `IT × 0.008 / 0.018 / 0.025 / 0.012 / 0.09 / COP`；CDU 主機列用 `cduPump × 0.35`、泵列又用 `cduPump × 100%`（**同一筆能耗算兩次**）；冰機時數 fallback `3657`；`copBase 4.29 / 6.5` 與 `copDynamic` 是自編公式。
- **修正**：
  1. 台數、額定功率改從各單元 `sizing[]` 加總：台數 = Σ`selectedQty`；額定功率 = Σ(`runningQtyFromSelected(qty)` × 型錄 `powerKw` / `fanPowerKw` / `fanKwDx` / `capKw÷cop`)。
  2. `calcHourlyEnergy` 的 `cduKwh` 拆成 `cduUnit`（CDU 主機）與 `pump`（一次泵）兩個分項，`byDu` / `overall.breakdownKwh` **新增**（不是改名）`cduUnitKwh`，台帳第一、二列各自用對應分項。
  3. 冰機運轉時數改用 `hourlyProfile` 中 `chillerKw > 0` 的小時數。
  4. COP 顯示改用逐時 `Q_mech / chillerKw`（需要 `hourlyProfile` 新增 `mechLoadKw` 欄位）。
  5. `cduArchNames` / `fwArchNames`（`view_dashboard.js:729-739`）缺 `dry_cooler_trim`、`dry_cooler_hx`、`chilled_water_plant`，且 `cooling_tower_hx` 被寫成「開式冷卻水塔 + 板換」，Step 4 卻是「密閉式」。Phase C 之後改讀架構登錄表（§5）的 `dashboardLabel`；Phase B 先直接補齊並改成「密閉式冷卻水塔」。
- 版面、欄位、表頭都不動，只換數字來源。

### P1-9　型錄非同步載入的競態

- `catalog_manager.js:274` 在 script 載入時就呼叫 `async init()`；在 http(s)（Firebase 上線版）走 `fetch`，`app.js` 的 `DOMContentLoaded` 可能先跑完第一次 `calculate()`，sizing 的 `catalog` 快照拿到的是沒有 `cop_curve` 的最小內建清單；型錄載完後也沒有重算。
- **修正**：`CatalogManager` 暴露 `ready`（`init()` 回傳的 Promise）；`App.init()` 改為 `await window.CatalogManager.ready` 後再做原本的事，並在之後呼叫一次 `AppStore.refreshDeviceCatalogs()`（不論是否 restored）。

### P1-10　Step 4 輸入處理

- `view_cooling.js:1502-1512`、`:1540-1541`：`parseFloat(v) || 預設值` 讓使用者**無法輸入 0**（例如沒有板換時 PHE approach = 0 會被改回 2.0）。改成 `const num = (id, d) => { const v = parseFloat(el?.value); return Number.isFinite(v) ? v : d; }`。
- `view_cooling.js:284-286` 在 render 時改寫 state（`cduSys.secSupplyC = ... || 45`）。改成在 `deserializeProject` / `addDU` 做預設值補齊，render 只讀。
- 預設資料與「FWS = 晶片側 − CDU approach」連動規則不一致：`store.js:96-104` 預設 sec 45/57、approach 3，FWS 卻是 40/55（依規則應為 42/54）；`addDU`（`:600-608`）與 `addCorePod`（`:472-480`）的 FWS 37/47 對 sec 45/57 或 45/55 也不一致。**做法**：預設值改由同一個 `defaultCduSystem()` 產生，FWS 由 sec 與 approach 推導。⚠ 這會改變預設專案的基準 PUE，要在 commit 內文註明。
- `view_cooling.js:1162-1169` 純乾冷器警示寫死「最高達 38.0°C」與 `< 36.0`：改用 `state.site.stats.maxDB`，條件改為 `maxDB > cduFcThresh`。

---

## 4. 維護性問題

| # | 問題 | 位置 | 處理方式 |
|---|---|---|---|
| M1 | `store.js` 2355 行，混了 state、CRUD、存檔、選型清單產生、N+1 驗算、8760 逐時模擬、帳本 | store.js | Phase C 拆檔（§5.3） |
| M2 | 架構字串 if/else 散落：`calcHourlyEnergy`、`generateCduSizing`、`generateFwSizing`、`bridgeDuToPlantModel`、`view_cooling.js` 6 處以上、`view_dashboard.js`、`getEffectiveFcThresholds`。新增一種架構要改 6 個檔案 | 多處 | Phase C 架構登錄表（§5） |
| M3 | DU 迴圈（`store.js:1740-1855`）與 CorePOD 迴圈（`:1864-1979`）幾乎逐行重複 | store.js | 抽 `simulateUnit(unit, summ, weather)` |
| M4 | 魔術數字：`5.7`（mode2）、`9.2`（絕熱切換點）、`0.35`（trim）、`38.0`、`1.2`（塔容量）、fallback `/500×8.0/15.0/14.0`、`fwBaseCop` 三段、`5.5`、`5.0`（區域冷站 COP） | store.js、view_cooling.js | 全部進 ASSUMPTIONS 或由物理公式取代 |
| M5 | `generateCduSizing` / `generateFwSizing` 內各自再寫一份 fallback 型錄清單，跟 `catalog_manager.js` 的 `BUILTIN_VENDOR_CATALOGS` 重複 | store.js:725-1066 | 一律 `CatalogManager.getCatalog()` |
| M6 | 驗證訊息用 `sizing[0]`、`sizing[1]`、`sizing[2]` 索引組字串 | store.js:2276-2335 | 依 `key` / `role` 產生 |
| M7 | 大量死碼：`CRACEngine`、`calcArchitectureFC`、`calcNvidiaDSXFreeCooling`、`calcPartialFCEnergy`、`calcAirSideEconomizer`、`calcSeaWaterFC`、`getSeaWaterTemp`、`calcThermalHydraulics`、`calcApproachAtWB`、`LOAD_PROFILE_PRESETS`、`EngineeringBasis`、`future_margin_pct`、`cooling_diversity_factor` | engines_*.js | Phase C 前先確認零呼叫後刪除；`LOAD_PROFILE_PRESETS` 見 §7-D3 |
| M8 | 逐時迴圈內每小時重複 `sizing.find` + 型錄 `find`（8760 × 單元數 × 十幾次） | calcHourlyEnergy | 迴圈外預先 resolve 一次 |
| M9 | ID 用 `Date.now()` 拼接，同一毫秒多次呼叫可能重複（`copySU` 迴圈、`addDU` 內 SU/EQ） | store.js | 改用 `engines_core.js` 已有的 `uuid()` |

---

## 5. Phase 4（Step 4）模型架構重構：支援未來多種配置

### 5.1 現況的結構性限制

1. **系統＝寫死的兩槽**：每個 DU/Pod 固定 `cduSystem` + `fanwallSystem` 各一個，架構用字串切換，行為分散在 if/else。
2. **一個架構＝一整段手寫程式**：`dry_cooler_trim` 與 `water_cooled_chiller(fanwall)` 本質都是「經濟器串聯預冷 + 機械修整」，卻是兩段完全不同的程式；「絕熱塔 + Trim」、「閉式塔 + Trim」這種常見組合目前根本無法表達。
3. **一個 DU 一座冷站**：冰機分段、部分負載率都以單一 DU 負載計算。實際上集中冷站服務多個 DU 時，PLR 取決於**加總**負載，現行模型無法表達。
4. **備援只有 N+1**（`selectedQty − 1`），2N、N+2 無法設定。
5. **拓樸圖、門檻、標籤、選型清單、模擬各自維護一份溫度鏈**（P0-6 就是這樣產生的：圖說冰機出 30°C，算的是 40°C）。

### 5.2 目標設計：「架構描述檔 + 階段鏈（stage chain）」

核心概念：**任何冷卻系統都是「末端 → 經濟器階段（0..n）→ 機械修整階段（0..1）→ 排熱端」的串聯鏈**，每個階段只回答「在這個溫度下我能吃掉多少負載、耗多少電水」。架構只是階段的組合 + 參數 + 選型規則，用資料描述，不再寫 if/else。

```
             ┌─────────── Architecture descriptor（資料）───────────┐
 Terminal ──▶│ Economizer stage(s) ──▶ Mechanical stage ──▶ Sink    │
 (CDU/CRAH/  │  dry_cooler / evap_tower / adiabatic /   chiller      │
  RDHX)      │  closed_tower / district_chw            (water/air)   │
             └──────────────────────────────────────────────────────┘
```

#### 階段介面（每個 stage 一個檔案）

```js
/**
 * @typedef {Object} StageContext
 * @property {number} Q_kw          進入此階段前仍待移除的熱負載 (kW)
 * @property {number} t_supply_c    迴路設計供水溫
 * @property {number} t_return_c    迴路設計回水溫
 * @property {number} t_in_c        進入此階段的水溫（前一階段預冷後）
 * @property {{db:number, wb:number, rh?:number}} w   當小時氣象
 * @property {Object} sys           該系統 state（cduSystem 或 fanwallSystem）
 * @property {Object} equip         預先 resolve 好的設備（{ dry_cooler:[...], trim_chiller:[...] }）
 * @property {number} loadRatio     負載/設計負載
 */
/**
 * @typedef {Object} StageResult
 * @property {number} Q_removed_kw  此階段移除的熱
 * @property {number} t_out_c       離開此階段的水溫
 * @property {number} fanKw  @property {number} pumpKw  @property {number} compressorKw
 * @property {number} waterM3       本小時耗水 (m³)
 * @property {number} rejectToSinkKw 需要往下游排熱端送的熱（冰機 = Q + P）
 * @property {Object} diag          除錯用（COP、T_avail…）
 */
CoolingStages.register('dry_cooler', { simulate(ctx) { /* ... */ return result; }, sizing(ctx) { ... } });
```

經濟器階段一律用 P0-5 的 `calcSeriesEconomizer`；機械階段一律用修正後的 `ChillerEngine`。**物理只寫一次。**

#### 架構描述檔

```js
CoolingArchRegistry.register({
  id: 'dry_cooler_trim',
  aliases: ['dry_cooler_hx'],                 // 舊專案相容
  loop: 'liquid',                              // 'liquid' → cduSystem；'air' → fanwallSystem
  optionLabel: '🟡 乾冷器 + 串聯修整冰機 (NVIDIA DSX 混合三模式 / 推薦標準)',   // Step 4 下拉選單，字串必須與現行完全相同
  cardLabel:   '乾冷器 + Trim 冰機 (NVIDIA DSX)',                               // view_cooling.js:248
  dashboardLabel: '乾冷器 + 串聯修整冰機 (NVIDIA DSX)',
  flags: { hasMechanical: true, consumesWater: false },                       // 取代 isZeroChiller / isFullMech 陣列
  terminal: 'cdu',
  stages: [
    { type: 'dry_cooler', equipKey: 'dry_cooler', approachParam: 'dryCoolerApproachC', hxApproachParam: 'pheApproachC' },
    { type: 'chiller',    equipKey: 'trim_chiller', chillerType: 'water_cooled', condenser: 'series_after_precool' },
  ],
  params: [   // 由 Step 4 表單讀寫；key 對應現有 state 欄位名，不改名
    { key: 'dryCoolerApproachC', default: 5.0, min: 0, max: 15, step: 0.5, unit: '°C' },
    { key: 'pheApproachC',       default: 2.0, min: 0, max: 10, step: 0.5, unit: '°C' },
    { key: 'trimChwSupplyC',     default: (sys) => Math.min(30, sys.fwsSupplyC - 7), unit: '°C', hiddenInUi: true },
  ],
  equipment: [  // 取代 generateCduSizing 內的分支
    { key: 'cdu_unit',     catalog: 'cdu',           role: 'terminal',       requiredKw: (c) => c.loadKw,                     derate: 'cdu' },
    { key: 'dry_cooler',   catalog: 'dry_cooler',    role: 'heat_rejection', requiredKw: (c) => c.loadKw + c.design.trimKw,  derate: null },
    { key: 'cdu_pump',     catalog: 'pump',          role: 'pump',           requiredKw: (c) => c.hydraulics.pump_power_kw,  rule: 'pump' },
    { key: 'trim_chiller', catalog: 'chiller_water', role: 'chiller',        requiredKw: (c) => c.design.trimLoadKw,         derate: 'chiller' },
  ],
  schematic: 'series_trim',     // view_cooling.js 依此挑拓樸圖 renderer（現有 SVG 原封不動搬進 renderer）
  fcThreshold: (sys) => ({ basis: 'db', value: sys.fwsSupplyC - sys.dryCoolerApproachC - sys.pheApproachC }),
});
```

#### 統一的逐時結果契約

每個架構 `simulateHour()` 回傳：

```js
{ terminalKw, pumpKw, fanKw /*排熱端風扇*/, compressorKw, waterM3,
  mode: 'free'|'partial'|'mechanical', deficitKw, heatRemovedKw, mechLoadKw, diag }
```

`calcHourlyEnergy(plantDesign, summ, w)` 保留原簽名與原回傳欄位（`cduPumpKw`、`crahFanKw`、`heatRejKw`、`chillerKw`、`cduKwh`、`fwKwh`…），內部改為：取 liquid 架構與 air 架構 → 各呼叫 `simulateHour` → 映射回舊欄位。**Dashboard / Excel 一行都不用改。**

### 5.3 檔案配置（仍是全域 `<script>`，不引入打包工具，`file://` 與 build_exe 照常可用）

```
js/
  assumptions.js / engines_*.js            （保留；死碼刪除）
  cooling/
    registry.js                 CoolingArchRegistry、CoolingStages（register/get/list/resolveAlias）
    series_economizer.js        （或放 engines_free_cooling.js）calcSeriesEconomizer
    stages/stage_dry_cooler.js
    stages/stage_evap_tower.js           開式塔（WB）
    stages/stage_closed_tower.js         閉式塔（WB，approach 較大）
    stages/stage_adiabatic.js            絕熱預冷（P1-4 公式）
    stages/stage_chiller.js              水冷/氣冷，含 Carnot 揚程修正
    stages/stage_district_chw.js         廠區冰水（COP 由 assumption）
    archs/liquid_dry_cooler_trim.js
    archs/liquid_dry_cooler_pure.js
    archs/liquid_adiabatic_tower.js
    archs/liquid_closed_tower.js
    archs/liquid_water_chiller.js
    archs/air_air_cooled_chiller.js
    archs/air_water_cooled_chiller.js
    archs/air_district_chw.js
    archs/air_rdhx.js
  sizing/sizing_engine.js       通用：equipment 描述 → requiredKw、降額、備援、passed、requiredText
  simulation/annual_runner.js   8760 迴圈、simulateUnit、ledger、hourlyProfile（由 store.calculate 呼叫）
  store.js                      只剩 state、CRUD、存檔/載入/遷移、notify
  views/view_cooling.js         下拉選單、參數、拓樸圖選擇改讀 registry；SVG renderer 原樣搬到
  views/schematics/*.js         （single_loop、series_trim、air_plant 三種）
```

`index.html` 的 `<script>` 依相依順序加入：`assumptions → engines_* → cooling/registry → cooling/stages/* → cooling/archs/* → sizing → simulation → catalog → store → views → app`。

### 5.4 必須維持不變的結果契約（Phase C/D 驗收用）

`results.overall`：`annualPue, annualP_Pue, peakPue, peakP_Pue, peakMonth, peakHour, annualWue, annualWaterM3, totalItKw, annualTotalMwh, annualItMwh, fcHours, fcHoursPct, freeModeHours, partialModeHours, mechModeHours, capacityDeficitHours, maxCapacityDeficitKw, breakdownKwh{it,cduPump,crahFan,heatRejection,chiller,loss}, energyLedger, thermalLedger, hydraulicLedger`
`results.byDu[] / byCorePod[]`：現有所有欄位（見 `store.js:1814-1845`、`:1936-1966`）
`results.cduFcStats / fwFcStats / combinedFcStats / corePodGroup / fcPotential / monthlyPue / hourlyProfile[]`
`sizing[]` item：`key, label, category, catalog, selectedModel, unitCapKw, selectedQty, requiredKw, requiredUnitsN1, effectiveCapKw, passed, requiredText, peakRatio?, maxMechanicalKw?, maxMechanicalPassed?`

### 5.5 專案檔 schema 遷移

- `serializeProject` 的 `schemaVersion` 升為 `'v5'`。
- 新增 `migrateProject(stateData)`，在 `deserializeProject` 開頭執行，逐版遷移（v4→v5）：
  - `architecture` 經 `CoolingArchRegistry.resolveAlias`（`dry_cooler_hx` → `dry_cooler_trim`）。
  - 補齊 `enabled`（P0-1）、架構 `params` 預設值。
  - `sizing[].redundancy` 補 `'N+1'`（為 Phase E 預留，計算仍用 N+1）。
- 用 `public/Data center Cal/projects/PUE_Project_高雄 (Kaohsiung)_20260901.json` 做遷移測試：v4 檔載入 → 計算 → 存成 v5 → 再載入 → 結果一致。

### 5.6 新增配置在新架構下的樣子（驗證設計是否夠彈性）

| 未來配置 | 新架構下的做法 |
|---|---|
| 絕熱塔 + Trim 冰機 | 新增一個 arch 檔：`stages: [adiabatic, chiller]`，零新物理程式 |
| 閉式塔 + Trim 冰機 | `stages: [closed_tower, chiller]` |
| 開式塔 + 板換 WSE + 水冷冰機（傳統 CHW） | `stages: [evap_tower(+hx), chiller(condenser: tower)]` |
| RDHX 接 CDU 中溫迴路（Neutral loop 22–32°C） | air 架構 `terminal: 'rdhx'`，`stages` 同 liquid 架構 |
| 熱回收（Heat reuse） | 新 stage `heat_recovery`（移除熱但不耗排熱風扇，另計回收量） |
| 2N / N+2 備援 | `sizing_engine` 讀 `redundancy`，`runningQty` 與 `effectiveCapKw` 依此計算 |
| 集中冷站服務多個 DU | 見 Phase E |

### 5.7 Phase E（本次不做，先寫下設計以免 Phase C 堵死）

`state.plants[]`：每座冷站有自己的 `cduSystem`/`fanwallSystem` 描述；DU 的 `plantDesign` 可改為 `{ plantRef: 'plant_1' }`。`annual_runner` 每小時先把同一 plant 下所有 DU 的液冷/氣冷負載加總，再呼叫一次 `simulateHour`，耗電依負載比例分攤回各 DU（`byDu` 欄位不變）。預設仍是每 DU 一座專屬冷站，行為與現在相同。Phase C 的 `simulateUnit` 請寫成「輸入＝負載 + 系統描述」，不要直接依賴 DU 物件，這樣 Phase E 才能重用。

---

## 6. 回歸測試工具（Phase A 建立，之後每個任務都要跑）

### 6.1 檔案位置

`tools/pue_regression/`（放 repo 根目錄，不在 `public/` 底下，不會被部署）。只用 Node 內建模組。

### 6.2 `tools/pue_regression/harness.js`

```js
// 把瀏覽器端 script 載入同一個 vm context，模擬 window 全域
const fs = require('fs'), vm = require('vm'), path = require('path');
const JS = path.resolve(__dirname, '../../public/Data center Cal/js');
const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout, parseFloat, parseInt, Number, String, Array, Object, isFinite, isNaN, Promise };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
// ⚠ 順序需與 index.html 一致；Phase C 新增檔案時同步更新此清單
const FILES = ['assumptions.js','engines_core.js','engines_cdu.js','engines_crah.js','engines_chiller.js',
  'engines_cooling_tower.js','engines_free_cooling.js','engines_hx.js','engines_pump.js','weather_builtin.js',
  'device_catalog_builtin.js','catalog_manager.js','store.js'];
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
module.exports = ctx;
```

### 6.3 `tools/pue_regression/run.js`

需求：
1. 對 **7 個內建城市 × CDU 5 種架構 × Fanwall 4 種架構 = 140 組**，每組：重置為預設 state（深拷貝一份初始 `AppStore.state` 保存起來）、設定 `site.hourly`、設定兩個架構、清空 sizing、`calculate()`。
2. 每組輸出：`annualPue, annualP_Pue, annualWue, fcHoursPct, peakPue, capacityDeficitHours, breakdownKwh 各項 MWh, fwFcStats.freeHours`，另加每個 sizing item 的 `passed`。
3. `node run.js --save baseline.json` 存基準；`node run.js --compare baseline.json` 逐項比對，印出差異表（|ΔPUE| > 0.0005 或任何 passed 改變就列出），並以 exit code 1 結束若有差異。
4. Phase C/D（純重構）要求 **0 差異**；Phase B 每個任務允許差異，但方向要符合該任務「預期影響」。

### 6.4 `tools/pue_regression/unit_checks.js`

用 `assert` 寫本文件各任務的「驗收」條目（P0-1、P0-3、P0-4、P0-5…），全部通過才能 commit。以下兩項現在就該失敗、修正後通過（可當作第一個測試）：

```js
const assert = require('assert');
const { AHRI_PRESETS, biQuad } = require('./harness.js');
for (const [k, p] of Object.entries(AHRI_PRESETS)) {
  const C = k.startsWith('air_') ? 35 : 30;
  assert(Math.abs(biQuad(p.CapFT, 7, C) - 1) < 1e-9, k + ' CapFT');
  assert(Math.abs(biQuad(p.EIR_FT, 7, C) - 1) < 1e-9, k + ' EIR_FT');
}
```

### 6.5 UI 結構快照（Phase A 建立）

`tools/pue_regression/ui_snapshot.js`：用 `jsdom`（`npm i -D jsdom`，裝在 repo 根目錄的 devDependencies）載入 `index.html` 與全部 script，對預設專案依序 render Step 1–5，把 `#stepContent.innerHTML`：
- **結構快照**：所有數字替換成 `#` 後存檔 → Phase B 每個任務比對必須完全相同（數字可以變，結構不能變）。
- **完整快照**：原樣存檔 → Phase C/D 比對必須完全相同。

jsdom 環境裡 `Chart`、`lucide` 不存在時給空 stub；`alert/confirm` stub 掉。

---

## 7. 需東旭決定的項目（Sonnet 先照「預設做法」執行，最後回報）

| # | 問題 | 預設做法 |
|---|---|---|
| D1 | 電力損失熱（UPS/變壓器）要不要由白區氣冷系統冷卻？實際上常在電氣室另設空調 | 預設由該單元氣冷系統負擔（保守）。若要改成「電氣室獨立冷卻」，之後新增一個 air 架構即可 |
| D2 | `annualP_Pue` 目前定義是「(IT + 冷卻 − 泵) / IT」，跟 The Green Grid 的 partial PUE 定義不同 | 不動數值與標籤，只在程式註解寫清楚定義 |
| D3 | IT 負載全年固定滿載，`LOAD_PROFILE_PRESETS`（AI 訓練、雲端日夜…）寫好但沒接上 | 本次不接，列為 Phase E 功能；`LOAD_PROFILE_PRESETS` 不刪 |
| D4 | 氣冷冰機是否一律視為有 free-cooling coil | 預設有（維持現行假設，只修正門檻物理）；不加 UI |
| D5 | 「全額水冷式冰機」在 FWS 40°C 下，冷卻水塔出水（WB+4）通常已低於 FWS，物理上應該直接走水側經濟器 | 照使用者選的架構算（全機械），但 `validation.checks` 加一條 ⚠：「設計濕球 + 塔 approach < FWS，建議改用閉式塔／WSE 架構」 |

---

## 8. 任務清單（照順序執行）

### Phase A — 安全網
- **A-1** 建立 `tools/pue_regression/`（harness、run、unit_checks、ui_snapshot），存修正前 `baseline.json` 與 UI 快照。unit_checks 此時預期有失敗項（AHRI），先標 `skip`。DoD：`node run.js --save` 產出 140 組結果，預設組合數值等於 §1.2 表格。

### Phase B — 計算修正（每個任務一個 commit，每個都跑 §6）
- **B-1** P0-1 CorePOD `enabled`
- **B-2** P0-3 AHRI 正規化 + 氣冷降額用曲線
- **B-3** P0-4 冰機揚程修正 + P0-2 water_chiller key（同一 commit）
- **B-4** P0-5 `calcSeriesEconomizer`（引擎層；此時呼叫端尚未傳回水溫，數值應不變）
- **B-5** P0-6 Trim 冰機工況 + 選型比例一致化 + 拓樸圖改讀同一 helper
- **B-6** P0-7 Fanwall 自然冷卻（air_cooled_chiller、rdhx、water_cooled_chiller）
- **B-7** P1-5 CDU/CRAH 容量缺口
- **B-8** P1-1 設計工況 + 降額選型
- **B-9** P1-2 損失熱 + 真實熱平衡帳本
- **B-10** P1-3、P1-4 耗水
- **B-11** P1-7 `isFreeHour`、P1-6 刪死碼
- **B-12** P1-8 Dashboard 台帳改用真實資料
- **B-13** P1-9 型錄競態、P1-10 輸入處理與預設值
- Phase B 結束：重新 `--save baseline_after_B.json`，這是 Phase C 的比對基準。

### Phase C — 架構重構（純重構，數值與 UI 完全快照 0 差異）
- **C-1** `cooling/registry.js` + stages（先搬 Phase B 已修好的物理，不改公式）
- **C-2** 9 個 arch 描述檔；`calcHourlyEnergy` 改走 registry（保留舊實作於 `calcHourlyEnergyLegacy`，harness 同時跑兩者比對 8760 小時逐項相等後再刪）
- **C-3** `sizing/sizing_engine.js` 取代 `generateCduSizing`/`generateFwSizing`/`bridgeDuToPlantModel` 的選型段
- **C-4** `simulation/annual_runner.js` + `simulateUnit`（消除 DU/Pod 重複迴圈，M3、M8）
- **C-5** schema v5 + `migrateProject`（§5.5）
- **C-6** 刪除 M7 死碼、M5 重複型錄、M4 剩餘魔術數字、M9 ID

### Phase D — Step 4 UI 改讀 registry（DOM 完全快照 0 差異）
- **D-1** 下拉選單 option、卡片標籤、Dashboard 標籤改由 registry 產生（字串與現行逐字相同）
- **D-2** 拓樸圖 SVG 原樣搬到 `views/schematics/*.js`，依 `arch.schematic` 選擇
- **D-3** 架構專屬參數面板（目前只有絕熱塔）改由 `arch.params` 產生，HTML 輸出與現行相同

### 完成回報格式
1. 每個任務：commit hash、`--compare` 差異摘要（7 城市預設組合的 PUE/WUE/冰機 MWh 前後對照）。
2. §7 各決定項採用了什麼做法。
3. 任何「預期影響方向不符」或無法照本文件執行的地方，附上原因，不要自行改公式。
