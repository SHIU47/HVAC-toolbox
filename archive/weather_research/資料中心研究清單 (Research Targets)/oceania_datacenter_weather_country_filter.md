# Oceania & South-West Pacific Data Center — 國家天氣分析篩選版

> 目的：將 Oceania & South-West Pacific 的資料中心國家／市場縮減成適合做**資料中心天氣／氣候分析**的清單。
>
> 基礎資料：使用提供的 `oceania_tier3_datacenters.md`，來源為 Uptime Institute public awards database，資料存取時間為 2026-09。
>
> **重要限制：**原始資料只涵蓋正式取得 Uptime Institute Tier III/IV award 的設施；Zero on file 不代表該國沒有資料中心。

---

## 1. 建議最終篩選

這個區域和非洲、南美不同：**國家數量本身不多，但 Indonesia 與 Australia 的市場規模非常大，而且目前原始資料對兩國是 partial/sample pull。**

因此建議按照「資料中心規模 + 氣候代表性 + 後續 TMY/Weather Station 可操作性」篩選。

### 第一級：核心分析國家（5 國）

| ISO3 | 國家 | 原始資料規模 | 建議 | 主要分析城市／區域 | 主要原因 |
|---|---|---:|---|---|---|
| AUS | Australia | ~55+ | **保留** | Sydney / Melbourne / Perth / Brisbane | 大洋洲最重要資料中心市場，且跨越多種氣候區 |
| IDN | Indonesia | 102 | **保留** | Greater Jakarta / Surabaya / Bandung / Batam | 區域最大 Tier III/IV 樣本，熱濕氣候非常重要 |
| MYS | Malaysia | 20+ | **保留** | Cyberjaya / Kuala Lumpur / Johor | 東南亞熱濕資料中心市場，樣本多且城市集中 |
| SGP | Singapore | 15+ | **保留** | Singapore | 高密度資料中心市場，熱濕環境與冷卻需求極具代表性 |
| PHL | Philippines | 6 | **保留** | Metro Manila / Cavite / Clark / Batangas | 熱帶海洋性氣候，且已有多個 Tier III 設施 |

**第一級 = 建議一定做。**

這 5 個市場已經能涵蓋：

- 澳洲南半球氣候
- 熱帶赤道氣候
- 熱帶海洋性氣候
- 高濕度沿海城市
- 大型資料中心集中區

---

## 2. 第二級：次要分析國家（1 國）

| ISO3 | 國家 | 原始資料狀態 | 建議 | 主要分析城市 | 原因 |
|---|---|---|---|---|---|
| BRN | Brunei | 2 | **可保留** | Bandar Seri Begawan | 小型但具有熱帶高濕氣候代表性，可作區域對照 |

**第二級 = 若希望增加熱帶氣候樣本再加入。**

Brunei 雖然只有 2 個 Tier III 紀錄，但兩個都在 Bandar Seri Begawan，因此城市與氣象資料匹配相對單純。

---

## 3. 第三級：資料不足／不建議直接排除的市場

### New Zealand

```text
NZL — New Zealand
```

目前沒有 Tier-level certification，只有 Datacom 的 M&O recognition。

原始資料列出的城市包括：

- Auckland
- Wellington
- Christchurch
- Hamilton

因此：

> **不要把 New Zealand 當成「沒有資料中心」。**

如果你的研究可以使用非 Tier III/IV certification 的資料中心，它其實非常值得納入。

但如果你的規則是：

> 「只有 Uptime Institute Tier III/IV award 才能進入樣本」

則第一版可以排除。

---

## 4. Zero on file

原始資料目前列為：

```text
PNG — Papua New Guinea
FJI — Fiji
```

這兩個市場建議標記：

> **Not enough Uptime award data**

而不是：

> No data center

因為原始資料明確提醒，Zero on file 不代表沒有 Tier-equivalent infrastructure。

---

# 5. 最推薦的三種篩選方案

## A. 精簡版：5 國

如果你的目標是：

> **先把 Oceania / South-West Pacific 的天氣分析跑起來**

直接使用：

```text
AUS — Australia
IDN — Indonesia
MYS — Malaysia
SGP — Singapore
PHL — Philippines
```

### 優點

- 規模足夠
- 氣候差異明顯
- TMY / EPW 資料相對容易找
- 避免小島國家造成資料處理成本暴增

**推薦程度：★★★★★**

---

## B. 標準版：6 國

如果需要多一個熱帶小型市場：

```text
AUS — Australia
IDN — Indonesia
MYS — Malaysia
SGP — Singapore
PHL — Philippines
BRN — Brunei
```

**推薦程度：★★★★☆**

---

## C. 擴充版：7 國 + NZ

如果你不想把 New Zealand 因為 certification 條件直接排掉：

```text
AUS
IDN
MYS
SGP
PHL
BRN
NZL
```

其中：

```text
NZL = M&O only
```

需要在資料表裡保留 certification type 欄位，避免和 Tier III/IV 樣本混在一起。

**推薦程度：★★★☆☆**

---

# 6. Australia 必須特別處理

Australia 原始資料約有 55+ 個設施，而且目前提供的清單只是 sample；原始文件也明確指出還有約 35 個設施未完整列出。

因此 Australia 不應該直接：

```text
AUS → one weather station
```

建議拆成：

```text
AUS
│
├── Sydney
├── Melbourne
├── Perth
├── Brisbane
└── Other regional hubs
```

### 第一版 Weather Analysis 建議

```text
Sydney
Melbourne
Perth
Brisbane
```

這四個城市已能提供很好的氣候對照：

