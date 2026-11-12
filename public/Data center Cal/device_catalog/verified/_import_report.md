# 已核對型錄匯入報告

> 自動產生（2026-11-12），由 `device_catalog/tools/import_extracted.js` 產出，勿手改。

## 1. 匯入筆數

| 類別 | 檔案 | 筆數 |
|:--|:--|--:|
| chiller | `verified/chiller.json` | 72 |
| cooling_tower | `verified/cooling_tower.json` | 37 |
| dry_cooler | `verified/dry_cooler.json` | 8 |
| cdu | `verified/cdu_xdu.json` | 10 |
| crah | `verified/crah.json` | 23 |
| rdhx | `verified/rdhx.json` | 9 |
| **合計** | | **159** |

## 2. 未匯入（列在 `verified/_unmapped.json`）

| 原因 | 筆數 | 型號 |
|:--|--:|:--|
| 缺冷量或 COP／耗電 | 2 | BCWC0903、BCWC0903 ECONOMIZER |
| 選型報告是依「需求冷量 1000 kW」計算的運轉點（Maximum Cooling Capacity 欄空白），不是滿載額定；EER 6.15 屬部分負載值，當設計 COP 會偏樂觀 | 1 | XCAF1212A |
| 類型 adiabatic：絕熱（噴淋）工況容量，引擎目前沒有對應的型錄類別 | 9 | TRF-1026N-C80FD51E、TRF-1034N-C80FD68E、TRF-1034N-C60FT68E、TRF-1038N-C60FT77E、TRF-1038A-C80EQ9AE、TRF-1042A-C80EQ9AE、DSAF0800A (Adiabatic)、DSAF1000A (Adiabatic) … |
| 一次側為空氣（液對氣 CDU），不適用設施水系統架構 | 1 | RAA32-10U21 |
| 缺容量或耗電（文件未列 CDU 耗電） | 32 | MCDU-4U [工況1 (90F/113-149F PG25)]、MCDU-4U [工況2 (105.8F/113F PG25)]、MCDU-4U [工況3 (90F/112-122F PG25)]、MCDU-4U [工況4 (45F/60-84F 純水)]、MCDU-10 [工況1 (90F/113-149F PG25)]、MCDU-10 [工況2 (105.8F/113F PG25)]、MCDU-10 [工況3 (90F/112-122F PG25)]、MCDU-10 [工況4 (45F/60-84F 純水)] … |
| 缺冷量或風扇功率 | 25 | CyberWall 402020、CyberWall 402121、CyberWall 403030、CyberWall 403131、CyberWall 412020、CyberWall 412121、CyberWall 413030、CyberWall 413131 … |
| 直膨式（DX）機組，引擎目前沒有對應類別 | 23 | Liebert AHU FA130HD (Cond 1 (22°C/50%RH, SAT 13°C))、Liebert AHU FA130HD (Cond 2 (24°C/50%RH, SAT 14.9°C))、Liebert AHU FA130HD (Cond 3 (35°C/26%RH, SAT 22.9°C))、Liebert AHU FA130HD (Cond 4 (35°C/26%RH, SAT 24.0°C))、x-MEXT-i-G02-DX-U/O-029、x-MEXT-i-G02-DX-U/O-040、x-MEXT-i-G02-DX-U/O-051、x-MEXT-i-G02-DX-U/O-052 … |
| wcdx（直膨／水冷直膨）機組，引擎目前沒有對應類別 | 3 | x-MEXT-i-G02-DW-U 140、FA080HW (320kW) (水溫30-40°C)、FA080HW (320kW) (水溫35-45°C) |
| inrow_dx（直膨／水冷直膨）機組，引擎目前沒有對應類別 | 1 | Uniflair Direct Expansion InRow 300mm |
| 數值取自圖片，待使用者確認 | 4 | RDHX PRO 600 W Active、RDHX PRO 800 W Active、RDHX PRO 600 W Passive、RDHX PRO 800 W Passive |
| 泵目前只有 2 筆且待確認，暫不匯入 | 2 | NK 100-250/274 BA2F2LESBQQEOW3、NK 125-315/317 AA1F2AESBQQERW3 |

