/**
 * device_catalog_builtin.js — 自動產生檔案，勿手動編輯
 * 由 device_catalog/build_builtin.js 從 device_catalog/*.json 內嵌產生。
 * 用途：當頁面以 file:// 協議開啟（直接雙擊 index.html）時，CatalogManager
 * 無法用 fetch() 讀取 device_catalog/ 底下的 JSON 檔案（瀏覽器 CORS 限制），
 * 此檔案把相同內容內嵌為 JS 物件，改用 <script> 標籤載入即可繞過限制。
 * 產生時間：2026-09-01T00:46:42.043Z
 * 若修改了 device_catalog/*.json，請重新執行：node device_catalog/build_builtin.js
 */
window.DEVICE_CATALOG_BUILTIN_RAW = {
  "chiller": [
    {
      "_meta": {
        "vendor": "Trane Technologies",
        "vendor_website": "https://www.trane.com",
        "category": "chiller",
        "schema_version": "1.1",
        "last_updated": "2026-06",
        "note": "以下資料基於 Trane 公開規格書及 AHRI 認證數據庫。請提供原廠規格書給 AI 核對 _ai_confidence < 0.9 的型號。"
      },
      "Trane RTWD 1500kW": {
        "model": "Trane RTWD 1500kW",
        "vendor": "Trane Technologies",
        "chiller_type": "water_cooled",
        "category": "Screw Chiller",
        "cooling_capacity_kw": 1500,
        "cop_design": 6.5,
        "iplv": 8.2,
        "power_input_kw": 230.8,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "screw_standard"
        },
        "compressor_stages": 2,
        "weight_kg": 6200,
        "footprint_m2": 5.8,
        "min_plr": 0.1,
        "notes": "雙螺旋壓縮機，R-134a，適用大型冷機房，Trane IntelliPak 控制",
        "_source": "Trane Product Data PD 01-RTWD",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Trane RTWD 1000kW": {
        "model": "Trane RTWD 1000kW",
        "vendor": "Trane Technologies",
        "chiller_type": "water_cooled",
        "category": "Screw Chiller",
        "cooling_capacity_kw": 1000,
        "cop_design": 6.3,
        "iplv": 7.8,
        "power_input_kw": 158.7,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "screw_standard"
        },
        "weight_kg": 4500,
        "notes": "中型螺旋冷機，適用 3-8 MW 資料中心",
        "_source": "Trane Product Data PD 01-RTWD",
        "_ai_confidence": 0.8,
        "_verified": false
      },
      "Trane CTV 2000kW": {
        "model": "Trane CTV 2000kW",
        "vendor": "Trane Technologies",
        "chiller_type": "water_cooled",
        "category": "Centrifugal Chiller",
        "cooling_capacity_kw": 2000,
        "cop_design": 6.8,
        "iplv": 9.5,
        "power_input_kw": 294.1,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_standard"
        },
        "compressor_stages": 1,
        "weight_kg": 9500,
        "notes": "單級離心，AHRI 認證，適用大型園區",
        "_source": "Trane Product Data PD-CTV",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Trane Turbocor TC 700kW": {
        "model": "Trane Turbocor TC 700kW",
        "vendor": "Trane Technologies",
        "chiller_type": "water_cooled",
        "category": "Centrifugal Chiller (Magnetic Bearing)",
        "cooling_capacity_kw": 700,
        "cop_design": 8.3,
        "iplv": 14,
        "power_input_kw": 84.3,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_higheff"
        },
        "compressor_stages": 2,
        "weight_kg": 1600,
        "footprint_m2": 2.1,
        "min_plr": 0.1,
        "notes": "磁浮無油壓縮機，低 PLR 效率佳，噪音低，可模組化堆疊",
        "_source": "Trane Turbocor TC Series Data",
        "_ai_confidence": 0.88,
        "_verified": false
      },
      "Trane CGAF 800kW": {
        "model": "Trane CGAF 800kW",
        "vendor": "Trane Technologies",
        "chiller_type": "air_cooled",
        "category": "Screw Chiller (Air-Cooled)",
        "cooling_capacity_kw": 800,
        "cop_design": 3,
        "iplv": 4.1,
        "power_input_kw": 266.7,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 6800,
        "notes": "氣冷螺旋，不需冷卻水塔，快速部署，COP 隨環境溫度下降",
        "_source": "Trane Agility CGAF Product Data",
        "_ai_confidence": 0.8,
        "_verified": false
      }
    },
    {
      "_meta": {
        "vendor": "Johnson Controls (York)",
        "vendor_website": "https://www.johnsoncontrols.com",
        "category": "chiller",
        "schema_version": "1.1",
        "last_updated": "2026-06",
        "note": "以下資料基於 York/JCI 公開規格書。YVFA 系列為磁浮變頻離心，IPLV 特別高，請提供規格書核對。"
      },
      "York YT 2500kW": {
        "model": "York YT 2500kW",
        "vendor": "Johnson Controls (York)",
        "chiller_type": "water_cooled",
        "category": "Centrifugal Chiller",
        "cooling_capacity_kw": 2500,
        "cop_design": 7,
        "iplv": 9.8,
        "power_input_kw": 357.1,
        "refrigerant": "R-514A",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_standard"
        },
        "compressor_stages": 2,
        "weight_kg": 11200,
        "notes": "磁浮離心，HFO 冷媒 R-514A，低 GWP，大型園區主力機種",
        "_source": "York YT Chiller Product Guide YK-PG-1",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "York YVFA 1200kW": {
        "model": "York YVFA 1200kW",
        "vendor": "Johnson Controls (York)",
        "chiller_type": "water_cooled",
        "category": "Centrifugal Chiller (Variable Speed)",
        "cooling_capacity_kw": 1200,
        "cop_design": 7.8,
        "iplv": 12.5,
        "power_input_kw": 153.8,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_higheff"
        },
        "compressor_stages": 2,
        "weight_kg": 4800,
        "min_plr": 0.1,
        "notes": "變頻磁浮離心，IPLV 超高效，適合負載多變的資料中心",
        "_source": "York YVFA Product Guide Form 160.00-EG1",
        "_ai_confidence": 0.88,
        "_verified": false
      },
      "York YVAA 1050kW": {
        "model": "York YVAA 1050kW",
        "vendor": "Johnson Controls (York)",
        "chiller_type": "air_cooled",
        "category": "VSD Screw Chiller (Air-Cooled)",
        "cooling_capacity_kw": 1050,
        "cop_design": 3.15,
        "iplv": 4.5,
        "power_input_kw": 333.3,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 8200,
        "notes": "氣冷變頻螺旋，VSD 壓縮機，快速部署，WUE=0",
        "_source": "York YVAA Product Guide",
        "_ai_confidence": 0.78,
        "_verified": false
      },
      "York YVAA 600kW": {
        "model": "York YVAA 600kW",
        "vendor": "Johnson Controls (York)",
        "chiller_type": "air_cooled",
        "category": "VSD Screw Chiller (Air-Cooled)",
        "cooling_capacity_kw": 600,
        "cop_design": 3.1,
        "iplv": 4.3,
        "power_input_kw": 193.5,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 5100,
        "notes": "中型氣冷變頻螺旋，模組化部署",
        "_source": "York YVAA Product Guide",
        "_ai_confidence": 0.78,
        "_verified": false
      }
    },
    {
      "_meta": {
        "vendor": "Carrier",
        "vendor_website": "https://www.carrier.com",
        "category": "chiller",
        "schema_version": "1.1",
        "last_updated": "2026-06",
        "note": "Carrier 30XA 為氣冷螺旋系列。19XR / PUREtec 為水冷離心。請提供規格書核對 _ai_confidence < 0.9 的型號。"
      },
      "Carrier 19XR 1800kW": {
        "model": "Carrier 19XR 1800kW",
        "vendor": "Carrier",
        "chiller_type": "water_cooled",
        "category": "Centrifugal Chiller",
        "cooling_capacity_kw": 1800,
        "cop_design": 6.7,
        "iplv": 9.2,
        "power_input_kw": 268.7,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_standard"
        },
        "compressor_stages": 2,
        "weight_kg": 8100,
        "notes": "雙級離心，市占率高，維護便利",
        "_source": "Carrier 19XR Product Data PD-01",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Carrier AquaEdge 19DV 1400kW": {
        "model": "Carrier AquaEdge 19DV 1400kW",
        "vendor": "Carrier",
        "chiller_type": "water_cooled",
        "category": "Centrifugal Chiller (Magnetic Bearing)",
        "cooling_capacity_kw": 1400,
        "cop_design": 8,
        "iplv": 13.5,
        "power_input_kw": 175,
        "refrigerant": "R-1234ze(E)",
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_higheff"
        },
        "compressor_stages": 2,
        "weight_kg": 3200,
        "notes": "磁浮無油雙級離心，HFO 低 GWP 冷媒，極高 IPLV，適合 ESG 資料中心",
        "_source": "Carrier 19DV AquaEdge Product Data",
        "_ai_confidence": 0.82,
        "_verified": false
      },
      "Carrier 30XA 1000kW": {
        "model": "Carrier 30XA 1000kW",
        "vendor": "Carrier",
        "chiller_type": "air_cooled",
        "category": "Screw Chiller (Air-Cooled)",
        "cooling_capacity_kw": 1000,
        "cop_design": 3.8,
        "iplv": 5.2,
        "power_input_kw": 263.2,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 4200,
        "notes": "大型氣冷螺旋，不需冷卻水塔，快速部署首選",
        "_source": "Carrier 30XA Product Data",
        "_ai_confidence": 0.8,
        "_verified": false
      },
      "Carrier 30XA 400kW": {
        "model": "Carrier 30XA 400kW",
        "vendor": "Carrier",
        "chiller_type": "air_cooled",
        "category": "Screw Chiller (Air-Cooled)",
        "cooling_capacity_kw": 400,
        "cop_design": 2.9,
        "iplv": 4,
        "power_input_kw": 137.9,
        "refrigerant": "R-134a",
        "t_chws_c": 7,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 2200,
        "notes": "中型氣冷螺旋，適用邊緣資料中心",
        "_source": "Carrier 30XA Product Data",
        "_ai_confidence": 0.78,
        "_verified": false
      }
    },
    {
      "_meta": {
        "vendor": "Vertiv",
        "vendor_website": "https://www.vertiv.com",
        "category": "chiller",
        "schema_version": "1.1",
        "last_updated": "2026-08-28",
        "note": "資料來源：使用者提供之 Vertiv 官方型錄 PDF「[Vertiv] CoolLoop 風冷磁懸浮冷水機組 [產品型錄彩頁 2025].pdf」，容量/功率為型錄實際列表數值，非AI推估。cop_curve 因型錄未提供 AHRI 雙二次曲線係數（僅提供單點滿載功率），暫用 fixed，待有完整多工況性能表後補上 ahri_biquadratic。CHWS 測試工況原文標示不完整（僅見「冷冻水进出水-/15℃」），暫填 9.0°C 並於 notes 註明存疑，實際設計請以廠商正式選型軟體核對。"
      },
      "Vertiv CoolLoop CM4035SGHC003 350kW": {
        "model": "Vertiv CoolLoop CM4035SGHC003 350kW",
        "vendor": "Vertiv",
        "chiller_type": "air_cooled",
        "category": "Magnetic Bearing Centrifugal Chiller (Air-Cooled, Oil-Free)",
        "cooling_capacity_kw": 350,
        "cop_design": 3.26,
        "iplv": null,
        "power_input_kw": 107.2,
        "refrigerant": "R134a",
        "t_chws_c": 9,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 3886,
        "min_plr": 0.1,
        "notes": "無油磁懸浮壓縮機，型錄僅標稱滿載最大運行功率（107.2kW），cop_design 由 350/107.2 反推；IPLV/CHWS測試工況型錄未完整標示，僅供概估選型參考，正式設計需向廠商索取完整性能曲線",
        "_source": "[Vertiv] CoolLoop 風冷磁懸浮冷水機組 [產品型錄彩頁 2025].pdf p.9",
        "_ai_confidence": 0.9,
        "_verified": false
      },
      "Vertiv CoolLoop CM4045SGHC003 450kW": {
        "model": "Vertiv CoolLoop CM4045SGHC003 450kW",
        "vendor": "Vertiv",
        "chiller_type": "air_cooled",
        "category": "Magnetic Bearing Centrifugal Chiller (Air-Cooled, Oil-Free)",
        "cooling_capacity_kw": 450,
        "cop_design": 2.94,
        "iplv": null,
        "power_input_kw": 153.3,
        "refrigerant": "R134a",
        "t_chws_c": 9,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 4534,
        "min_plr": 0.1,
        "notes": "同系列，見 350kW 機型備註",
        "_source": "[Vertiv] CoolLoop 風冷磁懸浮冷水機組 [產品型錄彩頁 2025].pdf p.9",
        "_ai_confidence": 0.9,
        "_verified": false
      },
      "Vertiv CoolLoop CM4070SGHC003 700kW": {
        "model": "Vertiv CoolLoop CM4070SGHC003 700kW",
        "vendor": "Vertiv",
        "chiller_type": "air_cooled",
        "category": "Magnetic Bearing Centrifugal Chiller (Air-Cooled, Oil-Free)",
        "cooling_capacity_kw": 700,
        "cop_design": 3.27,
        "iplv": null,
        "power_input_kw": 214.3,
        "refrigerant": "R134a",
        "t_chws_c": 9,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 7170,
        "min_plr": 0.1,
        "notes": "同系列，見 350kW 機型備註",
        "_source": "[Vertiv] CoolLoop 風冷磁懸浮冷水機組 [產品型錄彩頁 2025].pdf p.9",
        "_ai_confidence": 0.9,
        "_verified": false
      },
      "Vertiv CoolLoop CM4100SGHC003 1000kW": {
        "model": "Vertiv CoolLoop CM4100SGHC003 1000kW",
        "vendor": "Vertiv",
        "chiller_type": "air_cooled",
        "category": "Magnetic Bearing Centrifugal Chiller (Air-Cooled, Oil-Free)",
        "cooling_capacity_kw": 1000,
        "cop_design": 3.15,
        "iplv": null,
        "power_input_kw": 317.6,
        "refrigerant": "R134a",
        "t_chws_c": 9,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 9733,
        "min_plr": 0.1,
        "notes": "同系列，見 350kW 機型備註",
        "_source": "[Vertiv] CoolLoop 風冷磁懸浮冷水機組 [產品型錄彩頁 2025].pdf p.10",
        "_ai_confidence": 0.9,
        "_verified": false
      },
      "Vertiv CoolLoop CM4150SGHC003 1500kW": {
        "model": "Vertiv CoolLoop CM4150SGHC003 1500kW",
        "vendor": "Vertiv",
        "chiller_type": "air_cooled",
        "category": "Magnetic Bearing Centrifugal Chiller (Air-Cooled, Oil-Free)",
        "cooling_capacity_kw": 1500,
        "cop_design": 3.26,
        "iplv": null,
        "power_input_kw": 459.9,
        "refrigerant": "R134a",
        "t_chws_c": 9,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 12436,
        "min_plr": 0.1,
        "notes": "同系列，見 350kW 機型備註。案場實例：海南某資料中心 IT負載1800kW/平均負載率75%，供回水12/18°C，600kW機型3+2配置，實測 GB-IPLV=4.6、CLF=0.20（見型錄p.6客戶案例，屬專案實測值非本機型獨立測試值，僅供部分負載效率量級參考）",
        "_source": "[Vertiv] CoolLoop 風冷磁懸浮冷水機組 [產品型錄彩頁 2025].pdf p.10",
        "_ai_confidence": 0.9,
        "_verified": false
      },
      "Vertiv CoolLoop CM4200SGHC003 2000kW": {
        "model": "Vertiv CoolLoop CM4200SGHC003 2000kW",
        "vendor": "Vertiv",
        "chiller_type": "air_cooled",
        "category": "Magnetic Bearing Centrifugal Chiller (Air-Cooled, Oil-Free)",
        "cooling_capacity_kw": 2000,
        "cop_design": 3.29,
        "iplv": null,
        "power_input_kw": 607.7,
        "refrigerant": "R134a",
        "t_chws_c": 9,
        "t_cewt_design_c": null,
        "cop_curve": {
          "type": "fixed"
        },
        "weight_kg": 15861,
        "min_plr": 0.1,
        "notes": "同系列，見 350kW 機型備註",
        "_source": "[Vertiv] CoolLoop 風冷磁懸浮冷水機組 [產品型錄彩頁 2025].pdf p.10",
        "_ai_confidence": 0.9,
        "_verified": false
      }
    },
    {
      "_meta": {
        "vendor": "Schneider Electric",
        "vendor_website": "https://www.se.com",
        "category": "chiller",
        "schema_version": "1.1",
        "last_updated": "2026-08-29",
        "note": "資料來源：使用者提供的官方技術規格書「[施耐德] Uniflair XCAC-XCAF 送風單元 [技術規格書 Spec].pdf」(06ME0136@00B0120)，真實工程數據非型錄泛用值。XCAC/XCAF為大型油磁浮/離心式氣冷式冰水主機，內建大型EC風扇牆式冷凝器陣列(故被使用者歸檔在「04_Fan_Wall」資料夾下)。XCAC=純氣冷、XCAF=內建自然冷卻(Free-Cooling)盤管版本(乙二醇20%)。取值條件：標準噪音版(Nominal Noise Version)、不含Economizer(經濟器)選配、R1234ze冷媒、工況30/20°C冰水進出/35°C外氣。原文件另有UltraLow Noise版本與含Economizer版本(容量/EER略有差異，Economizer版容量更高)，此處僅取代表性標準版本；原文明確標示R515B冷媒版本效能與R1234ze相差<2%。cop_curve 因型錄僅提供單點額定工況數據，暫用 fixed。"
      },
      "Uniflair XCAC1212A": {
        "model": "Uniflair XCAC1212A",
        "vendor": "Schneider Electric",
        "chiller_type": "air_cooled",
        "category": "Oil-Free Centrifugal Chiller (Air-Cooled)",
        "cooling_capacity_kw": 1295.97,
        "cop_design": 4.38,
        "iplv": null,
        "power_input_kw": 295.91,
        "refrigerant": "R1234ze",
        "t_chws_c": 20,
        "cop_curve": {
          "type": "fixed"
        },
        "water_flow_lh": 112070,
        "airflow_m3h": 398704,
        "notes": "標準噪音版、不含Economizer、工況30/20°C冰水/35°C外氣、0%乙二醇。EER(總輸入功率含壓縮機+風扇)=cooling_capacity/power_input=4.38",
        "_source": "[施耐德] Uniflair XCAC-XCAF 送風單元 [技術規格書 Spec].pdf p.71",
        "_ai_confidence": 0.95,
        "_verified": false
      },
      "Uniflair XCAC1913A": {
        "model": "Uniflair XCAC1913A",
        "vendor": "Schneider Electric",
        "chiller_type": "air_cooled",
        "category": "Oil-Free Centrifugal Chiller (Air-Cooled)",
        "cooling_capacity_kw": 1872.27,
        "cop_design": 4.29,
        "iplv": null,
        "power_input_kw": 436.59,
        "refrigerant": "R1234ze",
        "t_chws_c": 20,
        "cop_curve": {
          "type": "fixed"
        },
        "water_flow_lh": 161900,
        "airflow_m3h": 512024,
        "notes": "標準噪音版、不含Economizer、工況30/20°C冰水/35°C外氣、0%乙二醇",
        "_source": "[施耐德] Uniflair XCAC-XCAF 送風單元 [技術規格書 Spec].pdf p.71",
        "_ai_confidence": 0.95,
        "_verified": false
      },
      "Uniflair XCAC2524A": {
        "model": "Uniflair XCAC2524A",
        "vendor": "Schneider Electric",
        "chiller_type": "air_cooled",
        "category": "Oil-Free Centrifugal Chiller (Air-Cooled)",
        "cooling_capacity_kw": 2482.2,
        "cop_design": 4.24,
        "iplv": null,
        "power_input_kw": 585.2,
        "refrigerant": "R1234ze",
        "t_chws_c": 20,
        "cop_curve": {
          "type": "fixed"
        },
        "water_flow_lh": 214450,
        "airflow_m3h": 625900,
        "notes": "標準噪音版、不含Economizer、工況30/20°C冰水/35°C外氣、0%乙二醇",
        "_source": "[施耐德] Uniflair XCAC-XCAF 送風單元 [技術規格書 Spec].pdf p.71",
        "_ai_confidence": 0.95,
        "_verified": false
      },
      "Uniflair XCAF1212A": {
        "model": "Uniflair XCAF1212A (含自然冷卻盤管)",
        "vendor": "Schneider Electric",
        "chiller_type": "air_cooled",
        "category": "Oil-Free Centrifugal Chiller with Integrated Free-Cooling (Air-Cooled)",
        "cooling_capacity_kw": 1256.83,
        "cop_design": 4.18,
        "iplv": null,
        "power_input_kw": 300.55,
        "refrigerant": "R1234ze",
        "t_chws_c": 20,
        "cop_curve": {
          "type": "fixed"
        },
        "water_flow_lh": 113540,
        "airflow_m3h": 352455,
        "notes": "內建自然冷卻(free-cooling)盤管版本，乙二醇20%，故COP略低於純氣冷XCAC同容量段版(液側阻力較高)，換取冬季可切換自然冷卻運轉降低全年PUE。標準噪音版、不含Economizer、工況30/20°C冰水/35°C外氣",
        "partial_load_points": [
          {
            "load_pct": 79.6,
            "required_capacity_kw": 1000,
            "return_water_c": 35,
            "supply_water_setpoint_c": 25,
            "actual_supply_water_c": 24.98,
            "external_air_c": 35,
            "external_air_rh_pct": 30,
            "glycol_pct": 20,
            "operating_mode": "mechanical",
            "compressor_qty_active": 2,
            "compressor_power_kw": 121.44,
            "fan_power_kw": 41.07,
            "total_power_kw": 162.51,
            "eer": 6.15,
            "note": "使用者提供的Schneider官方UNICALC選型軟體(Uninet)真實專案選型報告，機械模式(非自然冷卻)、部分負載(1000/1257≈80%)。EER 6.15 明顯高於滿載額定表(30/20°C工況)的4.18，反映離心式壓縮機在部分負載時效率通常優於滿載(IGV/變頻調節)，此為與型錄額定值互補的真實部分負載錨點，未來若要擬合完整AHRI雙二次曲線可用此點校正。"
          }
        ],
        "_source": "[施耐德] Uniflair XCAC-XCAF 送風單元 [技術規格書 Spec].pdf p.72; partial_load_points來自[施耐德] Uniflair XCAF1212A 機房風牆_送風單元 [規格與選型書].pdf (Schneider Uninet選型軟體報告)",
        "_ai_confidence": 0.95,
        "_verified": false
      },
      "Uniflair XCAF1913A": {
        "model": "Uniflair XCAF1913A (含自然冷卻盤管)",
        "vendor": "Schneider Electric",
        "chiller_type": "air_cooled",
        "category": "Oil-Free Centrifugal Chiller with Integrated Free-Cooling (Air-Cooled)",
        "cooling_capacity_kw": 1805.67,
        "cop_design": 4.09,
        "iplv": null,
        "power_input_kw": 441.74,
        "refrigerant": "R1234ze",
        "t_chws_c": 20,
        "cop_curve": {
          "type": "fixed"
        },
        "water_flow_lh": 163120,
        "airflow_m3h": 452382,
        "notes": "內建自然冷卻盤管版本，乙二醇20%。標準噪音版、不含Economizer、工況30/20°C冰水/35°C外氣",
        "_source": "[施耐德] Uniflair XCAC-XCAF 送風單元 [技術規格書 Spec].pdf p.72",
        "_ai_confidence": 0.95,
        "_verified": false
      },
      "Uniflair XCAF2524A": {
        "model": "Uniflair XCAF2524A (含自然冷卻盤管)",
        "vendor": "Schneider Electric",
        "chiller_type": "air_cooled",
        "category": "Oil-Free Centrifugal Chiller with Integrated Free-Cooling (Air-Cooled)",
        "cooling_capacity_kw": 2387.7,
        "cop_design": 4.07,
        "iplv": null,
        "power_input_kw": 587.11,
        "refrigerant": "R1234ze",
        "t_chws_c": 20,
        "cop_curve": {
          "type": "fixed"
        },
        "water_flow_lh": 218550,
        "airflow_m3h": 553300,
        "notes": "內建自然冷卻盤管版本，乙二醇20%。標準噪音版、不含Economizer、工況30/20°C冰水/35°C外氣",
        "_source": "[施耐德] Uniflair XCAC-XCAF 送風單元 [技術規格書 Spec].pdf p.72",
        "_ai_confidence": 0.95,
        "_verified": false
      }
    },
    {
      "_meta": {
        "version": "1.0",
        "description": "冷水主機設備型錄 (AHRI 550/590 Biquadratic Curve)",
        "reference_conditions": {
          "T_chws_c": 7,
          "T_cewt_c": 30
        },
        "cop_curve_type": "ahri_biquadratic"
      },
      "Trane RTWD 1500kW": {
        "category": "Screw Chiller",
        "model": "Trane RTWD 1500kW",
        "vendor": "Trane",
        "cooling_capacity_kw": 1500,
        "cop_design": 6.5,
        "iplv": 8.2,
        "power_input_kw": 230.8,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "screw_standard"
        },
        "refrigerant": "R-134a",
        "weight_kg": 6200,
        "notes": "雙螺旋壓縮機，適用大型冷機房"
      },
      "Trane CTV 2000kW": {
        "category": "Centrifugal Chiller",
        "model": "Trane CTV 2000kW",
        "vendor": "Trane",
        "cooling_capacity_kw": 2000,
        "cop_design": 6.8,
        "iplv": 9.5,
        "power_input_kw": 294.1,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_standard"
        },
        "refrigerant": "R-134a",
        "weight_kg": 9500,
        "notes": "單級離心，AHRI 認證"
      },
      "Trane Turbocor TC 700kW": {
        "category": "Centrifugal Chiller (Magnetic Bearing)",
        "model": "Trane Turbocor TC 700kW",
        "vendor": "Trane",
        "cooling_capacity_kw": 700,
        "cop_design": 8.3,
        "iplv": 14,
        "power_input_kw": 84.3,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_higheff"
        },
        "refrigerant": "R-134a",
        "weight_kg": 1600,
        "notes": "磁浮無油壓縮機，低 PLR 效率佳"
      },
      "York YT 2500kW": {
        "category": "Centrifugal Chiller",
        "model": "York YT 2500kW",
        "vendor": "Johnson Controls (York)",
        "cooling_capacity_kw": 2500,
        "cop_design": 7,
        "iplv": 9.8,
        "power_input_kw": 357.1,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_standard"
        },
        "refrigerant": "R-514A",
        "weight_kg": 11200,
        "notes": "磁浮離心，HFO 冷媒"
      },
      "York YVFA 1200kW": {
        "category": "Centrifugal Chiller (Variable Speed)",
        "model": "York YVFA 1200kW",
        "vendor": "Johnson Controls (York)",
        "cooling_capacity_kw": 1200,
        "cop_design": 7.8,
        "iplv": 12.5,
        "power_input_kw": 153.8,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_higheff"
        },
        "refrigerant": "R-134a",
        "weight_kg": 4800,
        "notes": "變頻磁浮離心，IPLV 超高效"
      },
      "Carrier 19XR 1800kW": {
        "category": "Centrifugal Chiller",
        "model": "Carrier 19XR 1800kW",
        "vendor": "Carrier",
        "cooling_capacity_kw": 1800,
        "cop_design": 6.7,
        "iplv": 9.2,
        "power_input_kw": 268.7,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "centrifugal_standard"
        },
        "refrigerant": "R-134a",
        "weight_kg": 8100,
        "notes": "標準離心，市占率高"
      },
      "Carrier 30XA 1000kW": {
        "category": "Screw Chiller (Air-Cooled)",
        "model": "Carrier 30XA 1000kW",
        "vendor": "Carrier",
        "cooling_capacity_kw": 1000,
        "cop_design": 3.8,
        "iplv": 5.2,
        "power_input_kw": 263.2,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "screw_standard"
        },
        "refrigerant": "R-134a",
        "weight_kg": 4200,
        "notes": "氣冷螺旋，不需冷卻水塔"
      },
      "Daikin EWWD 800kW": {
        "category": "Screw Chiller",
        "model": "Daikin EWWD 800kW",
        "vendor": "Daikin",
        "cooling_capacity_kw": 800,
        "cop_design": 6.2,
        "iplv": 8,
        "power_input_kw": 129,
        "t_chws_c": 7,
        "t_cewt_design_c": 30,
        "cop_curve": {
          "type": "ahri_biquadratic",
          "preset": "screw_standard"
        },
        "refrigerant": "R-134a",
        "weight_kg": 3600,
        "notes": "雙螺旋，台灣常見型號"
      }
    }
  ],
  "cooling_tower": [
    {
      "_meta": {
        "vendor": "Baltimore Aircoil Company (BAC)",
        "vendor_website": "https://www.baltimoreaircoil.com",
        "category": "cooling_tower",
        "schema_version": "1.1",
        "last_updated": "2026-06",
        "note": "BAC VFL 系列為變流量節能開放式水塔。VXT 為密閉式。資料基於 BAC 公開型錄，請提供規格書核對。"
      },
      "BAC VFL-1200": {
        "model": "BAC VFL-1200",
        "vendor": "Baltimore Aircoil (BAC)",
        "tower_type": "open_tower",
        "heat_rejection_kw": 2000,
        "fan_kw_dx": 55,
        "fan_kw_fc": 22,
        "approach_design_c": 5,
        "flow_rate_m3h": 220,
        "weight_kg": 4800,
        "notes": "單格開放式，VFD 風機，適用中大型資料中心",
        "_source": "BAC VFL Product Catalog 2023",
        "_ai_confidence": 0.82,
        "_verified": false
      },
      "BAC VFL-1500": {
        "model": "BAC VFL-1500",
        "vendor": "Baltimore Aircoil (BAC)",
        "tower_type": "open_tower",
        "heat_rejection_kw": 2500,
        "fan_kw_dx": 75,
        "fan_kw_fc": 30,
        "approach_design_c": 5,
        "flow_rate_m3h": 275,
        "weight_kg": 5800,
        "notes": "高容量單格，適用大型資料中心 8 MW+ 園區",
        "_source": "BAC VFL Product Catalog 2023",
        "_ai_confidence": 0.82,
        "_verified": false
      },
      "BAC Closed CXV-1500": {
        "model": "BAC Closed CXV-1500",
        "vendor": "Baltimore Aircoil (BAC)",
        "tower_type": "closed_tower",
        "heat_rejection_kw": 1800,
        "fan_kw_dx": 55,
        "fan_kw_fc": 24,
        "approach_design_c": 7,
        "flow_rate_m3h": 180,
        "weight_kg": 6200,
        "notes": "密閉式冷卻，無水質汙染問題，適合要求水質的精密設備迴路",
        "_source": "BAC CXV Product Catalog",
        "_ai_confidence": 0.78,
        "_verified": false
      },
      "BAC FXV3-1426-28D-40": {
        "model": "BAC FXV3-1426-28D-40",
        "vendor": "Baltimore Aircoil (BAC)",
        "tower_type": "closed_tower",
        "heat_rejection_kw": 2888,
        "fan_kw_dx": 11.3,
        "fan_kw_fc": null,
        "approach_design_c": 4.7,
        "flow_rate_m3h": 138.2,
        "pump_kw": 11.19,
        "cycles_of_concentration": 7,
        "fluid_temp_in_c": 50,
        "fluid_temp_out_c": 32,
        "fluid_range_c": 18,
        "weight_kg": null,
        "notes": "資料來源：使用者提供的 BAC 官方選型軟體逐時性能數據導出表(xlsx)，非行銷型錄泛用值。該表僅列出案場氣象檔中最高濕球溫的前15個bin(WB 18.2~27.3°C，累計約8760小時中最熱的~0.03%~100%區間)，全程操作模式皆為'Wet'(濕式蒸發模式)，未涵蓋乾式/經濟器模式，故 fan_kw_fc 留白。fan_kw_dx 由設計點(WB27.3°C, 風扇轉速70.54%, 實際風機功率4.72kW)用 VFD affinity law 反推100%轉速額定值：4.72/(0.10+0.90*0.7054^3)≈11.3kW。此為特定專案選型(熱水50/32°C高溫迴路，非標準12/18°C CHW)，容量/風機功率僅適用於相同工況，不同工況需求要重新選型，不可直接套用其他溫度條件案場",
        "_source": "[BAC] FXV3-1426-28D-40 閉式冷卻塔 [性能數據導出表].xlsx",
        "_ai_confidence": 0.75,
        "_verified": false
      }
    },
    {
      "_meta": {
        "vendor": "Güntner GmbH & Co. KG",
        "vendor_website": "https://www.guentner.eu",
        "category": "cooling_tower",
        "schema_version": "1.1",
        "last_updated": "2026-06",
        "note": "Güntner DCS 系列為高效乾冷器，適用氣冷架構。無水耗，依乾球溫度換熱。"
      },
      "Güntner DCS 2000kW": {
        "model": "Güntner DCS 2000kW",
        "vendor": "Güntner",
        "tower_type": "dry_cooler",
        "heat_rejection_kw": 2000,
        "fan_kw_dx": 60,
        "fan_kw_fc": 22,
        "approach_design_c": 8,
        "flow_rate_m3h": 160,
        "weight_kg": 3200,
        "notes": "大型乾冷器，WUE≈0，適合模組化氣冷資料中心；換熱能力依乾球溫度，台灣夏季效益有限",
        "_source": "Güntner DCS Product Datasheet GPC 6200",
        "_ai_confidence": 0.8,
        "_verified": false
      },
      "Güntner DCS 3000kW": {
        "model": "Güntner DCS 3000kW",
        "vendor": "Güntner",
        "tower_type": "dry_cooler",
        "heat_rejection_kw": 3000,
        "fan_kw_dx": 85,
        "fan_kw_fc": 32,
        "approach_design_c": 8,
        "flow_rate_m3h": 240,
        "weight_kg": 4500,
        "notes": "超大型乾冷器，適合 >10 MW 規模氣冷園區",
        "_source": "Güntner DCS Product Datasheet GPC 6200",
        "_ai_confidence": 0.78,
        "_verified": false
      },
      "Güntner DCS 1200kW": {
        "model": "Güntner DCS 1200kW",
        "vendor": "Güntner",
        "tower_type": "dry_cooler",
        "heat_rejection_kw": 1200,
        "fan_kw_dx": 38,
        "fan_kw_fc": 14,
        "approach_design_c": 8,
        "flow_rate_m3h": 96,
        "weight_kg": 2100,
        "notes": "中型乾冷器，單元化設計，可並聯擴充",
        "_source": "Güntner DCS Product Datasheet",
        "_ai_confidence": 0.78,
        "_verified": false
      }
    }
  ],
  "dry_cooler": [
    {
      "_meta": {
        "version": "1.0",
        "description": "Dry Cooler Catalog",
        "last_updated": "2026-08"
      },
      "guntner_raised_bed_6000kw": {
        "category": "dry_cooler",
        "model": "Güntner 6000kW Raised-Bed (DSX Standard)",
        "vendor": "Güntner",
        "heat_rejection_kw": 6000,
        "approach_temp_c": 5,
        "fan_kw_dx": 150,
        "fan_kw_fc": 55,
        "flow_rate_lpm": 8600,
        "notes": "NVIDIA DSX-V2 標準 6MW Raised-Bed 乾冷器模組"
      },
      "bac_trillium_6000kw": {
        "category": "dry_cooler",
        "model": "BAC Trillium 6000kW Raised-Bed (DSX)",
        "vendor": "BAC",
        "heat_rejection_kw": 6000,
        "approach_temp_c": 5,
        "fan_kw_dx": 145,
        "fan_kw_fc": 52,
        "flow_rate_lpm": 8600,
        "notes": "NVIDIA DSX-V2 標準 6MW 乾式閉迴路散熱單元"
      },
      "bac_trillium_tdfs1238n_c60et30b": {
        "category": "dry_cooler",
        "model": "BAC TrilliumSeries TDFS1238N-C60ET30B",
        "vendor": "BAC",
        "heat_rejection_kw": 2514.5,
        "approach_temp_c": 3.8,
        "fan_kw_dx": 89.48,
        "fan_kw_fc": null,
        "flow_rate_lpm": 3611,
        "weight_kg": 22187,
        "notes": "資料來源：使用者提供的 BAC 選型軟體(TrilliumSeries Selection v1.12.6)單點選型報告，真實工程數據非型錄泛用值。設計工況：水50→40°C(範圍10°C，非標準CHW，屬高溫製程/DLC迴路)、DB=36.2°C、單機4顆風扇合計22.37kW×4=89.48kW額定風機功率。approach_temp_c=離水溫40°C-DB36.2°C=3.8°C。fan_kw_fc(部分負載/低DB風扇功率)報告未提供，此份僅為單一設計點快照，非逐時性能表",
        "_source": "[BAC] TrilliumSeries 乾冷器 [選型計算彙總表].pdf",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "schneider_dsaf1200a": {
        "category": "dry_cooler",
        "model": "Schneider Uniflair DSAF1200A",
        "vendor": "Schneider Electric",
        "heat_rejection_kw": 1773.4,
        "approach_temp_c": 5,
        "fan_kw_dx": 46.6,
        "fan_kw_fc": null,
        "flow_rate_lpm": 1782,
        "weight_kg": 8570,
        "notes": "資料來源：使用者提供的 Schneider Electric UNICALC 選型軟體單點性能表，真實工程數據非型錄泛用值。設計工況：水50→35°C(範圍15°C)、DB=30°C、RH=50%、乙二醇20%。原文在此工況下風扇轉速僅83.1%即可達成需求(實際風機功率28.7kW)，fan_kw_dx為用VFD affinity law反推100%轉速額定值(28.7/(0.10+0.90*0.831^3)≈46.6kW)，非型錄額定值原文直接標示。EER(kW冷量/kW耗電)=61.77，純自然冷卻工況(無壓縮機、無耗水)。此為單一設計點快照，非逐時性能表，fan_kw_fc留白",
        "_source": "[施耐德] DSAF1200A 乾冷器 (35C-50C高水溫工況) [性能選型表].pdf",
        "_ai_confidence": 0.85,
        "_verified": false
      }
    }
  ],
  "cdu_xdu": [
    {
      "_meta": {
        "version": "1.0",
        "description": "液冷分配單元 CDU/XDU 型錄 (Cooling Distribution Unit / Heat Exchanger Distribution Unit)"
      },
      "Vertiv XDU 80kW": {
        "category": "XDU",
        "model": "Vertiv XDU 80kW",
        "vendor": "Vertiv",
        "cooling_capacity_kw": 80,
        "power_kw": 3.5,
        "flow_rate_lpm": 60,
        "secondary_supply_temp_c": 20,
        "primary_return_temp_c": 24,
        "pump_type": "redundant",
        "weight_kg": 180,
        "notes": "液冷機架群分配，次側 20-24°C，支援 AI GPU rack"
      },
      "Vertiv XDU 150kW": {
        "category": "XDU",
        "model": "Vertiv XDU 150kW",
        "vendor": "Vertiv",
        "cooling_capacity_kw": 150,
        "power_kw": 5.2,
        "flow_rate_lpm": 100,
        "secondary_supply_temp_c": 18,
        "primary_return_temp_c": 24,
        "pump_type": "redundant",
        "weight_kg": 240,
        "notes": "高容量 XDU，適用 NVIDIA H100/GB200 DGX 機架群"
      },
      "CoolIT CDU 100kW": {
        "category": "CDU",
        "model": "CoolIT CDU 100kW",
        "vendor": "CoolIT Systems",
        "cooling_capacity_kw": 100,
        "power_kw": 4.2,
        "flow_rate_lpm": 75,
        "secondary_supply_temp_c": 20,
        "primary_return_temp_c": 26,
        "pump_type": "redundant",
        "weight_kg": 160,
        "notes": "OCP 標準 CDU，業界廣泛採用"
      },
      "Airedale CoolTrap CDU 200kW": {
        "category": "CDU",
        "model": "Airedale CoolTrap CDU 200kW",
        "vendor": "Airedale",
        "cooling_capacity_kw": 200,
        "power_kw": 7.8,
        "flow_rate_lpm": 140,
        "secondary_supply_temp_c": 18,
        "primary_return_temp_c": 26,
        "pump_type": "N+1 redundant",
        "weight_kg": 320,
        "notes": "大型 CDU，支援多機架液冷環路"
      },
      "nVent CDU 60kW": {
        "category": "CDU",
        "model": "nVent CDU 60kW",
        "vendor": "nVent",
        "cooling_capacity_kw": 60,
        "power_kw": 2.8,
        "flow_rate_lpm": 40,
        "secondary_supply_temp_c": 22,
        "primary_return_temp_c": 28,
        "pump_type": "single",
        "weight_kg": 110,
        "notes": "中型 CDU，適合 DLC 改裝機架"
      },
      "Schneider InRow 30kW": {
        "category": "CRAH-InRow",
        "model": "Schneider InRow 30kW",
        "vendor": "Schneider Electric",
        "cooling_capacity_kw": 30,
        "power_kw": 2.2,
        "flow_rate_lpm": 0,
        "notes": "機列空調，不含泵，使用冷凍水側接"
      },
      "Vertiv Liebert DSE 40kW": {
        "category": "CRAH-InRow",
        "model": "Vertiv Liebert DSE 40kW",
        "vendor": "Vertiv",
        "cooling_capacity_kw": 40,
        "power_kw": 2.8,
        "flow_rate_lpm": 0,
        "notes": "下送風冷凍水型 InRow，ECM 風機"
      },
      "Vertiv CoolChip CDU2300": {
        "category": "CDU",
        "model": "Vertiv CoolChip CDU2300",
        "vendor": "Vertiv",
        "cooling_capacity_kw": 2300,
        "power_kw": 47.8,
        "flow_rate_lpm": 3400,
        "pump_type": "dual pump (N+1)",
        "external_pressure_drop_bar": 3.2,
        "weight_kg": 1971,
        "dimensions_mm": {
          "width": 1200,
          "depth": 1200,
          "height": 2300
        },
        "primary_coolant": "water or water/glycol",
        "secondary_coolant": "water or water/glycol",
        "notes": "資料來源：使用者提供的 Vertiv 官方「CoolChip CDU2300 (2.3MW) 液冷CDU 安裝調試與維護手冊」(Installation, Commissioning and Maintenance Guide)，真實工程數據非型錄泛用值。2300kW=容量分類命名(2.3MW)，非單獨額定測試值；47.8kW為雙泵運轉模式下的最大耗電量(Table 4.6 Maximum power consumption)，換算EER概念值=2300/47.8≈48.1(純泵浦驅動之液對液熱交換，無壓縮機)。3400 lpm為雙泵運轉最大流量，對應外部管路壓降3.2 bar。電氣規格：400V±10% 50/60Hz，FLA 77.4A(with ATS)/76.7A(without ATS)，MCA 87A。操作重量1971kg含滿水重量。",
        "_source": "[Vertiv] CoolChip CDU2300 (2.3MW) 液冷CDU [安裝調試與維護手冊].pdf Table 4.1/4.5/4.6 (p.15-16)",
        "_ai_confidence": 0.95,
        "_verified": false
      }
    }
  ],
  "pump": [
    {
      "_meta": {
        "vendor": "Grundfos",
        "vendor_website": "https://www.grundfos.com",
        "category": "pump",
        "schema_version": "1.0",
        "last_updated": "2026-09-01",
        "note": "資料來源：Grundfos 官方產品中心資料，經授權經銷商 Lenntech 的個別型號規格頁面(逐一產品編號頁，非型錄總覽PDF)取得，每筆皆附來源URL。design_flow_m3h/design_head_m 為該型號原廠標示的額定工作點(rated duty point)，非型錄性能曲線範圍上下限。motor_efficiency_pct 是「馬達滿載效率」(IE2/IE3/IE4/IE5等級)，不是幫浦水力效率(wire-to-water efficiency)，兩者不可混用；原廠個別型號頁面均未提供幫浦水力效率數字，此欄位暫缺。TPE3系列查證後額定範圍僅到2.2kW/25m揚程，不適合本專案CDU/設施迴路5-90kW的選型範圍，故未收錄；CR系列僅收錄高段數前的低揚程款(CR 45-3)，45-9/45-12等高段數款揚程達185-250m遠超一般設施迴路需求，亦未收錄。"
      },
      "Grundfos CR 45-3 A-F-A-E-HQQE": {
        "model": "Grundfos CR 45-3 A-F-A-E-HQQE",
        "vendor": "Grundfos",
        "series": "CR (立式多節式)",
        "capKw": 11,
        "design_flow_m3h": 45,
        "design_head_m": 59.4,
        "motor_efficiency_pct": 91.2,
        "motor_efficiency_class": "IE2",
        "notes": "垂直多節泵，適合中低流量/中高揚程的二次側或設施供水迴路。",
        "_source": "https://www.lenntech.com/grundfos/CRFAM/96122801",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Grundfos NB 50-250/205 D-F2-A-E-BAQE": {
        "model": "Grundfos NB 50-250/205 D-F2-A-E-BAQE",
        "vendor": "Grundfos",
        "series": "NB (單節端吸式)",
        "capKw": 15,
        "design_flow_m3h": 70.7,
        "design_head_m": 47.3,
        "motor_efficiency_pct": 90.7,
        "motor_efficiency_class": "IE2",
        "notes": "端吸式泵，適合中等流量的一次側/冷凝水迴路。",
        "_source": "https://www.lenntech.com/grundfos/NB000/97836785",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Grundfos NB 125-315/290 AAF2AESBAQEQW3": {
        "model": "Grundfos NB 125-315/290 AAF2AESBAQEQW3",
        "vendor": "Grundfos",
        "series": "NB (單節端吸式)",
        "capKw": 22,
        "design_flow_m3h": 210.5,
        "design_head_m": 26,
        "motor_efficiency_pct": 93,
        "motor_efficiency_class": "IE3",
        "notes": "大流量低揚程款，適合流量需求高但管路壓損不大的設施迴路。",
        "_source": "https://www.lenntech.com/grundfos/NB000/98305288",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Grundfos NB 65-200/217 AAF2AESBAQERW1": {
        "model": "Grundfos NB 65-200/217 AAF2AESBAQERW1",
        "vendor": "Grundfos",
        "series": "NB (單節端吸式)",
        "capKw": 30,
        "design_flow_m3h": 117.9,
        "design_head_m": 60.64,
        "motor_efficiency_pct": 93.3,
        "motor_efficiency_class": "IE3",
        "notes": "中流量高揚程款，適合CDU/設施迴路壓損較大時的一次側循環泵。",
        "_source": "https://www.lenntech.com/grundfos/NB000/98341206",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Grundfos NB 65-250/269 AAF2AESBAQEUW1": {
        "model": "Grundfos NB 65-250/269 AAF2AESBAQEUW1",
        "vendor": "Grundfos",
        "series": "NB (單節端吸式)",
        "capKw": 55,
        "design_flow_m3h": 157.2,
        "design_head_m": 89.56,
        "motor_efficiency_pct": 94.3,
        "motor_efficiency_class": "IE3",
        "notes": "高揚程款(89.56m)，適合管路特別長或壓損特別高的大型設施主迴路，一般迴路可優先選NB 150-400/343。",
        "_source": "https://www.lenntech.com/grundfos/NB000/98341211",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Grundfos NB 150-400/343 AAF1AESBAQEUW3": {
        "model": "Grundfos NB 150-400/343 AAF1AESBAQEUW3",
        "vendor": "Grundfos",
        "series": "NB (單節端吸式)",
        "capKw": 55,
        "design_flow_m3h": 389.4,
        "design_head_m": 36.46,
        "motor_efficiency_pct": 94.6,
        "motor_efficiency_class": "IE3",
        "notes": "大流量款，適合大型CDU設施迴路或多台CDU共用的主幹管循環泵。",
        "_source": "https://www.lenntech.com/grundfos/NB000/98305331",
        "_ai_confidence": 0.85,
        "_verified": false
      },
      "Grundfos NB 150-315/336 AAF1AESBAQEVW3": {
        "model": "Grundfos NB 150-315/336 AAF1AESBAQEVW3",
        "vendor": "Grundfos",
        "series": "NB (單節端吸式)",
        "capKw": 75,
        "design_flow_m3h": 591.1,
        "design_head_m": 33.37,
        "motor_efficiency_pct": 96,
        "motor_efficiency_class": "IE4",
        "notes": "型錄收錄的最大流量款，適合大型AI算力中心主設施迴路。",
        "_source": "https://www.lenntech.com/grundfos/NB000/98305329",
        "_ai_confidence": 0.85,
        "_verified": false
      }
    }
  ],
  "crac_crah": [
    {
      "manufacturer": "Stulz",
      "category": "CRAH",
      "models": [
        {
          "model": "CyberAir 4 CFD 600 A",
          "capacityKw": 60,
          "airflowCfm": 7800,
          "fanPowerKw": 4.8,
          "chwInletTempC": 7,
          "chwDeltaTC": 5
        },
        {
          "model": "CyberAir 4 CFD 1000 A",
          "capacityKw": 100,
          "airflowCfm": 13000,
          "fanPowerKw": 7.5,
          "chwInletTempC": 7,
          "chwDeltaTC": 5
        },
        {
          "model": "CyberAir 4 CFD 1500 A",
          "capacityKw": 150,
          "airflowCfm": 19500,
          "fanPowerKw": 11.2,
          "chwInletTempC": 7,
          "chwDeltaTC": 6
        }
      ]
    },
    {
      "manufacturer": "Vertiv Liebert",
      "category": "CRAH",
      "models": [
        {
          "model": "Liebert PEX 4 CWH060",
          "capacityKw": 60,
          "airflowCfm": 8200,
          "fanPowerKw": 5.2,
          "chwInletTempC": 7,
          "chwDeltaTC": 5
        },
        {
          "model": "Liebert PEX 4 CWH100",
          "capacityKw": 100,
          "airflowCfm": 14000,
          "fanPowerKw": 8,
          "chwInletTempC": 7,
          "chwDeltaTC": 5
        },
        {
          "model": "Liebert PCW 150kW High DeltaT",
          "capacityKw": 150,
          "airflowCfm": 20000,
          "fanPowerKw": 10.8,
          "chwInletTempC": 10,
          "chwDeltaTC": 8
        },
        {
          "model": "Liebert CWA CA40",
          "capacityKw": 250,
          "airflowCfm": 27960,
          "fanPowerKw": 10.2,
          "chwInletTempC": 20,
          "chwDeltaTC": 12,
          "_source": "[Vertiv] Liebert CWA 冰水風牆機 [產品型錄彩頁].pdf p.6 (官方規格表)",
          "_ai_confidence": 0.95,
          "_verified": false
        },
        {
          "model": "Liebert CWA CA60",
          "capacityKw": 350,
          "airflowCfm": 64750,
          "fanPowerKw": 12.1,
          "chwInletTempC": 20,
          "chwDeltaTC": 12,
          "_source": "[Vertiv] Liebert CWA 冰水風牆機 [產品型錄彩頁].pdf p.6 (官方規格表)",
          "_ai_confidence": 0.95,
          "_verified": false
        },
        {
          "model": "Liebert CWA CA80",
          "capacityKw": 500,
          "airflowCfm": 88300,
          "fanPowerKw": 21.7,
          "chwInletTempC": 20,
          "chwDeltaTC": 12,
          "_source": "[Vertiv] Liebert CWA 冰水風牆機 [產品型錄彩頁].pdf p.6 (官方規格表)",
          "_ai_confidence": 0.95,
          "_verified": false
        }
      ]
    },
    {
      "manufacturer": "Schneider Electric",
      "category": "CRAH",
      "_note": "資料來源：使用者提供的官方技術規格書「[施耐德] Uniflair FWCV 冰水風牆機 [技術規格書 Spec].pdf」，真實工程數據非型錄泛用值。取值條件：Fan Type A、EU4濾網、0%乙二醇、EWT/LWT 20/30°C(高溫冰水設計，非標準7°C)。原文另有EU5濾網、Fan Type B、不同乙二醇濃度下的數據，風扇功率會因濾網/風機型式略有差異，此處取代表值。airflowM3h/netSensibleCapacityKw 兩欄補自「[施耐德] Uniflair FWCV (200-500kW) 冰水風牆機 [產品型錄彩頁].pdf」Performance data頁(使用者截圖確認)：RAT 37°C, 30%R.H., ESP 70Pa, EWT/LVT 20/30°C, EU4 filter 條件下之淨顯熱容量與風量，與capacityKw/airflowCfm為不同回風工況下的數值(airflowM3h經單位換算與airflowCfm完全吻合，確認為同一份原始風量數據)，兩者互補呈現同機型在不同RAT條件下的性能差異。_source見各機型。",
      "models": [
        {
          "model": "Uniflair FWCV36L1A",
          "capacityKw": 202.7,
          "airflowCfm": 29430,
          "airflowM3h": 50000,
          "netSensibleCapacityKw": 192,
          "fanPowerKw": 10.2,
          "chwInletTempC": 20,
          "chwDeltaTC": 10,
          "widthMm": 3600,
          "depthMm": 1600,
          "heightMm": 2000,
          "_source": "[施耐德] Uniflair FWCV 冰水風牆機 [技術規格書 Spec].pdf p.47; airflowM3h/netSensibleCapacityKw/dimensions 補自 [施耐德] Uniflair FWCV (200-500kW) 冰水風牆機 [產品型錄彩頁].pdf Performance data (RAT 37°C/30%RH/ESP70Pa/EWT-LVT 20/30°C/EU4)"
        },
        {
          "model": "Uniflair FWCV40L1A",
          "capacityKw": 252.9,
          "airflowCfm": 36788,
          "airflowM3h": 62500,
          "netSensibleCapacityKw": 237.5,
          "fanPowerKw": 15,
          "chwInletTempC": 20,
          "chwDeltaTC": 10,
          "widthMm": 4000,
          "depthMm": 1600,
          "heightMm": 2000,
          "_source": "[施耐德] Uniflair FWCV 冰水風牆機 [技術規格書 Spec].pdf p.49; airflowM3h/netSensibleCapacityKw/dimensions 補自 [施耐德] Uniflair FWCV (200-500kW) 冰水風牆機 [產品型錄彩頁].pdf Performance data"
        },
        {
          "model": "Uniflair FWCV36L2A",
          "capacityKw": 405.4,
          "airflowCfm": 58860,
          "airflowM3h": 100000,
          "netSensibleCapacityKw": 384,
          "fanPowerKw": 20.4,
          "chwInletTempC": 20,
          "chwDeltaTC": 10,
          "widthMm": 3600,
          "depthMm": 1600,
          "heightMm": 4000,
          "_source": "[施耐德] Uniflair FWCV 冰水風牆機 [技術規格書 Spec].pdf p.51; airflowM3h/netSensibleCapacityKw/dimensions 補自 [施耐德] Uniflair FWCV (200-500kW) 冰水風牆機 [產品型錄彩頁].pdf Performance data"
        },
        {
          "model": "Uniflair FWCV40L2A",
          "capacityKw": 505.8,
          "airflowCfm": 73575,
          "airflowM3h": 130000,
          "netSensibleCapacityKw": 475,
          "fanPowerKw": 30,
          "chwInletTempC": 20,
          "chwDeltaTC": 10,
          "widthMm": 4000,
          "depthMm": 1600,
          "heightMm": 4000,
          "_source": "[施耐德] Uniflair FWCV 冰水風牆機 [技術規格書 Spec].pdf p.53; airflowM3h/netSensibleCapacityKw/dimensions 補自 [施耐德] Uniflair FWCV (200-500kW) 冰水風牆機 [產品型錄彩頁].pdf Performance data"
        }
      ]
    }
  ],
  "fanwall": [
    {
      "manufacturer": "High-Density FanWall Corp",
      "category": "FanWall",
      "models": [
        {
          "model": "FanWall FW-150-EC (Network/AI Optim)",
          "capacityKw": 150,
          "airflowCfm": 22000,
          "fanPowerKw": 8.5,
          "chwInletTempC": 12,
          "chwDeltaTC": 8
        },
        {
          "model": "FanWall FW-200-EC (Ultra High Density)",
          "capacityKw": 200,
          "airflowCfm": 30000,
          "fanPowerKw": 12,
          "chwInletTempC": 12,
          "chwDeltaTC": 8
        },
        {
          "model": "FanWall FW-300-EC (Mega Modular)",
          "capacityKw": 300,
          "airflowCfm": 45000,
          "fanPowerKw": 18,
          "chwInletTempC": 14,
          "chwDeltaTC": 9
        }
      ]
    }
  ],
  "rdhx": [
    {
      "_meta": {
        "version": "1.0",
        "description": "背板式熱交換器 (Rear Door Heat Exchanger, RDHX) 設備型錄",
        "last_updated": "2026-08"
      },
      "Motivair ChilledDoor 45kW": {
        "category": "RDHX",
        "model": "Motivair ChilledDoor 45kW",
        "vendor": "Motivair",
        "cooling_capacity_kw": 45,
        "fan_power_kw": 0.9,
        "airflow_cfm": 4500,
        "chw_supply_temp_c": 12,
        "chw_delta_t_c": 6,
        "approach_temp_c": 4,
        "weight_kg": 140,
        "notes": "主動式 EC 風扇後門熱交換器，支援高密度 AI 機櫃 (45kW)"
      },
      "Vertiv Geist RDHX 60kW": {
        "category": "RDHX",
        "model": "Vertiv Geist RDHX 60kW (標準)",
        "vendor": "Vertiv",
        "cooling_capacity_kw": 60,
        "fan_power_kw": 1.2,
        "airflow_cfm": 6000,
        "chw_supply_temp_c": 12,
        "chw_delta_t_c": 6,
        "approach_temp_c": 4,
        "weight_kg": 175,
        "notes": "高效能高密度背板熱交換器，標準機房廣泛採用 (60kW)"
      },
      "Stulz CyberDoor RDHX 35kW": {
        "category": "RDHX",
        "model": "Stulz CyberDoor RDHX 35kW",
        "vendor": "Stulz",
        "cooling_capacity_kw": 35,
        "fan_power_kw": 0.65,
        "airflow_cfm": 3800,
        "chw_supply_temp_c": 14,
        "chw_delta_t_c": 6,
        "approach_temp_c": 4.5,
        "weight_kg": 120,
        "notes": "精準溫控後門熱交換單元，支援中密度混合機櫃 (35kW)"
      },
      "High-Density RDHX 80kW": {
        "category": "RDHX",
        "model": "High-Density RDHX 80kW MegaDoor",
        "vendor": "CoolIT / High-Density",
        "cooling_capacity_kw": 80,
        "fan_power_kw": 1.6,
        "airflow_cfm": 8000,
        "chw_supply_temp_c": 12,
        "chw_delta_t_c": 8,
        "approach_temp_c": 3.5,
        "weight_kg": 210,
        "notes": "超高密度 GPU 機櫃專用大型背板，支援高達 80kW 空調排熱"
      }
    }
  ]
};
