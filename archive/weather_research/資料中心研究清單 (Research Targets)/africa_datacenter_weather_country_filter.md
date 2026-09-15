# Africa Data Center — 國家天氣分析篩選版

> 目的：將非洲資料中心國家從「全部納入」縮減成適合做**資料中心天氣／氣候分析**的國家清單。
>
> 基礎資料：使用目前提供的 `africa_tier3_datacenters.md`，來源為 Uptime Institute public awards database，資料存取時間為 2026-09。
>
> **重要限制：**原始資料只涵蓋正式取得 Uptime Institute Tier III/IV award 的設施；「Zero on file」不代表該國沒有資料中心。

---

## 1. 建議最終篩選

如果目標是做一份**可控規模、又能代表非洲主要資料中心市場與不同氣候區**的天氣分析，建議不要把所有國家都納入。

### 第一級：核心分析國家（6 國）

| ISO3 | 國家 | 原始資料約略規模 | 建議 | 主要分析城市 | 原因 |
|---|---|---:|---|---|---|
| ZAF | South Africa | 15+ | **保留** | Johannesburg / Cape Town | 非洲最深資料中心市場，且南非內部已有明顯氣候差異 |
| EGY | Egypt | 25+ | **保留** | Cairo / Giza | 北非最大資料中心樣本之一，且高度集中 Cairo/Giza |
| NGA | Nigeria | 15 | **保留** | Lagos / Abuja | 西非最重要市場之一，Lagos 樣本密集 |
| MAR | Morocco | 20+ | **保留** | Casablanca / Rabat | 北非重要市場，設施數量高且城市群明確 |
| KEN | Kenya | 6 | **保留** | Nairobi / Konza | 東非代表市場，Nairobi 集中度高 |
| ETH | Ethiopia | 8 | **保留** | Addis Ababa / Debre Berhan | 東非重要市場，且海拔與氣候條件具有分析價值 |

**第一級 = 建議一定做。**

這 6 國可以同時涵蓋：

- Southern Africa
- North Africa
- West Africa
- East Africa
- 高溫乾燥／沙漠型
- 熱帶濕潤型
- 高海拔型
- 南半球溫帶／亞熱帶型

---

## 2. 第二級：次要分析國家（5 國）

| ISO3 | 國家 | 原始資料規模 | 建議 | 主要分析城市 | 原因 |
|---|---|---:|---|---|---|
| AGO | Angola | 4 | **可保留** | Luanda | 南部非洲重要市場，樣本雖少但全部集中 Luanda |
| BWA | Botswana | 4 | **可保留** | Gaborone | 乾燥氣候代表，適合冷卻／高溫分析 |
| GHA | Ghana | 6 | **可保留** | Accra / Tema | 西非重要市場，沿海熱濕氣候具代表性 |
| MUS | Mauritius | 3 | **可保留** | Ebène / Rose Belle | 島嶼型熱濕氣候，適合氣候對照 |
| ZMB | Zambia | 2 | **視篇幅保留** | Lusaka | 南部非洲內陸市場，補充性高 |

**第二級 = 如果研究需要完整的區域氣候比較，再加入。**

---

## 3. 第三級：低優先國家（6 國）

| ISO3 | 國家 | 原始資料規模 | 建議 | 原因 |
|---|---|---:|---|---|
| MOZ | Mozambique | 2 | **低優先** | Maputo 有兩個 Tier III 紀錄 |
| TZA | Tanzania | 2 | **低優先** | Dar es Salaam 有兩個 Tier III 紀錄 |
| UGA | Uganda | 1 | **低優先** | Kampala 僅 1 個紀錄 |
| COD | DR Congo | 2 | **低優先** | Kinshasa 有 2 個紀錄 |
| CIV | Côte d'Ivoire | 2 | **低優先** | Grand-Bassam 有 2 個紀錄 |
| SEN | Senegal | 4 | **低優先／可升級** | Dakar 都會區有多個設施，但整體市場仍較小 |

這些國家並非沒有研究價值，而是**第一版天氣分析加入後，對整體結論的增加幅度有限**。

---

# 4. 排除／暫不納入

原始資料中列為 Zero on file 或尚未 individually queried 的國家，不建議直接拿來做第一版國家級分析。

### Zero on file

```text
RWA — Rwanda
ZWE — Zimbabwe
NAM — Namibia
```

特別注意：

- Rwanda：原始資料自己指出有 data-center activity，但尚未出現在這個 Uptime award registry。
- Zimbabwe：Zero on file。
- Namibia：Zero on file。

因此這些國家應標記為：

> **Not enough Uptime award data — not equivalent to no data centers**

而不是直接判定「沒有資料中心」。

---

# 5. 最推薦的三種篩選方案

## A. 精簡版：6 國

如果你現在最重要的是**把國家數量大幅降低，先建立天氣分析模型**：

```text
ZAF — South Africa
EGY — Egypt
NGA — Nigeria
MAR — Morocco
KEN — Kenya
ETH — Ethiopia
```

### 優點

- 每個主要非洲次區域都有代表
- 資料中心數量足夠
- 氣候差異很大
- 後續 TMY / weather station 比較容易控制

**推薦程度：★★★★★**

---

## B. 標準版：11 國

如果要做正式研究報告：

```text
ZAF — South Africa
EGY — Egypt
NGA — Nigeria
MAR — Morocco
KEN — Kenya
ETH — Ethiopia

AGO — Angola
BWA — Botswana
GHA — Ghana
MUS — Mauritius
ZMB — Zambia
```

### 優點

在 6 個核心國家之外，再加入：

- 乾燥內陸：Botswana
- 熱帶沿海：Ghana / Angola
- 島嶼氣候：Mauritius
- 南部非洲內陸：Zambia