## 3. 換算值與 ⚠ 標記

- 含換算值（`_derived`）：39 筆
  - Vertiv CM4035SGHC003 [CHW 15/21°C, OA 35°C]：cop = 冷量 350 / 耗電 107.2（文件未直接列 COP）
  - Vertiv CM4045SGHC003 [CHW 15/21°C, OA 35°C]：cop = 冷量 450 / 耗電 153.3（文件未直接列 COP）
  - Vertiv CM4070SGHC003 [CHW 15/21°C, OA 35°C]：cop = 冷量 700 / 耗電 214.3（文件未直接列 COP）
  - Vertiv CM4100SGHC003 [CHW 15/21°C, OA 35°C]：cop = 冷量 1000 / 耗電 317.6（文件未直接列 COP）
  - Vertiv CM4150SGHC003 [CHW 15/21°C, OA 35°C]：cop = 冷量 1500 / 耗電 459.9（文件未直接列 COP）
  - Vertiv CM4200SGHC003 [CHW 15/21°C, OA 35°C]：cop = 冷量 2000 / 耗電 607.7（文件未直接列 COP）
  - King Sun KHAW-160F [CHW 10/15°C, OA 31.5°C]：cop = 冷量 474 / 耗電 147.1（文件未直接列 COP）
  - Liang Chi LCC-S-50 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 39 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-50-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 78 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-60 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 46.8 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-60-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 93.6 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-70 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 54.6 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-70-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 109.2 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-80 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 62.4 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-80-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 124.8 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-100 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 78 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-100-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 156 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-125 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 97.5 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-125-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 195 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-150 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 117 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-150-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 234 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-150-C3 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 351 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-150-C4 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 468 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-150-C5 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 585 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-175 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 136.5 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-175-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 273 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-175-C3 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 409.5 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-200 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 156 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-200-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 312 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-200-C3 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 468 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-225 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 175.5 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-225-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 351 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-225-C3 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 526.5 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-250 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 195 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-250-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 390 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-250-C3 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 585 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-300 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 234 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-300-C2 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 468 m³/h × ΔT 5 K（型錄只列流量）
  - Liang Chi LCC-S-300-C3 [37→32°C, WB 27°C]：單台排熱 = 1.163 × 流量 702 m³/h × ΔT 5 K（型錄只列流量）
- 帶 ⚠ 標記：1 筆
  - Schneider Electric InRow ACRC301H [CHW 15/21.6°C, RA 40.5°C]：⚠ 原廠表格流量與冷量不一致

## 4. 與既有型錄同型號比對

既有型錄檔不會被修改；下表只列出型號代碼相同的記錄，供判斷舊資料是否需要汰換。

