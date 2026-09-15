# South America Data Center — 國家天氣分析篩選版

> 目的：將南美洲資料中心國家從「全部納入」縮減成適合做**資料中心天氣／氣候分析**的國家清單。
>
> 基礎資料：使用目前提供的 `southamerica_tier3_datacenters.md`，來源為 Uptime Institute public awards database，資料存取時間為 2026-09。
>
> **重要限制：**原始資料只涵蓋正式取得 Uptime Institute Tier III/IV award 的設施；某國為 0 並不代表該國沒有 Tier III-equivalent 基礎設施。

---

## 1. 建議最終篩選

如果目標是做一份**可控規模、又能代表南美主要資料中心市場的天氣分析**，建議從原本 12 個國家縮減為：

### 第一級：核心分析國家（5 國）

| ISO3 | 國家 | 原始資料設施數 | 建議 | 主要原因 |
|---|---|---:|---|---|
| BRA | Brazil | 71 | **保留** | 南美最主要資料中心市場，設施數遠高於其他國家 |
| CHL | Chile | 25 | **保留** | 設施數高，且高度集中於 Santiago，適合做代表性氣候分析 |
| COL | Colombia | 24 | **保留** | 設施數高，主要集中 Bogotá，具明確資料中心氣候樣本 |
| PER | Peru | 18 | **保留** | 設施多數集中 Lima，天氣條件與冷卻分析很有代表性 |
| ECU | Ecuador | 10 | **保留** | 雖然數量較少，但已有多個 Tier III/IV 設施，且 Quito / Guayaquil 可形成不同氣候條件比較 |

**第一級 = 建議一定做。**

這 5 國合計約 **148 個設施紀錄**，已涵蓋原始清單絕大多數的資料中心樣本。

---

## 2. 第二級：次要分析國家（4 國）

| ISO3 | 國家 | 原始資料設施數 | 建議 | 主要原因 |
|---|---|---:|---|---|
| ARG | Argentina | 8 | **可保留** | Buenos Aires 有多個資料中心，但國家內樣本集中度高 |
| URY | Uruguay | 6 | **可保留** | Montevideo / Pando 集中，適合做小型市場比較 |
| PRY | Paraguay | 4 | **視篇幅保留** | 設施數少，但 Asunción / Villa Elisa 有 Tier III 設施 |
| BOL | Bolivia | 4 | **視篇幅保留** | La Paz 與 Santa Cruz 氣候差異明顯，若研究高海拔／熱帶差異則有價值 |

**第二級 = 如果研究需要完整度，再加入。**

---

## 3. 第三級：低優先國家（1 國）

| ISO3 | 國家 | 原始資料設施數 | 建議 | 原因 |
|---|---|---:|---|---|
| VEN | Venezuela | 3 | **低優先** | 有 Tier III 設施紀錄，但樣本量很小，對整體南美分析的邊際價值較低 |

**第三級 = 通常可以先排除，除非研究特別要求南美地理完整性。**

---

## 4. 排除清單

| ISO3 | 國家 | 原始資料狀態 | 建議 |
|---|---|---|---|
| GUY | Guyana | Zero on file | **排除** |
| SUR | Suriname | Zero on file | **排除** |

另外，原始資料指出：

- French Guiana：屬法國海外領地，原始資料未單獨列出。
- Falkland Islands：原始資料未單獨檢查。

因此本版不把上述地區當成獨立國家納入分析。

---

# 5. 最推薦的三種篩選方案

## A. 精簡版：5 國

適合：簡報、Dashboard、第一版研究。

```text
BRA Brazil
CHL Chile
COL Colombia
PER Peru
ECU Ecuador
```

### 優點
- 國家數少
- 資料中心樣本數高
- 容易做跨國比較
- 足以代表南美主要資料中心市場

**推薦程度：★★★★★**

---

## B. 標準版：9 國

適合：正式研究報告、完整度要求較高。

```text
BRA Brazil
CHL Chile
COL Colombia
PER Peru
ECU Ecuador
ARG Argentina
URY Uruguay
PRY Paraguay
BOL Bolivia
```

### 優點
- 保留主要市場 + 中型市場
- 可以比較不同氣候區
- 不會因納入所有國家而讓分析範圍失控

**推薦程度：★★★★☆**

---

## C. 完整版：10 國

