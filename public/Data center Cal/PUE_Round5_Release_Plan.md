# PUE 計算系統 — 第五輪計畫：收尾修正 + 合併發布準備

- 前一份計畫：`PUE_Round4_Weather_Integration_Plan.md`（G-1 ~ Q-2 已完成，分支 `pue-audit-fixes`，HEAD `065e1cb`）
- 審查者：Claude Opus 5.5（2026-10-12）
- 執行者：Gemini / Antigravity
- 本輪規模小：4 項修正 + 發布前檢查。**做完這輪，這個分支就可以合併回 `main`。**

---

## 0. 執行守則

1. 可動路徑：`public/Data center Cal/**`、`tools/**`、本文件。**不要**動 `dist/`、不要跑 `build.js`、不要部署、不要 push、**不要自己合併到 main**（R-5 只產出檢查報告，合併由東旭決定）。
2. 一個任務一個 commit，訊息以任務編號開頭。不要 `git add -A`。
3. 開工前：
   ```
   cd tools/pue_regression
   node run.js --save baseline_after_R4.json
   node ui_snapshot.js --save ui_snapshot_after_R4.json
   ```
4. 每個任務完成後：`unit_checks.js` 全過、`run.js --compare baseline_after_R4.json` 0 差異（R-1、R-3 只改文字，數值仍須 0 差異）。

---

## 1. 第四輪驗收結果

### 1.1 確認正確（實測）
- 14 個 commit 都在，`unit_checks.js` **159/159** 通過。
- **G-1**：先載入桃園、再換高雄但不帶設計條件 → 正確退回「TMY 最高 + 餘裕」，不再沿用桃園。截圖確認 Alabama 尖峰 DB 41.1°C、設計乾球 36.8°C，不再出現桃園的 42.0／33.9。
- **G-2**：`run.js` 已帶入設計條件，回歸測試涵蓋 ASHRAE 路徑。
- **G-3／G-4**：待機、旁通標籤不再壓到標題；Fanwall 橫幅改為兩行。
- **W-2**：adapter 有 `month = m + 1`。
- **W-7**：165 站全部跑完，0 個 NaN，PUE 1.079（塔什干）～1.116（利雅德、杜拜）。
- **Q-1**：Alabama 尖峰工況「冷凝器 ⚠ 52.0→59.0°C」以紅框警示，正確。
- **Q-2**：驗算正確：
  - 1030 LPM × 28 m ÷ (0.75 × 0.92) = 6.83 kW，與程式一致
  - 泵浦台數 3 → 6 台，耗電不變（與台數無關）✓
  - 揚程 28 → 56 m，泵浦耗電增加量剛好等於 6.83 kW × 8760 h ✓
  - 預設專案 PUE 約下降 0.007

### 1.2 本輪要修的

| # | 問題 | 嚴重度 |
|---|---|---|
| R-1 | 資料品質警示文字誤導 | 中 |
| R-2 | 桌面版 exe 啟動時把 165 站全部解壓縮到記憶體 | 中 |
| R-3 | Step 1「共 7 站」沒有更新 | 低 |
| R-4 | Trim 冰機超出運轉範圍時，設備方框仍寫「高效離心/螺旋式」 | 低 |

---

## 2. 修正任務

### R-1　資料品質警示改為「TMY 未涵蓋極端熱浪」
- **現象**：W-7 掃描有 19 站觸發警示，包含倫敦、漢堡、布拉格、斯塔萬格、波特蘭、達拉斯。這些地方近年確實有 38～40°C 熱浪（2019、2022 歐洲熱浪；2021 美西熱浪），而 TMY 是挑「典型」月份，本來就排除熱浪年。所以 ASHRAE 極值比 TMY 最高溫高 5°C 以上，多數是**真實氣候特徵**，不是測站資料錯誤。
- 現行文字「建議核對測站資料」（`js/store.js:936`）會讓人誤以為資料有問題而忽略極值，方向是反的。
- **修正**：
  - 文字改為：`本站 ASHRAE {n} 年回歸最高乾球 {peak}°C 比 TMY 最高溫高 {gap}°C — TMY 未涵蓋極端熱浪，設備選型已採用 ASHRAE 值`
  - 新增第二層判斷，只有在**極端值統計本身離群**時才提示核對資料：ASHRAE 極端年最高乾球標準差（`extremes.dbMaxStd`，X-1 解析時要多存這個欄位，即 Extremes 區塊第 [6] 欄）> `A('design_extreme_std_suspect_c')`（新常數 2.5°C，ref「台灣與多數溫帶測站極端年最高乾球標準差約 1～2°C；明顯偏高可能是測站搬遷或資料缺漏」）時，再加一句 `；本站極值離散度偏高（σ={std}°C），建議另行核對`。
  - `archive/weather_tools/build_weather_data.js` 用 `--meta-only` 重新輸出 `public/天氣資料/weather_data.js`，讓 165 站都帶上 `dbMaxStd`；`tools/weather/inject_design_conditions.js` 重跑內建 7 城。
- **預期**：
  - 桃園 σ = 2.6 → 兩句都顯示
  - 倫敦等歐洲站 → 只顯示第一句
- 在 commit 內文列出觸發第二句的測站清單。
- **允許變動**：警示文字；`weather_data.js`、`weather_builtin.js` 新增欄位。數值 0 差異。

