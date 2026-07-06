# DEPENDENCY-MAP.md — Phase 0 唯讀健檢產出

> 本檔案由 Phase 0 唯讀健檢產生，之後每個 Phase 開始前都必須重讀。

## Rev F 後續使用者回報修正：Fanwall 位置調整（2026-07-06，計畫外微調）

使用者目視驗收 F4 成果後回報：Fanwall 原本 zA/zB=±1.5（對齊機櫃 rowA_z/rowB_z）會讓
風牆卡在機櫃列本身的位置，擋住冷通道，且與 common support 最外圈支撐柱（z=±2.80）
視覺上互相擁擠。調整為：
- `VR_LAYOUT.fanwall`：x 5.6→6.2、zA -1.5→-2.9、zB 1.5→2.9、reservedZ 同比例外移
  （-3.2→-4.6、3.2→4.6，維持原本 +1.7 相對偏移）。
- `buildOverheadTrays()` 內型式 A 外側 common support：**只有最後一站**（x=4.27，最靠近
  fanwall 那一站）的 4 支立柱與其橫擔隨 fanwall 同幅度外移（+1.4，與 zA/zB 位移量一致），
  其餘 9 站與型式 B 艙內支撐維持原位不動。因橫擔幾何（長度）在 InstancedMesh 是所有
  instance 共用同一個 BoxGeometry，最後一站跨距與其餘 9 站不同，故另外開一組獨立陣列
  （`lastBeamMatrices`）建立，不與其餘 9 站共用同一個 InstancedMesh。
- 已知的次要視覺效果：最後一站橫擔外移後，其原本support的光纖環z=1.50位置不再被
  該站橫擔正下方覆蓋（該站橫擔新跨距 2.27~4.28，不含 1.50），僅影響光纖 tray 最尾端
  約 0.95m 這一小段在該站視覺上少一根橫擔撐著，其餘 9 站與 tray 本身其餘段落不受影響，
  純視覺效果、無渲染錯誤。
- headless browser 驗證：`fanwall` 圖層兩台機組世界座標為 `(6.2,1.1,-2.9)`／
  `(6.2,1.1,2.9)`，`fanRotors.length` 仍為 18，draw calls 12080→12081（+1，僅新增
  `lastBeamMatrices` 這一個 InstancedMesh），零 console 錯誤。目視截圖確認：支撐柱
  外移後恰好框住兩台 Fanwall 外側，中間淨空區連貫冷通道方向，不再視覺擁擠。

## Rev F Phase F4（VR-REVF-FEATURE-PLAN.md）完成摘要（2026-07-06）—— Rev F 全系列總驗收

**新函式 `buildFanWalls()` + 新圖層 `fanwall`**：`initLayers()` 增加第七圖層
`'fanwall'`，工具列新增第七顆圖層鈕 `btn_layer_fanwall`（風牆空調，icon `ph-fan`）。
座標常數新增 `VR_LAYOUT.fanwall`（x=5.6、zA=-1.5/zB=1.5 對齊機櫃兩列、reservedZ 兩個
預留位），不硬編碼魔術數字。

**兩台 Fanwall 機組**：機體 0.90×2.20×2.40（本身即軸對齊，面朝 -x 迎向機櫃模組，
故不需要旋轉群組）。9 直×3 橫共 9 組風機／台：外框環、四角吊裝耳、前置柵格條
（靜態、無需個別旋轉的重複幾何）依 CLAUDE.md 第 8 條改為 InstancedMesh（環 9、
柵格條 27、吊裝耳 4，每台各一個 draw call）；**轉子**（hub+5 葉片，需逐一獨立
旋轉）依計畫指示維持一般 Mesh/Group，共 18 組收進 `this.fanRotors[]`，`animate()`
內每幀 `rotation.x += 0.15`（局部 X 軸恰為世界 X 軸，因機體本身無旋轉）。側面
狀態螢幕沿用 cduScreen 的 CanvasTexture 手法（「FANWALL ‧ 96 kW ‧ AUTO」）。
頂部短導管+法蘭代表出線接向天花板。

**兩個預留擴充位**：黃色虛線框（0.95×2.45，InstancedMesh 拼接短劃線，兩個位置共用
同一個 dash InstancedMesh）+ 中央「RESERVED ‧ FANWALL N+1」CanvasTexture 文字貼片，
平貼地面 y=0.011。