```text
BRA Brazil
CHL Chile
COL Colombia
PER Peru
ECU Ecuador
ARG Argentina
URY Uruguay
PRY Paraguay
BOL Bolivia
VEN Venezuela
```

適合：需要「所有有 Tier III/IV award 紀錄國家」的研究。

但如果重點是**天氣分析，而不是資料中心市場盤點**，不建議一開始就使用這個版本。

**推薦程度：★★★☆☆**

---

# 6. 天氣分析時的進一步篩選邏輯

單純用「國家」來做天氣分析其實不夠精準，因為資料中心通常高度集中在少數城市。

因此建議採用：

> **Country → Data Center Cluster / City → Weather Station / TMY**

而不是：

> Country → 單一天氣資料

### 第一級國家建議的城市層級

| 國家 | 優先城市／區域 | 天氣分析策略 |
|---|---|---|
| Brazil | São Paulo metropolitan cluster | **不要只用 Brazil 平均氣候；優先分析 São Paulo / Campinas / Cotia / Hortolândia / Osasco / Barueri** |
| Chile | Santiago | 以 Santiago 為主，其他城市作補充 |
| Colombia | Bogotá | 以 Bogotá 為主，Cartagena / Cali / Medellín 作氣候對照 |
| Peru | Lima | 以 Lima 為主，Trujillo 作補充 |
| Ecuador | Quito + Guayaquil | 建議兩城市都保留，因為氣候條件不同 |

---

# 7. 為什麼 Brazil 要特別處理

Brazil 有 **71 個設施紀錄**，遠高於其他國家。

而且原始資料明確指出資料中心高度集中在：

- São Paulo state
- Campinas
- Cotia
- Hortolândia
- Osasco
- Barueri
- Rio de Janeiro
- Brasília
- Fortaleza
- Recife
- Belo Horizonte
- Curitiba
- Salvador

因此 Brazil 不適合直接用一個「Brazil Weather」代表全部資料中心。

### 建議 Brazil 再拆成 3 個分析群

**BRA-SP：São Paulo / Campinas cluster**

→ 最高優先

**BRA-RJ：Rio de Janeiro**

→ 第二優先

**BRA-Other：Brasília / Fortaleza / Recife / Belo Horizonte / Curitiba / Salvador 等**

→ 依研究需求取樣

---

# 8. 最終推薦的資料架構

如果你的後續目標是做 **Data Center Weather Analysis / Cooling Analysis / Climate Risk Analysis**，我建議直接採用以下架構：

```text
South America
│
├── Tier 1 — Core
│   ├── Brazil
│   │   ├── São Paulo Cluster
│   │   ├── Rio de Janeiro
│   │   └── Other major hubs
│   ├── Chile — Santiago
│   ├── Colombia — Bogotá
│   ├── Peru — Lima
│   └── Ecuador — Quito / Guayaquil
│
├── Tier 2 — Secondary
│   ├── Argentina — Buenos Aires
│   ├── Uruguay — Montevideo / Pando
│   ├── Paraguay — Asunción / Villa Elisa
│   └── Bolivia — La Paz / Santa Cruz
│
├── Tier 3 — Low Priority
│   └── Venezuela
│
└── Exclude
    ├── Guyana
    └── Suriname
```

---

# 9. 最終結論

### 如果你現在只是要「先把國家數量砍下來」

**直接用 5 國：**

```text
Brazil
Chile
Colombia
Peru
Ecuador
```

### 如果要做正式版本

**用 9 國：**

```text
Brazil
Chile
Colombia
Peru
Ecuador
Argentina
Uruguay
Paraguay
Bolivia
```

### 不建議第一版納入

```text
Venezuela
Guyana
Suriname
```

其中 Guyana / Suriname 是原始資料中的 **Zero on file**；Venezuela 則只有 3 個設施紀錄。這些國家不是「不存在資料中心」，而是依目前這份 Uptime Institute award 資料，樣本不足以成為優先分析對象。

---

## 10. 下一步建議

完成國家篩選後，下一步可以直接把 **9 國 → 城市 → TMY / 氣象站 → 溫度、濕度、降雨、風速、極端高溫 → Data Center Weather Score** 串起來。

這樣後續就不會再遇到「國家太多」的問題，而是以**資料中心實際分布**決定需要分析哪些天氣資料。