### R-2　exe 改為按需解壓縮
- **現象**：第四輪計畫 W-5 要求「收到請求時才解壓縮該檔」，實際實作仍是整包 gzip、啟動時把所有檔案解壓縮到 `Dictionary<string, byte[]> _files`（`build_exe.js` 內 C# 第 94、126～143 行）。加入 165 站後，啟動時會解壓縮約 91 MB 的逐時 JSON（加上 `js/weather_builtin.js` 5 MB、`weather/ZIP檔` 21 MB），記憶體與啟動時間都會明顯增加。
- **修正**：
  - bundle 格式改為「索引 + 逐檔 gzip」：每個檔案各自 `zlib.gzipSync(level 9)`，bundle 開頭寫索引（路徑、offset、壓縮後長度、原始長度），整包本身**不再**外層 gzip。
  - C# 端啟動時只讀索引，`_files` 改存 `(offset, length)`；HTTP 請求時才從 manifest resource stream 讀出該段並用 `GZipStream` 解壓縮後回傳。可對最近 10 個檔案做記憶體快取。
  - 回應加上正確的 `Content-Length`；`.json` 的 MIME 為 `application/json; charset=utf-8`。
  - 順便排除不需要的檔案：`weather/ZIP檔/**` 中除了 `.epw` 以外的副檔名（`.stat`、`.ddy`、`.clm`、`.pvsyst`、`.rain`、`.wea`）。`epw原始氣象資料解析器.html` 需要用到的只有 EPW，先 grep 確認。
- **驗收**（不需要實際打包 exe）：
  - 新增 `tools/exe/verify_bundle.js`：用新格式產生 bundle 到暫存資料夾，再用 Node 模擬 C# 的讀取邏輯，抽查 5 個檔案（含 `index.html`、`js/store.js`、2 個 hourly JSON），內容必須與原檔逐位元組相同。
  - commit 內文附：bundle 總大小、索引大小、排除檔案後節省的 MB 數。
- 若東旭之後要實際打包，在本文件最後的回報中寫明打包指令與預期 exe 大小。

### R-3　Step 1「共 N 站」
- `views/view_weather.js:225`：`totalStationsCount` 只在第一次 render 時計算。165 站清單是非同步載入的，載入後只更新了清單內容，計數仍停在 7。
- **修正**：在 `initStations()` 載入完成後，一併更新計數。計數元素加 `id="stationTotalCount"`，在 `renderStationList()` 裡更新它。
- 篩選時顯示 `符合 {filtered} / 共 {total} 站`。
- **接線測試**：jsdom 中 `await ViewWeather.initStations()` 後，計數文字含 `165`。

### R-4　冰機超出運轉範圍時的設備文字
- Alabama 截圖：尖峰表格已警示「冷凝器 ⚠ 52.0→59.0°C」，但冰機方框仍寫「高效離心/螺旋式機械壓縮製冷」。
- **修正**：
  - `liquid_dry_cooler_trim.js` 的 `topology()`：當尖峰工況 `condIn > 所選冰機運轉上限` 時，冰機方框第二行改為 `⚠ 需高溫型冰機（冷凝進水 {T}°C > 上限 {L}°C）`，並用警示色。
  - 未超限時維持原文字。

---

## 3. R-5　發布前檢查（只產出報告，不合併）

產出 `tools/release/RELEASE_CHECK_R5.md`，內容：

1. **分支差異摘要**：`git diff --stat main...pue-audit-fixes -- public tools archive` 的統計，以及新增檔案清單。
2. **`dist/` 狀態**：`main` 上 `dist/` 目前有大量未 commit 的修改（第一輪開始前就存在，與本分支無關）。列出這些檔案，提醒東旭合併前先決定要 commit 還是捨棄。**不要動它們。**
3. **build.js 相容性**：
   - 確認 `build.js` 會把 `public/Data center Cal/js/` 下的新子資料夾（`cooling/`、`sizing/`、`simulation/`、`views/schematics/`）複製到 `dist/` 並混淆。
   - 只讀程式碼確認，不要執行 build。
   - 若 build.js 只處理 `.html` 內嵌 script、不處理外部 `.js`，要明確寫出來。
4. **Firebase 路徑**：
   - 確認線上版 `../天氣資料/weather_data.js` 與 `../天氣資料/hourly/*.json` 的相對路徑，在 `firebase.json` 的 rewrites 下能正確取得。
   - 列出 `firebase.json` 中與 `天氣資料`、`Data center Cal` 相關的規則。
5. **舊專案相容性**：
   - 用 `public/Data center Cal/projects/PUE_Project_高雄 (Kaohsiung)_20260901.json`（v4）載入 → 計算 → 存檔 → 再載入。
   - 結果一致，`schemaVersion` 為 `v6`，`stationSource` 為 `builtin`。
6. **最終數字**：7 城市預設組合的 PUE／WUE／Trim 選型需求，與第一輪修正前（`baseline.json`）對照表。
7. **計畫檔整理**：`public/Data center Cal/` 底下的 5 份計畫 MD 會被部署到線上。建議合併前移到 `docs/pue_plans/`（只寫建議，不要移動）。

---

## 4. 任務清單

| 任務 | 內容 | 允許變動 |
|---|---|---|
| S-0 | 存 `baseline_after_R4`、`ui_snapshot_after_R4` | — |
| R-1 | 資料品質警示文字 + 離散度判斷 | 文字、測站資料新增欄位 |
| R-2 | exe 逐檔 gzip、按需解壓縮、排除不需要的檔案 | 建置腳本 |
| R-3 | Step 1 測站計數 | Step 1 文字 |
| R-4 | 冰機超限文字 | 拓樸圖文字 |
| R-5 | 發布前檢查報告 | 新增報告檔 |

### 回報格式
1. 每個任務 commit hash 與驗收結果。
2. `RELEASE_CHECK_R5.md` 的重點摘要（特別是 build.js 與 Firebase 是否有問題）。