**推薦程度：★★★★☆**

---

## C. 擴充版：17 國

若需要最大化目前 Uptime award registry 的覆蓋：

```text
ZAF — South Africa
EGY — Egypt
NGA — Nigeria
MAR — Morocco
KEN — Kenya
ETH — Ethiopia

AGO — Angola
BWA — Botswana
GHA — Ghana
MUS — Mauritius
ZMB — Zambia

MOZ — Mozambique
TZA — Tanzania
UGA — Uganda
COD — DR Congo
CIV — Côte d'Ivoire
SEN — Senegal
```

這版比較適合做**非洲資料中心市場盤點**，而不是第一版 weather model。

**推薦程度：★★★☆☆**

---

# 6. 為什麼不建議只按照「資料中心數量」排序

如果你的最終目標是**天氣分析／冷卻分析**，單純按照資料中心數量排序會漏掉一些很有價值的氣候樣本。

例如：

### Botswana

資料中心數量不多，但 Gaborone 是乾燥內陸環境。

→ 適合分析高溫、乾燥空氣、冷卻需求。

### Mauritius

資料中心數量少，但屬島嶼型環境。

→ 適合分析高濕度、海洋性氣候。

### Ethiopia

資料中心集中在 Addis Ababa / Debre Berhan。

→ 海拔條件具有特殊性。

因此建議使用：

> **資料中心數量 + 地理代表性 + 氣候差異**

三個條件一起篩選。

---

# 7. 國家 → 城市層級建議

做 Weather / TMY 分析時，不建議直接：

```text
Country → Country Weather
```

建議：

```text
Country
   ↓
Data Center Cluster
   ↓
City
   ↓
Weather Station / TMY
```

### 核心國家

| 國家 | 第一優先城市 | 第二優先 | 分析方向 |
|---|---|---|---|
| South Africa | Johannesburg | Cape Town | 內陸 vs 沿海、南半球季節 |
| Egypt | Cairo / Giza | Alexandria | 炎熱乾燥 vs 沿海 |
| Nigeria | Lagos | Abuja | 沿海濕熱 vs 內陸 |
| Morocco | Casablanca | Rabat | 沿海 vs 內陸／北非氣候 |
| Kenya | Nairobi | Konza | 高地 vs 其他 |
| Ethiopia | Addis Ababa | Debre Berhan | 高海拔氣候 |

---

# 8. South Africa 特別處理

South Africa 不應該只使用一組全國平均天氣。

原始資料顯示其資料中心主要集中在：

- Johannesburg
- Centurion
- Midrand
- Samrand
- Gauteng
- Cape Town

因此建議：

```text
ZAF
│
├── Johannesburg / Gauteng Cluster  ← Primary
│
└── Cape Town                       ← Secondary
```

這樣可以避免把南非不同氣候區平均掉。

---

# 9. Egypt 特別處理

Egypt 的資料中心高度集中在 Cairo / Giza。

因此第一版可以直接：

```text
EGY
└── Cairo / Giza
```

再視需求加入 Alexandria。

原始資料也明確將 Egypt 描述為北非最大的資料中心樣本之一，並指出其高度集中於 Cairo/Giza。

---

# 10. Nigeria 特別處理

Nigeria 的資料中心明顯集中 Lagos，同時 Abuja 有國家級資料中心。

因此：

```text
NGA
├── Lagos   ← Primary
└── Abuja   ← Secondary
```

這比使用 Nigeria 全國平均天氣更適合資料中心分析。

---

# 11. 最終推薦資料架構

如果你後面要把 Africa 和 South America 放到同一套分析流程，我建議統一成：

```text
Africa
│
├── Tier 1 — Core Countries
│   ├── ZAF — South Africa
│   ├── EGY — Egypt
│   ├── NGA — Nigeria
│   ├── MAR — Morocco
│   ├── KEN — Kenya
│   └── ETH — Ethiopia
│
├── Tier 2 — Secondary Countries
│   ├── AGO — Angola
│   ├── BWA — Botswana
│   ├── GHA — Ghana
│   ├── MUS — Mauritius
│   └── ZMB — Zambia
│
├── Tier 3 — Low Priority
│   ├── MOZ — Mozambique
│   ├── TZA — Tanzania
│   ├── UGA — Uganda
│   ├── COD — DR Congo
│   ├── CIV — Côte d'Ivoire
│   └── SEN — Senegal
│
└── Not enough award data
    ├── RWA — Rwanda
    ├── ZWE — Zimbabwe
    └── NAM — Namibia
```

---

# 12. 最終結論

### 如果你現在要快速開始 Weather Analysis

**直接用 6 國：**

```text
ZAF
EGY
NGA
MAR
KEN
ETH
```

### 如果要做正式版

**用 11 國：**

```text
ZAF
EGY
NGA
MAR
KEN
ETH
AGO
BWA
GHA
MUS
ZMB
```

### 如果需要完整市場盤點

再加入：

```text
MOZ
TZA
UGA
COD
CIV
SEN
```

### 不要因為 Zero on file 就判定「沒有資料中心」

```text
RWA
ZWE
NAM
```

應標記為 **Data insufficient / Not in Uptime award registry**。

---

## 13. 建議下一步

你的南美與非洲現在可以統一成同一套邏輯：

```text
Region
  ↓
Country Tier
  ↓
Data Center City / Cluster
  ↓
Weather Station
  ↓
TMY / EPW
  ↓
Temperature
Humidity
Dew Point
Rainfall
Wind
Extreme Weather
  ↓
Data Center Weather Score
```

這樣最後可以很容易做成：

**Africa vs South America — Data Center Climate / Weather Comparison**

而不需要把所有國家全部跑一次。