**Draw calls 疊代修正**：初版用一般 Mesh 逐一建環(18)+柵格條(54)+吊裝耳(8)，柵格條
54 個違反 CLAUDE.md 第 8 條（>20 需強制 InstancedMesh），headless browser 測得
12154；重構為 InstancedMesh 後降到 **12080**（環/柵格條/吊裝耳三者皆改為每台一個
draw call），轉子維持一般 Mesh（計畫明文指示的例外，18 組數量本身未超過門檻）。

**Rev F 全系列 draw calls**：pre-revF（tag `pre-revF`，臨時 worktree 測得）
**11950** → Rev F 最終（F1+F2+F3+F4 全部完成）**12080**（+130，全部來自 F2 的
24 片機櫃型別標示板與 F4 的 2 台 Fanwall + 預留位標示，皆為刻意新增的可見幾何、
非未受控增長，且已用 InstancedMesh 壓到最小可能值）。

**總驗收（headless browser 逐項驗證）**：
- 兩台 Fanwall 面朝機櫃模組、18 組風機持續旋轉、狀態螢幕正常、兩個預留位標示在地面 ✅
- 第七顆圖層鈕可獨立顯示/隱藏 fanwall（`layer.visible` 正確切換，btn active class 同步）✅
- 爆炸拆解時 `this.layers.fanwall.position.y` 全程維持 0（不在 F3 的
  `EXPLODE_LAYER_TARGETS` 清單中，天然不受影響）✅
- 按鈕列 15 顆可見按鈕（1 營運數據+6 相機+1 爆炸拆解+7 圖層）全部點擊零 console 錯誤 ✅
- HUD 3000kW 規格、三型別機櫃資訊、模組級拆解：F1/F2/F3 既有驗證延續有效 ✅
- grep 確認 `runSimulation`/`toggleSimPanel`/`btn_sim`/`btn_toggle_pipes`/`btn_toggle_cfd`
  在 whitespace.html 零殘留（app.js 僅剩 F1 已記錄的三處休眠碼引用）✅
- `createRack()` 全系列 Rev F 四個 Phase 皆零修改（git diff 逐 Phase 確認）✅

## Rev F Phase F3（VR-REVF-FEATURE-PLAN.md）完成摘要（2026-07-06）

**守則修訂**：CLAUDE.md 第 5 條追加例外四（Rev F 授權），允許重寫 `toggleExplode()` 本體，
單獨 commit（`227ed9f`）後才動工，符合計畫工作 0 的硬性順序要求。

**`toggleExplode()` 重寫**：新增 `this._explodeAnimating` 旗標防止動畫進行中重複觸發
（旗標於 `.start()` 時設 true、`.onComplete()` 時設回 false；guard 邏輯已用「同一 JS tick
內連續呼叫兩次」的方式驗證為正確 — 一開始用 `page.click()` + `waitForTimeout(50/100)` 測試
一度誤判為失敗，後來確認是本沙盒環境 Playwright↔headless Chromium 的 CDP 往返延遲，
使實際經過的真實時間遠超過程式碼裡寫的 50/100ms，導致 800ms tween 早已跑完，並非邏輯
本身有誤）。Tween 時長由原本 1500ms 改為 800ms（依計畫「約 0.8s」）。

**`updateExplodedView()` 新增第 5 段**：在既有機櫃內部拆解（explodeShells／
explodeInstancedMeshes，原樣保留、同一個 progress 聯動）之後，新增模組級圖層垂直分層：
`powerTray:+2.6`／`copperTray:+2.0`／`fiberTray:+1.5`／`containment:+1.0`／`tcs:+0.5`，
`racks`（多數機櫃 mesh 實際掛在 scene 根，不在此圖層內）與尚未建立的 `fanwall` 圖層不在
清單中，維持 `position.y=0` 不動。headless browser 驗證：展開後五個圖層 y 值精確等於
目標值，收合後全部歸零，`explodeShells[0]` 同步從 `(0,1.1,0)`→`(0,1.5,0)`。

**riser／CDU 歸屬回報（計畫工作 1-4 要求事項）**：確認 `buildTCS()` 內
`const tcsGroup = this.layers.tcs`（同一物件，非另建再掛載），故一次側 riser 已經在
`this.layers.tcs` 內，會隨 TCS 一起上升；`createCDU()` 則是 `this.scene.add(group)`，
屬 scene 根物件，不隨任何圖層升起。因此展開時 riser 下端會與靜止的 CDU 頂部之間出現
分離空隙——這正是計畫備註 3 所述「可接受的拆解圖表現」，本次未額外處理，未來若要
讓 riser 隨 CDU 不動，需要把 riser 從 tcs 圖層搬出（跨 Phase 變更，目前未執行）。