- Sydney：沿海、溫和
- Melbourne：較涼、季節變化
- Perth：較乾燥、夏季炎熱
- Brisbane：較溫暖、濕潤

---

# 7. Indonesia 必須特別處理

Indonesia 是本區最大的 Tier III/IV 市場，原始資料列出 **102 個 awarded facilities**，但目前檔案只抓到其中約 10 個範例，並明確標記需要 dedicated full pull。

因此不能把目前這份資料當成完整 facility count。

建議第一版：

```text
IDN
│
├── Greater Jakarta
│   ├── Jakarta
│   ├── Bekasi
│   ├── Karawang
│   └── Depok
│
├── Surabaya
├── Bandung
├── Batam
└── Bogor
```

### Weather Analysis 優先順序

```text
1. Greater Jakarta
2. Surabaya
3. Bandung
4. Batam
```

其中 Greater Jakarta 應該是第一優先，因為資料中心高度集中。

---

# 8. Malaysia 必須特別處理

Malaysia 的資料中心主要集中：

```text
Cyberjaya
Kuala Lumpur / Klang Valley
Johor / Iskandar Puteri
```

因此建議：

```text
MYS
│
├── Cyberjaya / Klang Valley
└── Johor / Iskandar Puteri
```

### Weather Analysis

如果只需要一個代表城市：

> **Kuala Lumpur / Cyberjaya**

如果研究 cooling / climate risk：

> **Kuala Lumpur + Johor**

---

# 9. Singapore 可以直接做單一城市

Singapore 的特性和 Australia / Indonesia 不同。

```text
SGP
└── Singapore
```

因為國家／城市高度集中。

因此不需要建立複雜的 city cluster。

### 建議保留

```text
Singapore
```

作為：

> **高密度、全年高溫高濕資料中心環境 benchmark**

---

# 10. Philippines 建議拆成 Metro Manila + 周邊

原始資料包含：

- Caloocan
- Metro Manila
- Cavite / General Trias
- Clark / Angeles
- Batangas

因此：

```text
PHL
│
├── Metro Manila
├── Cavite / General Trias
├── Clark / Angeles
└── Batangas
```

第一版可以簡化為：

```text
Metro Manila
```

第二版再加入：

```text
Clark
Cavite
Batangas
```

---

# 11. Brunei 是否值得保留？

如果你的目標純粹是：

> **資料中心市場規模**

可以排除。

但如果你的目標是：

> **天氣／氣候對資料中心的影響**

則 Brunei 有一定價值。

因為它可以提供：

```text
小型市場
+
熱帶
+
高濕
+
沿海
```

因此建議放在 Tier 2，而不是完全刪除。

---

# 12. New Zealand 是否值得保留？

New Zealand 是特殊案例。

原始資料沒有 Tier-level certification，但有：

```text
Hamilton
Auckland
Wellington
Christchurch
```

的 Datacom M&O facilities。

所以可以採用：

### Strict Tier Dataset

```text
排除 NZL
```

### Broader Data Center Dataset

```text
保留 NZL
```

建議你在後續資料表增加：

```text
Certification_Type
```

例如：

```text
Tier III
Tier IV
M&O
```

這樣就可以保留 NZ，而不會污染 Tier III/IV 樣本。

---

# 13. 最終推薦資料架構

如果要跟你前面的 Africa / South America 保持一致，我建議：

```text
Oceania & South-West Pacific
│
├── Tier 1 — Core Countries
│   ├── AUS — Australia
│   ├── IDN — Indonesia
│   ├── MYS — Malaysia
│   ├── SGP — Singapore
│   └── PHL — Philippines
│
├── Tier 2 — Secondary
│   └── BRN — Brunei
│
├── Special Case
│   └── NZL — New Zealand
│       └── M&O only
│
└── Not enough award data
    ├── PNG — Papua New Guinea
    └── FJI — Fiji
```

---

# 14. 如果全部區域要統一標準

目前你已經有：

### South America

**核心 5 國**

```text
BRA CHL COL PER ECU
```

### Africa

**核心 6 國**

```text
ZAF EGY NGA MAR KEN ETH
```

### Oceania

**核心 5 國**

```text
AUS IDN MYS SGP PHL
```

因此後續可以統一：

```text
Region
  ↓
Core Country
  ↓
Data Center Cluster
  ↓
City
  ↓
Weather Station
  ↓
TMY / EPW
  ↓
Weather Metrics
  ↓
Data Center Climate Score
```

這會比直接對所有國家做 weather data 更有效率。

---

# 15. 最終結論

### 第一版建議直接做 5 國

```text
AUS — Australia
IDN — Indonesia
MYS — Malaysia
SGP — Singapore
PHL — Philippines
```

### 如果想增加一個氣候對照

加入：

```text
BRN — Brunei
```

### New Zealand

```text
NZL — Special Case / M&O
```

不要直接當成「沒有資料中心」。

### 暫時排除

```text
PNG — Papua New Guinea
FJI — Fiji
```

標記為：

```text
Not enough Uptime award data
```

---

## 16. 下一步

Oceania 和前面的 Africa、South America 一樣，下一步最適合直接做：

```text
Country
→ Data Center City / Cluster
→ Weather Station
→ TMY / EPW
→ Temperature
→ Relative Humidity
→ Dew Point
→ Rainfall
→ Wind
→ Extreme Temperature
→ Data Center Weather Score
```

其中 **Australia、Indonesia 要特別標記為「原始 Uptime 清單不完整」**，避免後面拿 facility count 做跨國排名時產生誤導。
