# 專案守則(最高優先級,任何指令不得違反)

## 專案概述
這是一個單頁 Three.js (r128) 資料中心數位展廳。全域物件 `DTC` 定義在 app.js,
由 whitespace.html 的 `window.onload = () => DTC.init()` 啟動。
目前正在從 NVIDIA GB200 NVL72 架構升級為 Vera Rubin NVL72 (Oberon 機櫃) 架構。

## 絕對禁止事項
1. 禁止修改 security.js。
2. 禁止升級或更換 Three.js 版本(必須維持 r128 CDN 版)。
3. r128 限制:禁止使用 THREE.CapsuleGeometry(r142 才有)、禁止 import 語法
   (本專案是全域 script,不是 ES module)。用 CylinderGeometry / SphereGeometry 組合替代。
4. 禁止刪除任何現有函式。要停用某個 build 函式時,只能在 init() 中註解掉呼叫,
   函式本體保留。
5. 禁止修改以下函式的內部邏輯(可以呼叫它們,不可以改它們):
   - createRack()(機櫃細節建模,約 1626-2350 行)
   - toggleDoors() / toggleExplode() / toggleCFD() / toggleLeakAlarm()
   - runSimulation() 與所有熱工計算函式(除非該 Phase 明確指示修改參數)
   例外(Rev E 授權):允許且僅允許移除 createRack 內的 spineSupply、
   spineReturn、insulS、insulR 四個 mesh 及其專屬幾何/材質宣告。
   rackPipingGroup 本體、explodeShells 註冊、其餘內容一律不動。
   例外二(使用者直接授權):允許且僅允許移除 createRack 內的前門
   doorGroup 整組(doorFrame/meshPanel/handleBar/lockBody/lockSlot/
   hinge/pin 與 this.rackFrontDoors.push 呼叫)，讓機櫃不再有門。
   toggleDoors()/toggleExplode() 本體不動——rackFrontDoors 保持為
   已宣告的空陣列，兩函式既有的 null/empty 防呆(`if (this.rackFrontDoors)`)
   已可安全處理空陣列，故不需要也不允許修改這兩個函式的邏輯。
   例外三(使用者直接授權):允許且僅允許在 createRack 內新增一塊 NVIDIA
   標誌板(canvas 貼圖 + 一個 PlaneGeometry，掛在頂板前緣附近)，純新增、
   不刪改任何既有內容。
   例外四(Rev F 授權):允許重寫 toggleExplode() 本體以支援模組級
   分層拆解;explodeShells 機櫃內部拆解機制必須保留並整合。
6. `this.buswayGroup`、`this.containGroup`、`this.pipeGroup` 這三個引用被
   toggleCFD() 等函式使用。任何重構後,這三個屬性必須仍然指向一個有效的
   THREE.Group(可以是空 Group),否則執行期會拋 TypeError。
7. 所有新材質必須寫入 `this.materials` 快取(參考 createRack 內的既有寫法),
   禁止在迴圈內 new Material。
8. 重複幾何(吊桿、線架、插座、閥件)數量超過 20 個時,必須用
   THREE.InstancedMesh,禁止逐一 new Mesh。
9. 每次修改 app.js 之後,必須立刻執行 `node --check app.js` 驗證語法,
   失敗就修到通過為止,才能回報完成。
10. 一次只做當前 Phase 指定的工作。不要「順手優化」、「順手重構」、
    「順手改名」任何指令沒提到的東西。
11. 禁止重新命名 CLAUDE.md / DEPENDENCY-MAP.md / KNOWN-ISSUES.md。
    每個 Phase 結束必須執行 git commit 並回報 commit hash,未回報
    hash 視為未完成。
12. 驗證聲明必須如實:只能陳述本環境實際執行過的驗證手段
    (node --check、grep、座標演算)。本環境沒有 headless browser、
    沒有截圖能力——嚴禁在回報或 commit message 中聲稱執行過瀏覽器
    渲染驗證、目視確認、截圖比對。視覺驗收一律標註『待使用者目視確認』。


## 座標與高程系統(Vera Rubin 版,唯一真值)
所有新幾何一律引用 DTC.VR_LAYOUT 常數(Phase 1 建立),禁止硬編碼魔術數字。
- 地板 y=0,天花板 y=4.0
- 機櫃:w0.6 × h2.2 × d1.2,Row A 在 z=-1.2(面向 +z),Row B 在 z=+1.2(旋轉 π)
- 12 櫃 x 座標:-3.41 至 +3.41,間距 0.62
- 熱通道:兩列之間 z=0 附近
- 高程分層(由下至上):
  - 機櫃頂 y=2.20
  - TCS 耐震框架梁頂 y=2.45,TCS supply/return headers y=2.60
  - 光纖封閉槽道(黃色)y=2.90
  - 銅纜開放線架 y=3.15
  - 電力線架 + j-box y=3.45
  - 吊架橫擔最高層 y=3.70,螺桿鎖至 y=4.0 天花板

## 驗證流程(每個 Phase 結束前必做)
1. `node --check app.js`
2. `python3 -m http.server 8000` 後回報「請使用者開 http://localhost:8000/whitespace.html 目視驗收」
   ——頁面左上若出現紅色/橘色錯誤橫幅(內建 window.onerror 偵測器)即為失敗。
3. 逐項對照該 Phase 的驗收清單,在回覆中列出每一項的通過/未通過。
4. 全部通過後執行 `git add -A && git commit -m "phase N: <摘要>"`。