**Draw calls**：F3 未新增/刪除任何幾何，僅改變既有 Group 的 `position.y`，靜止基準值維持
F2 結束時的 11953；展開動畫進行中因鏡頭視錐剔除（frustum culling）觀察到的暫態數值會
浮動，屬正常渲染行為，非幾何增長。

## Rev F Phase F2（VR-REVF-FEATURE-PLAN.md）完成摘要（2026-07-06）

**新函式 `buildRackTypeLabels()`**（app.js，緊接在 `buildRackCableEntries()` 之後，`init()`
內於 `buildAisleBusways()` 之後呼叫）：24 櫃正面（冷通道側）頂部（y=1.95，避開既有 NVIDIA
標誌牌所在的 y≈2.11 高度帶）外掛型別標示板 PlaneGeometry(0.42×0.08)，z 偏移沿用既有
NVIDIA 標誌牌（topPlateGroup 內 nvidiaBadge）同一套「local z=-d/2-0.005、rotation.y=Math.PI」
換算公式反推出的世界座標公式：Row A `z=rowA_z-d/2-0.005, rotY=Math.PI`；Row B
`z=rowB_z+d/2+0.005, rotY=0`。3 種 CanvasTexture（綠/藍灰/橙灰底）各建一次、快取於
`this.materials.rackLabelCompute/Switch/Power`，24 櫃分 3 組 InstancedMesh（12/8/4）掛在
`this.layers.racks`，headless browser 驗證 count 為 `[12,8,4]`，零殘留裸 Mesh。

**userData 型別化**：`buildDataCenter()`（非保護函式，允許修改）在 `xs.forEach` 建櫃迴圈後
新增一段，用與 `createRack()` 內部相同的 colIdx 判斷（idx 0,1,10,11=switch、idx 2,9=power、
其餘=compute）對每櫃 `group.userData` 補寫 `rackType`/`typeLabel`/`ratedPower`
（compute 240、switch 18、power 35 kW）。因 `createRack()` 內 `hitBox.userData = group.userData`
是物件參考賦值，此處補寫會同步反映到 raycast 命中的 `hitBox.userData`，`createRack()` 本體
零修改（git diff 只有 4 個 hunk，全部落在 buildDataCenter/buildRackCableEntries 之後/showDetail，
無一觸及 createRack 所在行區）。

**詳情面板型別化**：`showDetail(data)`（非保護函式）在 `data.type === 'Rack'` 分支新增
`RACK_TYPE_DESC` 對照表，依 `data.rackType` 換 `detail-subtitle` 文字，並用
`document.querySelector('#detail-content-rack .live-val')`（取區塊內第一個 live-val，即「機櫃
功耗」欄位）改寫 `data-base` 為 `data.ratedPower`。面板 HTML 版型完全未動，只換內容來源。

**Draw calls**：11950 → 11953（+3，對應新增的 3 個 InstancedMesh 各佔 1 次 draw call，是
24 片標示板在符合 CLAUDE.md 第 8 條 InstancedMesh 強制規定下的理論最小增量，非未受控增長）。
headless browser 點擊 compute/switch/power 三種機櫃，subtitle 與功率值皆正確、零 console 錯誤。

## Rev F Phase F1（VR-REVF-FEATURE-PLAN.md）完成摘要（2026-07-06）

**模擬系統整套移除**：`runSimulation()`、`toggleSimPanel()`、`setLiveVal()` 三個函式本體
與 `simPanelOpen` 屬性已從 app.js 完全刪除（grep 全域確認零殘留，含 `res_*`/`sim_*`/
`LMTD`/`Darcy-Weisbach` 相關字串）；whitespace.html 的 `#sim-modal-overlay` 整塊
（原 198-455 行）已刪除。**HUD 跳動動畫機制**（app.js 開頭 `setInterval(...,1500)` 對
`.live-val` 元素的隨機跳動、`applyCoupledData()`）與模擬引擎完全獨立，未受影響、原樣保留。