| 類別 | 新（已核對） | 容量 kW | COP | 耗電/風扇 kW | 既有型號（檔案） | 容量 kW | COP | 耗電/風扇 kW |
|:--|:--|--:|--:|--:|:--|--:|--:|--:|
| 冰水主機 | Vertiv CM4035SGHC003 [CHW 15/21°C, OA 35°C] | 350 | 3.26 | 107.2 | Vertiv CoolLoop CM4035SGHC003 350kW（chiller/vertiv.json） | 350 | 3.26 | 107.2 |
| 冰水主機 | Vertiv CM4045SGHC003 [CHW 15/21°C, OA 35°C] | 450 | 2.94 | 153.3 | Vertiv CoolLoop CM4045SGHC003 450kW（chiller/vertiv.json） | 450 | 2.94 | 153.3 |
| 冰水主機 | Vertiv CM4070SGHC003 [CHW 15/21°C, OA 35°C] | 700 | 3.27 | 214.3 | Vertiv CoolLoop CM4070SGHC003 700kW（chiller/vertiv.json） | 700 | 3.27 | 214.3 |
| 冰水主機 | Vertiv CM4100SGHC003 [CHW 15/21°C, OA 35°C] | 1000 | 3.15 | 317.6 | Vertiv CoolLoop CM4100SGHC003 1000kW（chiller/vertiv.json） | 1000 | 3.15 | 317.6 |
| 冰水主機 | Vertiv CM4150SGHC003 [CHW 15/21°C, OA 35°C] | 1500 | 3.26 | 459.9 | Vertiv CoolLoop CM4150SGHC003 1500kW（chiller/vertiv.json） | 1500 | 3.26 | 459.9 |
| 冰水主機 | Vertiv CM4200SGHC003 [CHW 15/21°C, OA 35°C] | 2000 | 3.29 | 607.7 | Vertiv CoolLoop CM4200SGHC003 2000kW（chiller/vertiv.json） | 2000 | 3.29 | 607.7 |
| 冰水主機 | Schneider Electric XCAF1913A (PEP) [CHW 20/30°C, OA 35°C] | 1805 | 4.07 | 443.1 | Uniflair XCAF1913A (含自然冷卻盤管)（chiller/schneider.json） | 1805.67 | 4.09 | 441.74 |
| 冰水主機 | Schneider Electric XCAC1212A [CHW 20/30°C, OA 35°C] | 1295.97 | 4.38 | 295.91 | Uniflair XCAC1212A（chiller/schneider.json） | 1295.97 | 4.38 | 295.91 |
| 冰水主機 | Schneider Electric XCAC1913A [CHW 20/30°C, OA 35°C] | 1872.27 | 4.29 | 436.59 | Uniflair XCAC1913A（chiller/schneider.json） | 1872.27 | 4.29 | 436.59 |
| 冰水主機 | Schneider Electric XCAC2524A [CHW 20/30°C, OA 35°C] | 2482.2 | 4.24 | 585.2 | Uniflair XCAC2524A（chiller/schneider.json） | 2482.2 | 4.24 | 585.2 |
| 冰水主機 | Schneider Electric XCAC1212A (Economizer) [CHW 20/30°C, OA 35°C] | 1313.37 | 4.45 | 295.08 | Uniflair XCAC1212A（chiller/schneider.json） | 1295.97 | 4.38 | 295.91 |
| 冰水主機 | Schneider Electric XCAC1913A (Economizer) [CHW 20/30°C, OA 35°C] | 1912.36 | 4.41 | 434.09 | Uniflair XCAC1913A（chiller/schneider.json） | 1872.27 | 4.29 | 436.59 |
| 冰水主機 | Schneider Electric XCAC2524A (Economizer) [CHW 20/30°C, OA 35°C] | 2656.5 | 4.53 | 585.94 | Uniflair XCAC2524A（chiller/schneider.json） | 2482.2 | 4.24 | 585.2 |
| 冰水主機 | Schneider Electric XCAF1212A [CHW 20/30°C, OA 35°C] | 1256.83 | 4.18 | 300.55 | Uniflair XCAF1212A (含自然冷卻盤管)（chiller/schneider.json） | 1256.83 | 4.18 | 300.55 |
| 冰水主機 | Schneider Electric XCAF1913A [CHW 20/30°C, OA 35°C] | 1805.67 | 4.09 | 441.74 | Uniflair XCAF1913A (含自然冷卻盤管)（chiller/schneider.json） | 1805.67 | 4.09 | 441.74 |
| 冰水主機 | Schneider Electric XCAF2524A [CHW 20/30°C, OA 35°C] | 2387.7 | 4.07 | 587.11 | Uniflair XCAF2524A (含自然冷卻盤管)（chiller/schneider.json） | 2387.7 | 4.07 | 587.11 |
| 冰水主機 | Schneider Electric XCAF1212A (Economizer) [CHW 20/30°C, OA 35°C] | 1284.59 | 4.31 | 297.8 | Uniflair XCAF1212A (含自然冷卻盤管)（chiller/schneider.json） | 1256.83 | 4.18 | 300.55 |
| 冰水主機 | Schneider Electric XCAF1913A (Economizer) [CHW 20/30°C, OA 35°C] | 1867.13 | 4.22 | 442.1 | Uniflair XCAF1913A (含自然冷卻盤管)（chiller/schneider.json） | 1805.67 | 4.09 | 441.74 |
| 冰水主機 | Schneider Electric XCAF2524A (Economizer) [CHW 20/30°C, OA 35°C] | 2562 | 4.35 | 588.35 | Uniflair XCAF2524A (含自然冷卻盤管)（chiller/schneider.json） | 2387.7 | 4.07 | 587.11 |
| 冰水主機 | Schneider Electric XCAC1212A (UltraLow Noise) [CHW 20/30°C, OA 35°C] | 1242.12 | 4.45 | 279.17 | Uniflair XCAC1212A（chiller/schneider.json） | 1295.97 | 4.38 | 295.91 |
| 冰水主機 | Schneider Electric XCAC1913A (UltraLow Noise) [CHW 20/30°C, OA 35°C] | 1776.63 | 4.29 | 414.25 | Uniflair XCAC1913A（chiller/schneider.json） | 1872.27 | 4.29 | 436.59 |
| 冰水主機 | Schneider Electric XCAC2524A (UltraLow Noise) [CHW 20/30°C, OA 35°C] | 2341.5 | 4.24 | 552.89 | Uniflair XCAC2524A（chiller/schneider.json） | 2482.2 | 4.24 | 585.2 |
| 冰水主機 | Schneider Electric XCAC1212A (UltraLow Noise Economizer) [CHW 20/30°C, OA 35°C] | 1279.47 | 4.6 | 278.14 | Uniflair XCAC1212A（chiller/schneider.json） | 1295.97 | 4.38 | 295.91 |
| 冰水主機 | Schneider Electric XCAC1913A (UltraLow Noise Economizer) [CHW 20/30°C, OA 35°C] | 1851.09 | 4.44 | 417.36 | Uniflair XCAC1913A（chiller/schneider.json） | 1872.27 | 4.29 | 436.59 |
| 冰水主機 | Schneider Electric XCAC2524A (UltraLow Noise Economizer) [CHW 20/30°C, OA 35°C] | 2478 | 4.6 | 538.73 | Uniflair XCAC2524A（chiller/schneider.json） | 2482.2 | 4.24 | 585.2 |
| 冰水主機 | Schneider Electric XCAF1212A (UltraLow Noise) [CHW 20/30°C, OA 35°C] | 1193.04 | 4.25 | 280.96 | Uniflair XCAF1212A (含自然冷卻盤管)（chiller/schneider.json） | 1256.83 | 4.18 | 300.55 |
| 冰水主機 | Schneider Electric XCAF1913A (UltraLow Noise) [CHW 20/30°C, OA 35°C] | 1698.02 | 4.07 | 417.58 | Uniflair XCAF1913A (含自然冷卻盤管)（chiller/schneider.json） | 1805.67 | 4.09 | 441.74 |
| 冰水主機 | Schneider Electric XCAF2524A (UltraLow Noise) [CHW 20/30°C, OA 35°C] | 2194.5 | 4.08 | 537.98 | Uniflair XCAF2524A (含自然冷卻盤管)（chiller/schneider.json） | 2387.7 | 4.07 | 587.11 |
| 冰水主機 | Schneider Electric XCAF1212A (UltraLow Noise Economizer) [CHW 20/30°C, OA 35°C] | 1244.46 | 4.41 | 282.33 | Uniflair XCAF1212A (含自然冷卻盤管)（chiller/schneider.json） | 1256.83 | 4.18 | 300.55 |
| 冰水主機 | Schneider Electric XCAF1913A (UltraLow Noise Economizer) [CHW 20/30°C, OA 35°C] | 1790.24 | 4.26 | 419.91 | Uniflair XCAF1913A (含自然冷卻盤管)（chiller/schneider.json） | 1805.67 | 4.09 | 441.74 |
| 冰水主機 | Schneider Electric XCAF2524A (UltraLow Noise Economizer) [CHW 20/30°C, OA 35°C] | 2284.8 | 4.49 | 509.11 | Uniflair XCAF2524A (含自然冷卻盤管)（chiller/schneider.json） | 2387.7 | 4.07 | 587.11 |
| 冷卻水塔 | BAC FXV3-1426-24D-20 XE [45→35°C, WB 29.6°C] | 3002 | — | 15 | BAC FXV3-1426-24D-20 XE 6000kW (雙聯/2-Unit)（cooling_tower/bac.json） | 6004 | — | 30 |
| 冷卻水塔 | BAC FXV3-1426-24D-20 XE [45→35°C, WB 29.6°C] | 3002 | — | 15 | BAC FXV3-1426-24D-20 XE 3000kW (單格/1-Unit)（cooling_tower/bac.json） | 3002 | — | 15 |
| 冷卻水塔 | BAC FXV3-1426-28D-40 [50→32°C, WB 29°C] | 2888 | — | 30 | BAC FXV3-1426-28D-40（cooling_tower/bac.json） | 2888 | — | 11.3 |
| 乾冷器 | BAC TDFS1238N-C60ET30B [50→40°C, DB 36.2°C] | 2514.5 | — | 89.48 | BAC TrilliumSeries TDFS1238N-C60ET30B（dry_cooler.json） | 2514.5 | — | 89.48 |
| 乾冷器 | Schneider Electric DSAF1200A [50→35°C, DB 30°C, glycol 20%] | 1773.4 | — | 28.7 | Schneider Uniflair DSAF1200A（dry_cooler.json） | 1773.4 | — | 46.6 |
| 乾冷器 | Schneider Electric DSAF1200A (Dry) [32→20°C, DB 16°C, glycol 20%] | 1561 | — | 47.8 | Schneider Uniflair DSAF1200A（dry_cooler.json） | 1773.4 | — | 46.6 |
| CDU | Vertiv CoolChip CDU2300 | 2300 | — | 47.8 | Vertiv CoolChip CDU2300（cdu_xdu.json） | 2300 | — | 47.8 |
| 風牆/InRow | Schneider Electric Uniflair FWCV36L1* (Fan Type A, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 192.5 | — | 10.2 | Uniflair FWCV36L1A（crac_crah/schneider.json） | 202.7 | — | 10.2 |
| 風牆/InRow | Schneider Electric Uniflair FWCV36L1* (Fan Type B, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 192.5 | — | 9.7 | Uniflair FWCV36L1A（crac_crah/schneider.json） | 202.7 | — | 10.2 |
| 風牆/InRow | Schneider Electric Uniflair FWCV40L1* (Fan Type A, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 237.9 | — | 15 | Uniflair FWCV40L1A（crac_crah/schneider.json） | 252.9 | — | 15 |
| 風牆/InRow | Schneider Electric Uniflair FWCV40L1* (Fan Type B, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 237.9 | — | 14.5 | Uniflair FWCV40L1A（crac_crah/schneider.json） | 252.9 | — | 15 |
| 風牆/InRow | Schneider Electric Uniflair FWCV36L2* (Fan Type A, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 385 | — | 20.4 | Uniflair FWCV36L2A（crac_crah/schneider.json） | 405.4 | — | 20.4 |
| 風牆/InRow | Schneider Electric Uniflair FWCV36L2* (Fan Type B, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 384.9 | — | 19.4 | Uniflair FWCV36L2A（crac_crah/schneider.json） | 405.4 | — | 20.4 |
| 風牆/InRow | Schneider Electric Uniflair FWCV40L2* (Fan Type A, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 475.9 | — | 30 | Uniflair FWCV40L2A（crac_crah/schneider.json） | 505.8 | — | 30 |
| 風牆/InRow | Schneider Electric Uniflair FWCV40L2* (Fan Type B, Glycol 0%, EU4) [CHW 20/30°C, RA 37°C] | 475.9 | — | 29.1 | Uniflair FWCV40L2A（crac_crah/schneider.json） | 505.8 | — | 30 |

