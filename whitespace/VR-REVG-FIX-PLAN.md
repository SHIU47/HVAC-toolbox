# Vera Rubin 白區模擬 — Rev G 修正計畫
## Claude Code (Sonnet) 分階段命令詞

> **背景**:上一輪「四周柱子與 Fanwall 外移」被誤解執行——實際需求是
> 外移「房間建築柱」擴大房間包絡,Sonnet 卻外移了 common support 最外站
> 的門架立柱,造成光纖環端部懸空、柱頂頂板貼虛空;同時 Fanwall(x=6.2)
> 突出天花板(僅蓋 x±6)、預留位飄出房間並與機體重疊。另發現該 commit
> 聲稱使用不存在的 headless browser 驗證(幻覺聲明)與 CRLF 行尾污染。
>
> **紀律同前**:每 Phase 新 session、附 commit hash、你親自 git log 確認。

---

# Phase G1 — 還原錯誤改動 + 版本庫清理 + 誠實驗證條款

```
請先閱讀 CLAUDE.md 與 DEPENDENCY-MAP.md 並遵守所有守則。
背景:commit 7c48a98 對 buildOverheadTrays() 最外支撐站立柱的外移
是需求誤解(使用者指的是房間建築柱,不是支撐架立柱),且造成
光纖環端部失去支撐、柱頂頂板超出天花板範圍。本 Phase 精準還原
該部分、清理行尾污染、補強守則。Fanwall 常數的調整(x=6.2/z=±2.9)
本 Phase 先保留,G2 會連同房間擴大一起重定。

== 工作 1:還原支撐站錯誤外移 ==
1. 先處理未提交變更:git diff 確認 CLAUDE.md 與 style.css 的工作區
   差異是否為純行尾(逐行內容相同僅 CRLF/LF)。若是,
   git checkout -- CLAUDE.md style.css 丟棄;若含實質內容差異,
   列出差異內容給我決定。
2. 還原 buildOverheadTrays() 中 lastStation 相關邏輯(lastStationColZs /
   lastBeamSpanLo/Hi / lastBeamMidZ / lastBeamLen / lastBeamMatrices /
   isLastStation 分支與其 addInstMesh),恢復全部支撐站統一使用
   supportColZs(z=±0.95/±2.80)。可用 git show 7c48a98 -- app.js 的
   diff 反向對照,僅還原支撐站段,VR_LAYOUT.fanwall 常數段保留不還原。
3. 驗證:最外站三層橫擔恢復跨 z 0.87~2.88,光纖環(±1.5)在全部
   10 站皆有橫擔承托;grep lastStation 零殘留。

== 工作 2:.gitattributes 防 CRLF 復發 ==
專案根目錄新增 .gitattributes:
   *.js text eol=lf
   *.css text eol=lf
   *.html text eol=lf
   *.md text eol=lf
commit 後執行 git status 確認工作區乾淨。

== 工作 3:CLAUDE.md 誠實驗證條款 ==
驗證流程段落追加:
「12. 驗證聲明必須如實:只能陳述本環境實際執行過的驗證手段
(node --check、grep、座標演算)。本環境沒有 headless browser、
沒有截圖能力——嚴禁在回報或 commit message 中聲稱執行過瀏覽器
渲染驗證、目視確認、截圖比對。視覺驗收一律標註『待使用者目視確認』。」

== 驗收(附 hash)==
[ ] 支撐站 10 站立柱/橫擔全部恢復統一位置,光纖環全程有承托
[ ] grep lastStation / lastBeam 零殘留
[ ] git status 乾淨,.gitattributes 生效
[ ] CLAUDE.md 新增第 12 條
[ ] node --check、draw calls 相對開始前持平或下降、commit hash
```

---

# Phase G2 — 房間包絡擴大 + Fanwall 牆位重佈(原需求正確版)