**按鈕列重整**：移除 `btn_sim`（模擬計算）、`btn_toggle_pipes`（顯示管路，與 TCS 圖層鈕
重複）、`btn_toggle_cfd`（晶片發熱模擬）三顆按鈕。`togglePipes()`/`toggleCFD()`/
`createCfdParticles()` 函式本體依 CLAUDE.md 第 5 條保留為休眠碼（不再有任何 UI 入口呼叫）。
`btn_toggle_doors` **維持原狀不動**（早於 Rev F 就已是 `style="display:none"` 但 DOM 保留，
因為受保護函式 `toggleDoors()`（[app.js:4179 附近，行號因本次刪除已整體上移約 626 行]）
內部無 null 防呆直接 `getElementById('btn_toggle_doors').classList...`，且被保留的
`cam_rack_close`／`toggleExplode()` 呼叫，若真的移除 DOM 元素會造成點擊必崩潰——已排除，不刪）。
最終按鈕列 = 營運數據(1) + 六顆相機 + 爆炸拆解(1) + 六顆圖層 = 14 顆可見按鈕。

**HUD 更新為 Vera Rubin 240kW 規格**：`hud_val_load` 1200→3000kW、`hud_val_return` 55.0→
57.0°C（供水 45.0°C 不變，ΔT 12K）、`hud_val_flow` 165→207 m³/h、`hud_val_pue` 1.266→1.06；
機櫃詳情面板預設值 118.5→240.0 kW（F2 會依 rackType 型別化，此為過渡預設值）。

**行號漂移警告**：本次刪除 app.js 632 行（269-900）、whitespace.html 259 行（198-456），
之後 Phase 若要引用本檔案「1. init() 呼叫的所有 build 函式與行號」「3. whitespace.html
中所有 onclick 按鈕」兩節的舊行號，**一律需重新 grep 確認**，不可直接信任舊行號。

**Draw calls**：本 Phase 純刪除（JS 邏輯 + HTML 按鈕/面板 + HUD 數字），未新增/移除任何
一律渲染的場景幾何（CFD 粒子系統本就是點擊才建立，非預設場景一部分），headless browser
量測初始 draw calls = **11950**，與 Phase F1 開始前一致，符合「持平或下降」規則。

## Rev B（VR-REVB-FIX-PLAN.md）完成摘要（2026-07-02，tag `v2.1-revB`）

修正了 pre-revB 版本三個根本性座標錯誤：TCS 錯放在機櫃正上方而非熱通道、
封閉艙未封頂（窄煙囪敞開）、電力 whip 直接垂直插入機櫃頂。全部改為：
TCS 遷入熱通道帶並改機櫃背面水平接管、封閉艙全寬密封、電力 whip 經艙頂
grommet 穿頂接到機櫃背面 PDU busbar。

**分帶驗收結果**（headless browser 逐一量測世界座標 AABB，非目視推測）：
- 熱通道帶 `|z|<0.6`：TCS 門架 ±0.55／主管 ±0.429／垂降 ±0.58／PDU busbar ±0.597 —— 全部通過
- 機櫃帶 `0.6<|z|<1.8`：銅纜架 ±1.276／光纖槽 ±1.71 —— 全部通過
- 艙頂上方 `y>3.0`：電力線架、whip 上段、crossover 高架段（y=3.30）—— 全部通過

**過程中發現並修正的真實幾何碰撞**（皆非目視猜測，用程式化 AABB 交集找出）：
1. QDC 快接頭本身有長度，若以外緣端點當中心會多凸出 0.025m 穿出艙牆 → 改以外緣回推中心點。
2. PDU 識別環半徑+管徑原為 0.053，超出 busbar 到艙牆僅 0.03m 的淨空 → 縮小為 0.022+0.005。
3. R3 的 grommet 位置（dx=±0.08）與 R4 PDU/whip 的實際 x 位置（±0.15）不一致 → 回頭校正 grommet dx，
   確保 whip 精確穿過 grommet 環中心（跨 Phase 修正，已在 R4 commit 中一併處理並說明）。

**Draw calls**：pre-revB tag 為 7586，Rev B 五個 Phase 全部完成後為 7599（+13，
主因是新增大量必要的 InstancedMesh 群組如 PDU busbar／TCS 彎頭／專屬吊桿，
每個 Phase 個別都在 ±10 以內且全部用 InstancedMesh，屬合理範圍內的功能性增加）。

**已知殘留問題（非本次修正範圍）**：`toggleCFD()` render error 依然存在（KI-001，
baseline 就有，非本次 Rev B 造成），維持先前決議不修。
> 產出日期：2026-07-02。基準 commit：`baseline: GB200 NVL72 original`。

