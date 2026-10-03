# 165 站氣象資料整合備忘錄 (Weather Integration Notes)

本文件整理自 Phase 4 Round 3 審查 `public/天氣資料/` 165 測站逐時數據庫與 PUE 計算系統資料流之發現。下一步進行系統整合時，**請在前端 Adapter 層進行格式轉換，嚴禁重寫 165 個原始 JSON（共 91 MB）**。

---

## 1. 欄位格式差異與 Adapter 映射清單

| 項目 | 165 站 hourly JSON (`public/天氣資料/hourly/*.json`) | PUE 系統期待格式 (`site.hourly[i]`) | Adapter 處理指引與風險防範 |
|---|---|---|---|
| **月份** | `m` (**0～11**) | `month` (**1～12**) | **重大風險**：必須轉換為 `month = h.m + 1`。<br>若誤寫為 `month = h.m`，在 `store.js` 的 `computeMonthlyStats` 中：`const m = (h.month ? h.month - 1 : hourToMonth(idx))` 會將 1 月 (`0`) 判斷為 falsy 而改以索引推算，導致其餘 2~12 月整體錯位一個月且完全不報錯！ |
| **日 (Day)** | `d` (1～31) | `day` (1～31) | 映射為 `day = h.d`（部分排程引擎 `isHourInSchedule` 讀取 `record.day`）。 |
| **時 (Hour)** | `h` (1～24) | `hour` (1～24) | 映射為 `hour = h.h`（`isHourInSchedule` 讀取 `record.hour`）。 |
| **索引** | 無此欄位 | `hourIndex` (0～8759) | 於映射時依迴圈索引給定 `hourIndex = i`。 |
| **乾球溫度** | `db` (°C) | `db` (°C) | 1:1 直接對應。 |
| **濕球溫度** | `wb` (°C) | `wb` (°C) | 由產生器之 Stull (2011) 公式計算。已抽樣驗證高雄 8,760h 逐時平均偏差僅 0.01°C，可直接使用。 |
| **露點溫度** | `dp` (°C) | `dp` (°C) | 1:1 直接對應。 |
| **相對濕度** | `rh` (%) | `rh` (%) | 1:1 直接對應。 |
| **太陽輻射** | `rad` (W/m²) | - | PUE 系統目前未直接使用，保留無妨。 |

---

## 2. 測站設計條件 (Design Conditions) 對接

- **資料結構**：
  在 Task X-2 中，產生器 `archive/weather_tools/build_weather_data.js` 已為 `public/天氣資料/weather_data.js` 的 165 個測站全數注入 `designConditions` 欄位：
  ```javascript
  {
    source: 'ASHRAE HOF Ch.14 (EPW header)',
    cooling: { db004: 33.5, mcwb004: 26.8, evapWb004: 28.3 },
    extremes: {
      dbMaxMean: 35.2, dbMinMean: 10.1,
      dbMax: { 5: 35.7, 10: 36.2, 20: 36.7, 50: 37.2 },
      dbMin: { 5: 8.7, 10: 7.6, 20: 6.6, 50: 5.2 }
    }
  }
  ```
- **系統整合**：
  選擇 165 站之任一測站時，直接將該測站物件的 `designConditions` 傳入 `AppStore.updateSite({ designConditions })`，格式與現行 7 大內建城市及 EPW Parser 完全一致，X-4 的 ASHRAE 0.4% 優先、`peakDb` (n=20)、`freezeDb` (n=50) 與極值差距警示皆直接相容生效。

---

## 3. 載入效能與離線 `file://` 相容性架構

1. **體積與隨選載入 (On-Demand Loading)**：
   - 165 站逐時資料總計 91 MB，**不可一次性內嵌至 JS 檔**。
   - 建議維持現況：`weather_data.js` (~140 KB) 作為輕量化測站索引清單，使用者於 UI 選定城市後，再動態載入對應的 `hourly/{stationId}.json` (~550 KB)。
2. **`file://` 本地檔案協定 CORS 防護**：
   - 使用者若雙擊 HTML 於本地瀏覽器（`file:///...`）開啟，原生 `fetch()` 載入本地 JSON 將觸發瀏覽器 CORS 安全阻擋。
   - **防護策略**：比照 `catalog_manager.js` 的 `file://` 後備機制：
     - 若 `location.protocol === 'file:'`，可先以 `fetch` 嘗試；
     - 若失敗，可提示使用者使用本機靜態伺服器（例如 VSCode Live Server 或 `npx serve`），或針對最常用的熱門城市提供內建備用資料。

---

## 4. 推薦之 Adapter 實作範例

```javascript
function adaptHourlyRecord(rawRecord, hourIndex) {
    return {
        hourIndex: hourIndex,
        month: rawRecord.m + 1, // 0~11 -> 1~12 (關鍵修正)
        day: rawRecord.d,
        hour: rawRecord.h,
        db: rawRecord.db,
        wb: rawRecord.wb,
        dp: rawRecord.dp,
        rh: rawRecord.rh
    };
}

async function loadStationWeather(stationMeta) {
    const jsonUrl = `../天氣資料/hourly/${stationMeta.id}.json`;
    const res = await fetch(jsonUrl);
    const rawHourly = await res.json();
    const hourly = rawHourly.map((r, i) => adaptHourlyRecord(r, i));

    AppStore.updateSite({
        selectedCity: stationMeta.cityZh || stationMeta.city,
        stationName: stationMeta.stationName,
        country: stationMeta.country,
        lat: stationMeta.lat,
        lon: stationMeta.lng,
        elev: stationMeta.elev,
        isRealEpw: true,
        hourly: hourly,
        designConditions: stationMeta.designConditions || null
    });
}
```