```
請先閱讀 CLAUDE.md 與 DEPENDENCY-MAP.md 並遵守所有守則。
背景:原始需求的正確詮釋——外移「房間建築柱」與天花板,擴大房間
包絡提升真實性;Fanwall 依機房實務改為沿 +x 牆等距槽位佈置,
預留位為同列空槽,徹底解決突出天花板與重疊問題。

只允許修改:buildEnvironment()、VR_LAYOUT(room/fanwall)、
buildFanWalls()。

== 新包絡(唯一真值,已驗算)==
room 新增: { ceilingY: 5.40, floorY: 0, ceilW: 16, ceilD: 12,
             colXs: [-7.5, 0, 7.5], colZ: 5.5 }
fanwall 改:{ x: 7.0, slotZs: [-4.05, -1.35, 1.35, 4.05],
             installed: [1, 2],            // 裝機槽位索引(中間兩槽)
             w: 0.90, h: 2.20, d: 2.40 }
(刪除 zA/zB/reservedZ/reservedW/reservedD 舊欄位,grep 零殘留)
驗算:天花板蓋 x±8/z±6;fanwall x 5.75~7.45 < 8 ✓;最外槽 z 4.05+1.2
=5.25 < 6 ✓;建築柱 x=±7.5 在 fanwall 機體(7.45)之後 0.05——柱寬
0.4 會與機體相切,故 fanwall x 改為 6.8(機體 6.35~7.25,與柱淨距
0.05+0.2=0.25)✓;建築柱 z=±5.5 與最外槽(5.25)淨距 0.25 ✓。

== 工作 1:房間擴大(buildEnvironment)==
1. 天花板 PlaneGeometry 12×8 → 16×12(位置 y=ceilingY 不變)
2. 建築柱:原 4 支 [±5,±3.5] 改為 6 支——colXs(-7.5/0/+7.5)×
   z=±colZ(5.5),柱斷面/材質/柱底 -0.6 規則照舊
3. 燈具與 PointLight:原 z=-2/0/+2 三組,補為 z=-4/-2/0/+2/+4 五組
   (x=0 不變),覆蓋加大後的房間;燈具貼天花板規則照舊
4. 冷通道地面標線(z=±1.8 兩條)長度由 7.5 延長到 10,蓋到 fanwall 前緣

== 工作 2:Fanwall 牆位重佈(buildFanWalls)==
1. 依 slotZs 四槽位:installed 索引槽建整機(幾何規格照 F4 原樣:
   9 風機/狀態螢幕/頂部導管——導管接天花板,新天花板已涵蓋此 x)
2. 其餘兩槽建預留位:地面黃虛線框(0.95×2.45,置中於槽位)+
   「RESERVED ‧ FANWALL N+1」地貼,規格沿用 F4 既有作法
3. 四槽位彼此淨距 = 2.70-2.40 = 0.30,不重疊;虛線框與整機不共槽,
   重疊問題自然消除
4. 風機動畫 this.fanRotors 機制照舊

== 工作 3:總驗收(逐項回報)==
[ ] 天花板/建築柱/燈具構成加大後的完整房間,無任何物件突出包絡
    (逐項回報 fanwall/預留位/柱/導管的邊界座標 vs 天花板範圍)
[ ] 兩台 Fanwall + 兩個預留槽沿 +x 牆等距一列,互不重疊
[ ] 支撐站(G1 還原後)與新房間無衝突;光纖環承托完好
[ ] 圖層七開關/爆炸拆解/相機六視角迴歸正常
[ ] draw calls 最終值 vs pre-revG(回報兩數)
[ ] git commit && git tag v2.6-revG,回報 hash 與 tag
```

---

# 備註

1. G1 的還原是「精準外科」不是 git revert 整筆——因為 7c48a98 裡
   fanwall 常數調整的方向是對的(離機櫃太近確實該退),錯的只有
   支撐站段;G2 會在正確的房間包絡下重定 fanwall 最終位置。
2. G2 的包絡數字已互相驗算過(fanwall x 因與建築柱相切已預先修正
   為 6.8),Sonnet 照抄即可,若它回報任何淨距為負,先停下貼給我。
3. 這輪的教訓寫進了守則第 12 條:它聲稱過不存在的 headless browser
   驗證。之後任何 Phase 回報若出現「截圖確認」「瀏覽器驗證」字樣,
   直接視為紅旗,以你的目視為準。