## Phase 5 總驗收摘要（2026-07-02）

- 熱工參數：`sim_rack_kw` 預設 120→**190**（whitespace.html:228 + app.js fallback 同步更新），
  `sim_supply_temp` 已是 45°C 無需改；上限本就 500（≥250 要求已滿足，未變動）。
  `runSimulation()` 用新預設值跑過，PUE=1.151，`Q_total`/`flow2_m3h` 等全部無 NaN。
- 文案更名：grep 三個檔案，僅 4 處含 "GB200"。使用者可見文字 2 處已改
  （`<title>`、頁首 `<h1>` 品牌名）；`buildHotAisleContainment_GB200_backup()` 函式名與其
  註解保留不改（非顯示字串，且是 Phase 4 刻意保留的舊版備份標籤）。
- 幾何穿模：總驗收時發現並修正了 Phase 2/3/4 三者間的實際幾何重疊（見上方第 3 點記錄），
  用程式化 AABB 比對confirmed 零碰撞（container 194 個世界座標框 vs TCS 橫梁 5 個、
  吊架橫擔全部 instance，皆無交集）。
- Draw calls 最終值：**7586**（baseline 8409 → 下降 823，符合相對值規則）。
- 全部按鈕（開門/爆炸拆解/顯示管路/CFD/洩漏警報/六個圖層）皆用 headless browser 逐一點擊
  驗證不拋新錯誤；唯一殘留錯誤是已記錄的 baseline 既有 `toggleCFD()` render error（見上方
  第 1 點），使用者已決議另開 hotfix session 處理，不影響本次總驗收。

## 已知問題與規則變更（Phase 3 驗證時發現，2026-07-02）

1. **[KI-001 — obsolete，2026-07-06 Rev F Phase F1]** `toggleCFD()` 既有 render error（baseline 就有，非 Vera Rubin 重構造成）
   點擊「晶片發熱模擬」按鈕後，`animate()` 內的 `this.renderer.render(...)` 會持續拋出
   `TypeError: Cannot read properties of null (reading 'isInterleavedBufferAttribute')`
   （被 try/catch 吞掉，不會跳出紅色錯誤橫幅，但畫面渲染會卡住）。已用 headless browser
   對照**完全未修改的 baseline commit**（`53f1f58`）重現同樣錯誤，證實與本次重構無關。
   `toggleCFD()` 屬於 CLAUDE.md 第 5 條保護函式，本次重構不動它。
   **狀態更新（Rev F Phase F1）**：`btn_toggle_cfd` 按鈕已從底部工具列移除（Rev F 功能重整），
   使用者已無法從 UI 觸發 `toggleCFD()`，此 render error 的唯一入口已消失。`toggleCFD()`/
   `createCfdParticles()` 函式本體依 CLAUDE.md 第 5 條保留為休眠碼，不再修復。

2. **Draw calls 驗收標準改為「相對值」，不用絕對值 600**
   Baseline（重構前）本身就有 **8409** draw calls（主因是受保護的 `createRack()` 建了 24 個
   高精度機櫃），遠超原計畫 Phase 3 訂的「< 600」門檻，且該門檻在 baseline 階段就已無法達成。
   **使用者決議**：改用相對值規則——每個 Phase 結束後，draw calls 相對於該 Phase開始前的數值，
   只能持平或下降，不能上升。Phase 2+3 完成後為 **7582**（較 baseline 下降 827），符合新規則。
   之後 Phase 4/5 若有新增大量重複幾何，一樣要用此相對值規則檢查，並優先用 InstancedMesh。

3. **[已修正，2026-07-02 總驗收] Phase 2/3/4 三個系統的幾何穿模，已在 Phase 5 總驗收時解決**
   總驗收時用 headless browser 對 `containGroup` 內所有 Mesh/InstancedMesh 做逐一 AABB
   （world-space bounding box）比對，抓出兩類真實穿模（非目視推測）：
   a. `buildHotAisleContainment()` 上段煙囪立柱／帷幕板，與 `buildTCS()` 門架橫梁
      （x ∈ `VR_LAYOUT.tcs.postXs`，y=[2.35,2.45]，z 全跨 [-1.15,1.15]）在多個 x 位置重疊。
   b. `buildOverheadTrays()` 的吊架橫擔（原設計 z 全跨 [-1.6,1.6]，貫穿熱通道封閉上段
      所在的中央區域）與煙囪立柱/帷幕板重疊。
   **修正做法**：
   - `buildHotAisleContainment()`：煙囪立柱 x 改為 `[-halfW,-2.19,-0.63,0.36,2.07,halfW]`
     （程式搜尋得出，同時避開 TCS postXs 與吊架 0.8m 格點，含 0.1m 安全淨距）；與 TCS
     postXs 對齊的 5 個位置（含兩端）改用「上下分段」（避開 y=[2.34,2.46] 橫梁帶）；
     帷幕板凡跨距內仍包含 TCS postXs 的，同樣改上下分段，不再整片貫通。
   - `buildOverheadTrays()`：吊架橫擔（`crossArmMatrices`）從單一貫通 3.2m 長條，改為
     南北各一段（各 1.25m，中央 |z|<0.35 留空），因為熱通道中央本來就沒有 tray 需要支撐。
   修正後用 AABB 交集程式驗證：`containGroup` 全部 194 個世界座標框與 TCS 橫梁(5)、
   吊架橫擔(全部 instance) **零重疊**。Draw calls 7586（較 baseline 8409 仍下降 823，
   符合相對值規則）。

## Phase 4 淨距計算紀錄

上段煙囪 `chimneyHalfZ = 0.25`（curtain 外緣 z=0.265，louver 外緣 z=0.28）。
Fiber 槽道（`VR_LAYOUT.fiber`）中心 z=±0.45、trayW=0.30 → 內緣 z=±0.30。
淨距 = 0.30 - 0.28（louver 外緣，最保守） = **0.02m**，0.30 - 0.265（curtain 外緣）= **0.035m**。
均為正值，煙囪整體 `|z| ≤ 0.28 < 0.75`，符合 VR-REFACTOR-PLAN 要求，與 fiber 槽道無穿模。

## 0. 語法基準

`node --check app.js` → **通過**（baseline 語法正確，v24.16.0）。

---

## 1. init() 呼叫的所有 build 函式與行號

`init()` 本體：[app.js:86-127](app.js#L86)

呼叫順序（依程式碼順序）：
| 行號 | 呼叫 |
|---|---|
| 108 | `this.createTextures()` |
| 109 | `this.createMaterials()` |
| 110 | `this.setupLighting()` |
| 112 | `this.buildEnvironment()` |
| 113 | `this.buildHotAisleContainment()` |
| 114 | `this.buildDataCenter()` |
| 115 | `this.buildPiping()` |
| 116 | `this.buildPowerBusways()` |
| 123 | `this.animate()` |
| 125 | `this.updateHudState()` |
| 126 | `setTimeout(() => this.setCamera('overview'), 300)` |

其他頂層 build/邏輯函式（未在 init() 直接呼叫，供之後 Phase 參考行號）：
| 函式 | 行號 |
|---|---|
| `resize()` | 129 |
| `toggleLeftHud()` | 135 |
| `updateHudState()` | 140 |
| `applyCoupledData()` | 152 |
| `toggleSimPanel()` | 174 |
| `runSimulation()` | 200 |
| `setLiveVal()` | 798 |
| `createTextures()` | 807 |
| `createMaterials()` | 866 |
| `setupLighting()` | 904 |
| `pushInstMatrix()` | 940 |
| `buildEnvironment()` | 965 |
| `buildHotAisleContainment()` | 1008 |
| `buildDataCenter()` | 1127 |
| `createCDU(x,y,z,name)` | 1138 |
| `createRack(x,y,z,rot,name)` | **1626**（禁止改內部邏輯） |
| `buildPiping()` | 2359 |
| `buildPowerBusways()` | 2589 |
| `closeDetail()` | 2939 |
| `togglePipes()` | 2985 |
| `toggleDoors()` | 2992（禁止改內部邏輯） |
| `toggleExplode()` | 3023（禁止改內部邏輯） |
| `updateExplodedView()` | 3047 |
| `_snapshotMaterial()` / `_restoreMaterial()` | 3111 / 3121 |
| `toggleCFD()` | 3134（禁止改內部邏輯） |
| `createCfdParticles()` | 3372 |
| `toggleLeakAlarm()` | 3490（禁止改內部邏輯） |
| `updateCduScreen()` | 3506 |
| `animate()` | 3531 |

**重要發現（供 Phase 2 使用）**：`createCDU(x, y, z, name)` **沒有旋轉參數，也不回傳 group**——函式最後直接 `this.scene.add(group)` ([app.js:1624](app.js#L1624)) 就結束，沒有 `return group`。Phase 2 若要旋轉 CDU，不能用「取得回傳值」的方式，必須呼叫後在 `this.scene.children` 中以 `userData.name` 比對找出該 group 再設定 `rotation.y`（因為 `group.userData = { type: 'CDU', name: name }`，見 createCDU 內部）。

---

## 2. this.xxxGroup 屬性與讀取位置

| 屬性 | 建立位置 | 被讀取/使用的位置 |
|---|---|---|
| `this.containGroup` | [app.js:1123](app.js#L1123)（`buildHotAisleContainment()` 內，局部變數 `containGroup` 賦值後存入） | **`toggleCFD()` 內 [app.js:3189](app.js#L3189)**：`if (this.containGroup) this.containGroup.visible = true;` |
| `this.pipeGroup` | 於 `DTC` 物件初始屬性宣告為 `null`（[app.js:83](app.js#L83)），實際建立於 [app.js:2360](app.js#L2360)（`buildPiping()` 內） | `togglePipes()` [app.js:2987-2988](app.js#L2987)；`updateExplodedView()` [app.js:3079-3085](app.js#L3079)（爆炸拆解時 pipeGroup 保持靜止，只複位 origPos） |
| `this.buswayGroup` | [app.js:2590](app.js#L2590)（`buildPowerBusways()` 內） | **`toggleCFD()` 內 [app.js:3188](app.js#L3188)**：`if (this.buswayGroup) this.buswayGroup.visible = true;`；`updateExplodedView()` [app.js:3088-3108](app.js#L3088)（busway 爆炸展開邏輯，依 `item.userData.row`/`item.userData.type` 判斷方向） |

**CLAUDE.md 第 6 條的關鍵行號確認**：
- `buswayGroup` 在 `toggleCFD()` 的引用行號 = **3188**
- `containGroup` 在 `toggleCFD()` 的引用行號 = **3189**
- 兩者也都被 `updateExplodedView()` 讀取（3079、3088）。停用 `buildPowerBusways()` / `buildPiping()` / 改造 `buildHotAisleContainment()` 時，這兩處呼叫都要保證屬性非 undefined，否則 `toggleCFD()` 和爆炸拆解會拋 TypeError。

---

## 3. whitespace.html 中所有 onclick="DTC.xxx()" 按鈕

| 行號 | 按鈕 id | onclick |
|---|---|---|
| 108 | (無 id，關閉營運指標) | `DTC.toggleLeftHud()` |
| 148 | (無 id，關閉詳情面板) | `DTC.closeDetail()` |
| 209 | (無 id，模擬面板關閉鈕) | `DTC.toggleSimPanel()` |
| 360 | (無 id，執行模擬按鈕) | `DTC.runSimulation()` |
| 459 | `btn_toggle_hud` | `DTC.toggleLeftHud()` |
| 462 | `cam_overview` | `DTC.setCamera('overview')` |
| 463 | `cam_aisle` | `DTC.setCamera('aisle')` |
| 464 | `cam_hot_aisle` | `DTC.setCamera('hot_aisle')` |
| 465 | `cam_rack_close` | `DTC.setCamera('rack_close')` |
| 466 | `cam_cdu_close` | `DTC.setCamera('cdu_close')` |
| 467 | `cam_piping` | `DTC.setCamera('piping')` |
| 470 | `btn_sim` | `DTC.toggleSimPanel()` |
| 471 | `btn_toggle_doors` | `DTC.toggleDoors()` |
| 472 | `btn_toggle_explode` | `DTC.toggleExplode()` |
| 473 | `btn_toggle_pipes` | `DTC.togglePipes()` |
| 474 | `btn_toggle_cfd` | `DTC.toggleCFD()` |

底部工具列（Bottom Toolbar）整段在 [whitespace.html:457-475](whitespace.html#L457)。`btn_toggle_pipes` 那一排就是 Phase 1 要插入六顆新圖層按鈕的位置（緊接在 474 行 `btn_toggle_cfd` 之後、`</div>`(475) 之前）。

---

## 4. this.materials 已快取材質清單

`createMaterials()` [app.js:866-902](app.js#L866)：
`rackFrame, glassDoor, meshDoor, fp, lcd, port, pipeBlueM, pipeRedM, brass, aluminum, copper`

`buildHotAisleContainment()` 內新增：
`containmentPanel` (1011), `containmentFrame` (1017)

`createRack()` 內新增（1626 行起，禁止改內部邏輯，但材質快取清單仍列出供查閱）：
`copperDetail, pcbGreen, chromeDetail, darkMetal, goldPin, ledGreen, rubberBlack, blankingPanel, copperTube, leakSensor, blueHose, redHose, blueCollar, redCollar, brassDetail`

`buildPowerBusways()` 內新增：
`busway, buswayBox, buswayConduit, buswayHanger, blueFeed, redFeed`

**Phase 2 可直接引用的既有藍/紅管材質**：`this.materials.pipeBlueM`（藍，TCS supply）、`this.materials.pipeRedM`（紅，TCS return）——`buildPiping()` 內 [app.js:2411-2412](app.js#L2411) 已示範用法（`const blueM = this.materials.pipeBlueM; const redM = this.materials.pipeRedM;`）。

---

## 5. 數值比對（CLAUDE.md vs 實際程式碼）

| 項目 | CLAUDE.md 記載 | 實際程式碼 | 行號 | 一致？ |
|---|---|---|---|---|
| createRack w/h/d | 0.6 / 2.2 / 1.2 | `const w = 0.6, h = 2.2, d = 1.2;` | [app.js:1627](app.js#L1627) | ✅ |
| buildDataCenter 12 櫃 x 座標 | -3.41 至 +3.41 | `[-3.41,-2.79,-2.17,-1.55,-0.93,-0.31,0.31,0.93,1.55,2.17,2.79,3.41]` | [app.js:1131](app.js#L1131) | ✅ |
| buildDataCenter z | Row A z=-1.2, Row B z=+1.2 | `createRack(x,0,-1.2,0,...)` / `createRack(x,0,1.2,Math.PI,...)` | [app.js:1133-1134](app.js#L1133) | ✅ |
| buildPiping headerY | 2.5 | `const headerY = 2.5;` | [app.js:2362](app.js#L2362) | ✅ |
| buildPiping cduPipeY | 2.8 | `const cduPipeY = 2.8;` | [app.js:2363](app.js#L2363) | ✅ |
| buildPowerBusways buswayY | 3.25 | `const buswayY = 3.25;` | [app.js:2614](app.js#L2614) | ✅ |
| buildPowerBusways ceilingY | 4.0 | `const ceilingY = 4.0;` | [app.js:2689](app.js#L2689) | ✅ |
| 地板/天花板（buildEnvironment） | y=0 / y=4.0 | `baseFloor.position.y = 0;` / `ceil.position.y = 4.0;` | [app.js:971](app.js#L971) / [984](app.js#L984) | ✅ |

**全部一致，CLAUDE.md 數字不需修改，可直接進入 Phase 1。**

---

## 6. 補充：現有 CDU 呼叫位置（Phase 2 會修改的呼叫參數）

[app.js:1128-1129](app.js#L1128)：
```js
this.createCDU(-4.5, 0, 1.5, 'CDU-A (Primary)');
this.createCDU(-4.5, 0, -1.5, 'CDU-B (Redundant)');
```
目前 CDU 卡在機櫃列中間（z=±1.5），非 VR_LAYOUT 規劃的列端位置。

## 7. 補充：runSimulation() 參數輸入位置（供 Phase 5 使用）

UI 輸入欄位 id 與目前預設值：
- `sim_rack_kw`（機櫃功率）：HTML 預設 `value="120"`，[whitespace.html:228](whitespace.html#L228)；JS fallback `|| 120`，[app.js:204](app.js#L204)
- `sim_supply_temp`（二次側供水）：HTML 預設 `value="45"`，[whitespace.html:275](whitespace.html#L275)；JS fallback `|| 45`，[app.js:214](app.js#L214)（已經是 45°C，Phase 5 需確認/維持）
- `sim_return_temp`（二次側回水）：HTML 預設 `value="55"`，[whitespace.html:282](whitespace.html#L282)；JS fallback `|| 55`，[app.js:215](app.js#L215)

"GB200" 文案出現位置（Phase 5 更名用，只是起點，Phase 5 需重新 grep 三個檔案完整清單）：
- [whitespace.html:52](whitespace.html#L52) `<title>NVIDIA GB200 NVL72 ...`
- [whitespace.html:90](whitespace.html#L90) `NVIDIA GB200 NVL72 | 液冷資料中心數位孿生`
