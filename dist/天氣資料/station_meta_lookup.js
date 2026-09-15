const STATION_META = {
    // === ASIA (46) ===
    "TWN_NOR_Taipei-Songshan.AP.466960_TMYx.2011-2025": {
        cityZh: "台北 (Taipei)",
        datacenters: "中華電信板橋 IDC (CHT Banqiao), 是方電訊 LY2 (Chief Telecom), 遠傳內湖/板橋雲端運算中心, Vantage Data Centers TPE1, 台灣大哥大雲端機房"
    },
    "TWN_NOR_Taoyuan.589650_TMYx.2011-2025": {
        cityZh: "桃園 (Taoyuan)",
        datacenters: "中華電信桃園/冬山 IDC, 宏碁渴望智慧園區 (Acer eDC), 廣達電腦雲端中心, 緯穎科技伺服器驗證中心"
    },
    "TWN_NOR_Hsinchu.AP.467560_TMYx.2011-2025": {
        cityZh: "新竹 (Hsinchu)",
        datacenters: "國家高速網路與計算中心 (NCHC), 竹科半導體高速運算中心 (HPC), 聯發科技運算機房, 台積電超級運算機房"
    },
    "TWN_CNR_Taichung.591580_TMYx.2011-2025": {
        cityZh: "台中 (Taichung)",
        datacenters: "中華電信台中 IDC, 台中軟體園區雲端中心, 網擎資訊雲端機房, 國家智算中台灣節點"
    },
    "TWN_SOR_Kaohsiung.Intl.AP.467400_TMYx.2011-2025": {
        cityZh: "高雄 (Kaohsiung)",
        datacenters: "國網中心高雄亞灣超級運算中心, 鴻海高軟雲端運算中心, 中華電信亞灣 IDC, 亞灣5G AIoT創新園區"
    },
    "JPN_TK_Tokyo-Chiyoda.476620_TMYx.2011-2025": {
        cityZh: "東京 千代田 (Tokyo Downtown)",
        datacenters: "Equinix TY1~TY15, Colt Tokyo Data Centre, Digital Realty NRT, AWS Tokyo Region, NTT DATA Otemachi, Microsoft Azure East Japan"
    },
    "JPN_CH_Tokyo-Narita.Intl.AP.476860_TMYx.2011-2025": {
        cityZh: "千葉 印西/成田 (Chiba / Inzai)",
        datacenters: "Colt Inzai Data Centre Campus (1~4), AirTrunk TOK1/TOK2, MC Digital Realty Inzai, NTT Com Inzai, Goodman Business Park Chiba"
    },
    "JPN_OS_Osaka.Intl.AP.477710_TMYx.2011-2025": {
        cityZh: "大阪 (Osaka)",
        datacenters: "Equinix OS1~OS3, MC Digital Realty KIX1~KIX3, NTT Com Osaka 5, Colt Osaka Data Centre, AWS Osaka Region"
    },
    "KOR_SO_Seoul.WS.471080_TMYx.2011-2025": {
        cityZh: "首爾 (Seoul)",
        datacenters: "LG Uplus Pyeongchon Mega DC, SK Broadband Ilsan DC, KT Mokdong IDC, Equinix SL1/SL2, Digital Realty ICN10, AWS Seoul Region"
    },
    "KOR_PU_Busan-Gimhae.Intl.AP.471530_TMYx.2011-2025": {
        cityZh: "釜山 (Busan)",
        datacenters: "LG CNS Busan Cloud Center, KT Busan Submarine Cable Landing Station & IDC, BNK Financial Group Data Center"
    },
    "CHN_SH_Shanghai-Pudong.Intl.AP.583211_TMYx.2011-2025": {
        cityZh: "上海 浦東 (Shanghai Pudong)",
        datacenters: "萬國數據 GDS 外高橋/浦東園區, 世紀互聯 21Vianet, 阿里雲上海張江, 騰訊青浦雲計算中心, 騰龍上海機房"
    },
    "CHN_BJ_Beijing-Capital.Intl.AP.545110_TMYx.2011-2025": {
        cityZh: "北京 (Beijing)",
        datacenters: "萬國數據 GDS 北京亦莊, 世紀互聯酒仙橋, 百度亦莊雲計算中心, 阿里雲北京望京, 中國電信亦莊智算中心"
    },
    "CHN_GD_Shenzhen.594930_TMYx.2011-2025": {
        cityZh: "深圳 (Shenzhen)",
        datacenters: "騰訊深圳坪山/深汕雲計算園區, 萬國數據 GDS 深圳寶安, 華為觀瀾數據中心, 中國移動前海智算中心"
    },
    "HKG_HKI_Hong.Kong.Intl.AP.450070_TMYx.2011-2025": {
        cityZh: "香港 (Hong Kong)",
        datacenters: "新意網 SUNeVision MEGA Plus / MEGA-i, Equinix HK1~HK5, AirTrunk HKG1, Digital Realty HKG10, Vantage HKG1, NTT 將軍澳金融數據中心"
    },
    "SGP_SG_Singapore-Changi.Intl.AP.486980_TMYx.2011-2025": {
        cityZh: "新加坡 / 樟宜 (Singapore / Changi)",
        datacenters: "Equinix SG1~SG5, Singtel DC West (Tuas), STT GDC MediaHub, AirTrunk SGP1 (Loyang), Digital Realty Loyang/Jurong, Google Jurong, AWS Singapore"
    },
    "MYS_KL_Kuala.Lumpur.Intl.AP.486500_TMYx.2011-2025": {
        cityZh: "吉隆坡 / 賽城 (Kuala Lumpur / Cyberjaya)",
        datacenters: "NTT Cyberjaya (CBJ1~CBJ6), Bridge Data Centres Cyberjaya, Vantage Cyberjaya KUL1, AIMS Data Centre KL, TM ONE Cyberjaya"
    },
    "MYS_JH_Johor.AP.486790_TMYx.2011-2025": {
        cityZh: "柔佛 (Johor)",
        datacenters: "Bridge Data Centres (Sedenak MY03), YTL Green Data Center Park (Kulai), AirTrunk JHB1, GDS Nusajaya Tech Park Campus, Princeton Digital Group"
    },
    "IDN_JW_Jakarta-Soekarno-Hatta.Intl.AP.967490_TMYx.2011-2025": {
        cityZh: "雅加達 (Greater Jakarta)",
        datacenters: "Equinix (JK1), BDx Indonesia (CGK), NTT Jakarta 3 (Cikarang), DCI Indonesia (H1/H2 Cibitung), STT GDC Jakarta 1, Princeton Digital Group"
    },
    "IDN_JW_Bandung-Sastranegara.Intl.AP.967810_TMYx.2011-2025": {
        cityZh: "萬隆 (Bandung)",
        datacenters: "Telkom Sigma Bandung, ITB Supercomputer Hub, Indosat Ooredoo Hutchison Bandung Data Center"
    },
    "IDN_JW_Surabaya-Juanda.Intl.AP.969350_TMYx.2011-2025": {
        cityZh: "泗水 (Surabaya)",
        datacenters: "Telkom Indonesia Surabaya, BDx Surabaya, Moratelindo Surabaya IDC"
    },
    "IDN_SM_Batam-Hang.Nadim.AP.960870_TMYx.2011-2025": {
        cityZh: "巴淡島 (Batam)",
        datacenters: "Nongsa Digital Park (NDP), Telkom Batam DC, Princeton Digital Group (Batam Campus), Singtel-Telkom Batam Joint DC"
    },
    "THA_CRG_Bangkok-Mueang.Intl.AP.484560_TMYx.2011-2025": {
        cityZh: "曼谷 (Bangkok)",
        datacenters: "STT GDC Bangkok 1/2, True IDC (North/East Muang Thong), SuperNAP Thailand, NTT Bangkok 2, Telehouse Bangkok, Singtel-AIS Joint DC"
    },
    "THA_ERG_Chon.Buri.Sattahip.484590_TMYx.2011-2025": {
        cityZh: "春武里 / 東部走廊 (Chon Buri / EEC)",
        datacenters: "SuperNAP Thailand (Hemaraj EEC), Eastern Economic Corridor (EEC) Data Park, WHA Mega Data Center"
    },
    "PHL_NCR_Manila-Aquino.Intl.AP.984290_TMYx.2011-2025": {
        cityZh: "馬尼拉 (Metro Manila)",
        datacenters: "PLDT ePLDT VITRO Makati/Pasig, Globe Telecom DC, STT GDC Manila, Converge ICT Manila Hub"
    },
    "PHL_CNL_Mabalacat-Clark.Intl.AP.983270_TMYx.2011-2025": {
        cityZh: "克拉克 (Clark / Mabalacat)",
        datacenters: "PLDT VITRO Clark, Converge ICT Clark Data Center, Clark Freeport Zone Hub"
    },
    "PHL_CAL_Ambulong(菲律賓).984320_TMYx.2011-2025": {
        cityZh: "卡拉巴松 / 內湖 (CALABARZON / Laguna)",
        datacenters: "ePLDT VITRO Santa Rosa (Laguna 50MW Hyperscale), YCO Cloud Centers Malvar (Batangas)"
    },
    "VNM_NVN_Hanoi-Noi.Bai.Intl.AP.488200_TMYx.2011-2025": {
        cityZh: "河內 (Hanoi)",
        datacenters: "Viettel IDC Hoa Lac, VNPT Data Center Nam Thang Long, FPT Telecom Cau Giay, CMC Telecom DC Tan Thuan"
    },
    "VNM_SVN_Ho.Chi.Minh-Tan.Son.Nhat.Intl.AP.489000_TMYx.2011-2025": {
        cityZh: "胡志明市 (Ho Chi Minh City)",
        datacenters: "Viettel IDC Tan Binh, VNPT Tan Thuan, FPT Telecom Tan Thuan DC, CMC Telecom Tan Thuan"
    },
    "IND_MH_Mumbai-Shivaji.Intl.AP.430030_TMYx.2011-2025": {
        cityZh: "孟買 (Mumbai / Navi Mumbai)",
        datacenters: "Yotta NM1 (Navi Mumbai), STT GDC Mumbai, NTT Navi Mumbai, CtrlS Mumbai, AdaniConneX, Equinix MB1/MB2, AWS Mumbai"
    },
    "IND_DL_New.Delhi-Safdarjung.AP.421820_TMYx.2011-2025": {
        cityZh: "新德里 / 諾伊達 (Delhi / Noida)",
        datacenters: "Yotta D1 (Greater Noida), NTT Noida, CtrlS Noida, STT GDC Delhi, Sify Technologies Delhi-NCR"
    },
    "IND_TG_Hyderabad-Gandhi.Intl.AP.431285_TMYx.2011-2025": {
        cityZh: "海得拉巴 (Hyderabad)",
        datacenters: "CtrlS Hyderabad, CtrlS Gachibowli, STT GDC Hyderabad, Microsoft Azure Hyderabad Campus, AWS Hyderabad Region"
    },
    "IND_TN_Chennai.Intl.AP.432790_TMYx.2011-2025": {
        cityZh: "清奈 (Chennai)",
        datacenters: "NTT Chennai, STT GDC Chennai, AdaniConneX Chennai, Sify SIRUSERI, CapitaLand Data Centre Chennai, 海底電纜陸上中繼站"
    },
    "ARE_DU_Dubai.Intl.AP.411940_TMYx.2011-2025": {
        cityZh: "杜拜 (Dubai)",
        datacenters: "Equinix DX1/DX2, Moro Hub (太陽能綠能超算中心), Khazna Dubai, du Datamena, AWS UAE Region"
    },
    "ARE_AZ_Abu.Dhabi-Bateen.Exec.AP.412160_TMYx.2011-2025": {
        cityZh: "阿布達比 (Abu Dhabi)",
        datacenters: "Khazna Data Centers (Abu Dhabi 1~6), Group 42 (G42) AI Supercomputing Cloud, Etisalat IDC"
    },
    "SAU_RI_Riyadh-Khalid.Intl.AP.404370_TMYx.2011-2025": {
        cityZh: "利雅德 (Riyadh)",
        datacenters: "Center3 Riyadh Campus, STC Solutions Data Center, Mobily Malaz IDC, GO Telecom Riyadh, Google Cloud / Oracle Cloud Riyadh"
    },
    "SAU_MK_Jeddah-Abdulaziz.Intl.AP.410240_TMYx.2011-2025": {
        cityZh: "吉達 (Jeddah)",
        datacenters: "Center3 Jeddah Subsea Cable Station, STC Jeddah IDC, Mobily Jeddah DC, 紅海海底電纜國際門戶"
    },
    "PAK_SD_Karachi-Jinnah.Intl.AP.417800_TMYx.2011-2025": {
        cityZh: "喀拉蚩 (Karachi)",
        datacenters: "PTCL Tier-3 Data Center Karachi, Multinet Karachi, Cybernet Submarine Landing Station & IDC"
    },
    "BGD_DH_Dhaka-Shahjalal.Intl.AP.419220_TMYx.2011-2025": {
        cityZh: "達卡 (Dhaka)",
        datacenters: "Bangladesh Tier-IV National Data Center (Kaliakoir), Felicity IDC Dhaka, Summit Communications DC"
    },
    "LKA_EP_Colombo.434660_TMYx.2011-2025": {
        cityZh: "可倫坡 (Colombo)",
        datacenters: "Sri Lanka Telecom (SLT) Tier-III National Data Center (Pitipana), Dialog Axiata IDC Colombo"
    },
    "KHM_PP_Phnom.Penh.Intl.AP.489910_TMYx.2011-2025": {
        cityZh: "金邊 (Phnom Penh)",
        datacenters: "ByteDC Tier-III Phnom Penh, Smart Axiata IDC, EZECOM Data Center Phnom Penh"
    },
    "KAZ_ALA_Almaty.368700_TMYx.2011-2025": {
        cityZh: "阿拉木圖 (Almaty)",
        datacenters: "Kazakhtelecom Almaty IDC, Kazteleport (Sayram), Transtelecom Almaty Data Center"
    },
    "KAZ_AKM_Astana.351880_TMYx.2011-2025": {
        cityZh: "阿斯塔納 (Astana)",
        datacenters: "Kazakhtelecom Tier-III Astana DC, National Information Technologies (NITEC) Cloud Hub"
    },
    "UZB_TO_Pskem.384620_TMYx.2011-2025": {
        cityZh: "塔什干 / 普斯肯 (Tashkent / Pskem)",
        datacenters: "Uztelecom Tashkent Tier-III IDC, Ucell Data Center, East Telecom Tashkent"
    },
    "AZE_ABS_Baku-Bina-Aliyev.Intl.AP.378640_TMYx.2011-2025": {
        cityZh: "巴庫 (Baku)",
        datacenters: "AzInTelecom Baku Tier-III Government Data Center, Baktelecom IDC, Delta Telecom Baku"
    },
    "GEO_TB_Tbilisi.Intl.AP.375450_TMYx.2011-2025": {
        cityZh: "第比利斯 (Tbilisi)",
        datacenters: "Silknet Tier-III Data Center Tbilisi, MagtiCom IDC, Caucasus Online Cable Gateway"
    },
    "BRN_BM_Brunei.Intl.AP.963150_TMYx.2011-2025": {
        cityZh: "斯里百加灣 (Bandar Seri Begawan)",
        datacenters: "UNN Tungku Subsea Cable Landing & Data Center, DST Data Centre"
    },

    // === OCEANIA (10) ===
    "AUS_NSW_Sydney-Bankstown.AP.947650_TMYx.2011-2025": {
        cityZh: "雪梨 (Sydney)",
        datacenters: "AirTrunk SYD1/SYD2 (Huntingwood/Lane Cove), NextDC S1~S3, Equinix SY1~SY5, Macquarie Data Centres (IC2/IC3), CDC Eastern Creek, AWS Sydney"
    },
    "AUS_VIC_Melbourne-Essendon.Fields.948640_TMYx.2011-2025": {
        cityZh: "墨爾本 (Melbourne)",
        datacenters: "NextDC M1~M3, AirTrunk MEL1, Equinix ME1/ME2, Digital Realty Melbourne (Deer Park), Microsoft Azure Melbourne"
    },
    "AUS_WA_Perth.Intl.AP.946100_TMYx.2011-2025": {
        cityZh: "伯斯 (Perth)",
        datacenters: "NextDC P1/P2, Equinix PE1, Vocus Perth IX, DCI Data Centers (Perth), Subiaco Datacenter"
    },
    "AUS_QLD_Brisbane.Intl.AP.945780_TMYx.2011-2025": {
        cityZh: "布里斯本 (Brisbane)",
        datacenters: "NextDC B1/B2, Equinix BR1, Polaris Data Centre (Springfield), Pulse Data Centre"
    },
    "NZL_AUK_Auckland.Intl.AP.931100_TMYx.2011-2025": {
        cityZh: "奧克蘭 (Auckland)",
        datacenters: "CDC Data Centres Silverdale/Hobsonville, Spark New Zealand Takanini, Microsoft Azure New Zealand North, AWS Local Zone Auckland"
    },
    "NZL_CAN_Christchurch.Intl.AP.937800_TMYx.2011-2025": {
        cityZh: "基督城 (Christchurch)",
        datacenters: "Spark Christchurch DC, One NZ Christchurch, Plan B Data Centre"
    },
    "NZL_WGN_Wellington.Intl.AP.934360_TMYx.2011-2025": {
        cityZh: "威靈頓 (Wellington)",
        datacenters: "Spark Wellington DC, Datacom Kapiti, One NZ Wellington"
    },
    "GUM_TM_Tamuning-Won.Pat.Intl.AP.912120_TMYx.2011-2025": {
        cityZh: "關島 塔穆寧 (Guam / Tamuning)",
        datacenters: "GTA GNC Data Center (Piti), TeleGuam, NTT Com Guam Landing Station, AT&T 跨太平洋海底電纜登陸站"
    },
    "PNG_NC_Port.Moresby-Jacksons.Intl.AP.920350_TMYx.2011-2025": {
        cityZh: "莫士比港 (Port Moresby)",
        datacenters: "Kumul Telikom National Data Centre, Digicel PNG Hub, Coral Sea 海底電纜陸上閘道"
    },
    "FJI_WE_Nadi.Intl.AP.916800_TMYx.2011-2025": {
        cityZh: "楠迪 (Nadi)",
        datacenters: "Fiji International Telecommunications (FINTEL) Cable Landing Station & IDC, Vodafone Fiji Nadi DC"
    },

    // === EUROPE (36) ===
    "DEU_HE_Frankfurt.AP.106370_TMYx.2011-2025": {
        cityZh: "法蘭克福 (Frankfurt)",
        datacenters: "Equinix FR1~FR11, Digital Realty/Interxion FRA1~FRA17 (Hanauer Landstraße), NTT FRA1, Maincubes FRA01, AWS Frankfurt"
    },
    "DEU_BY_Munich.AP.108700_TMYx.2011-2025": {
        cityZh: "慕尼黑 (Munich)",
        datacenters: "Equinix MU1/MU3, Digital Realty MUC1, NTT Munich 1/2, Colt Munich Data Centre"
    },
    "DEU_HH_Hamburg-Schmidt.AP.101470_TMYx.2011-2025": {
        cityZh: "漢堡 (Hamburg)",
        datacenters: "Equinix HH1, Interxion HAM1/HAM2, Colt Hamburg Data Centre"
    },
    "GBR_ENG_London-Heathrow.Intl.AP.037720_TMYx.2011-2025": {
        cityZh: "倫敦 希斯洛 / 斯勞 (London / Slough)",
        datacenters: "Equinix LD4/LD5/LD6 (Slough), Telehouse London Docklands (North/South), Ark Data Centres, Vantage London, Virtus Data Centres"
    },
    "FRA_IF_Paris-Orly.AP.071490_TMYx.2011-2025": {
        cityZh: "巴黎 (Paris)",
        datacenters: "Equinix PA1~PA10 (Saint-Denis), Interxion Paris Digital Park, Digital Realty PAR1~PAR8, Scaleway DC3/DC5, AWS Paris"
    },
    "FRA_AR_Lyon.St.Exupery.AP.074810_TMYx.2011-2025": {
        cityZh: "里昂 (Lyon)",
        datacenters: "SFR Netcenter Lyon, DCforDATA Rock Data Center, Cogent Lyon Data Center"
    },
    "FRA_AO_Strasbourg-Entznheim.Intl.AP.071900_TMYx.2011-2025": {
        cityZh: "史特拉斯堡 (Strasbourg)",
        datacenters: "OVHcloud Strasbourg Campus (SBG1~SBG4), Cogent Strasbourg DC"
    },
    "NLD_NH_Amsterdam-Schipol.AP.062400_TMYx.2011-2025": {
        cityZh: "阿姆斯特丹 (Amsterdam)",
        datacenters: "Equinix AM1~AM8, Digital Realty AMS1~AMS18 (Science Park), Interxion Schiphol, Iron Mountain AMS-1, NTT Amsterdam 1"
    },
    "IRL_EM_Dublin.AP.039690_TMYx.2011-2025": {
        cityZh: "都柏林 (Dublin)",
        datacenters: "Microsoft Grange Castle Campus, AWS Dublin (Clonshaugh), Google Dublin, Digital Realty Profile Park, CyrusOne Dublin"
    },
    "CHE_ZH_Zurich.AP.066700_TMYx.2011-2025": {
        cityZh: "蘇黎世 (Zurich)",
        datacenters: "Equinix ZH1~ZH5, Green Datacenter Metro Campus Zurich, Interxion ZUR1/ZUR2, Google Cloud Zurich"
    },
    "CHE_BE_Bern.Belp.AP.066300_TMYx.2011-2025": {
        cityZh: "伯恩 (Bern)",
        datacenters: "Swisscom Data Center Wankdorf (Bern), Bedag Telecom DC"
    },
    "AUT_NO_Wien-Schwechat.AP.110360_TMYx.2011-2025": {
        cityZh: "維也納 (Vienna)",
        datacenters: "Interxion VIE1~VIE3, NTT Vienna 1, Digital Realty VIE, A1 Telekom Austria Arsenal DC"
    },
    "SWE_ST_Stockholm.Arlanda.AP.024600_TMYx.2011-2025": {
        cityZh: "斯德哥爾摩 (Stockholm)",
        datacenters: "Equinix SK1~SK3, DigiPlex Stockholm, AWS Stockholm (Västerås/Katrineholm), Interxion STO, atNorth Stockholm"
    },
    "FIN_US_Helsinki-Vantaa.AP.029740_TMYx.2011-2025": {
        cityZh: "赫爾辛基 (Helsinki)",
        datacenters: "Equinix HE1~HE7, Telia Helsinki Data Center, Google Hamina Data Center Campus (海水冷卻樞紐)"
    },
    "NOR_AK_Oslo.AP-Gardermoen.013840_TMYx.2011-2025": {
        cityZh: "奧斯陸 (Oslo)",
        datacenters: "Bulk Infrastructure OS-IX, Green Mountain DC1/DC2, DigiPlex Oslo, Stack Infrastructure Oslo"
    },
    "NOR_RO_Stavanger.AP-Sola.014150_TMYx.2011-2025": {
        cityZh: "斯塔萬格 (Stavanger)",
        datacenters: "Green Mountain DC1-Stavanger (Rennesøy 峽灣地下冷卻中心), Altibox DC"
    },
    "DNK_HS_Copenhagen-Kastrup.AP.061800_TMYx.2011-2025": {
        cityZh: "哥本哈根 (Copenhagen)",
        datacenters: "DigiPlex Copenhagen, GlobalConnect DC, Interxion CPH1~CPH3, Apple Viborg / Meta Odense DC"
    },
    "BEL_BRU_Brussels.Natl.AP.064510_TMYx.2011-2025": {
        cityZh: "布魯塞爾 (Brussels)",
        datacenters: "Digital Realty BRU1~BRU4, Interxion BRU, LCL Brussels Data Centers, Google St. Ghislain DC"
    },
    "LUX_LU_Luxembourg.Intl.AP.065900_TMYx.2011-2025": {
        cityZh: "盧森堡 (Luxembourg)",
        datacenters: "LuxConnect Tier-IV Data Centers (DC1~DC4), EBRC Resilience Centre, Datacenter Luxembourg"
    },
    "ESP_MD_Madrid-Barajas-Suarez.AP.082210_TMYx.2011-2025": {
        cityZh: "馬德里 (Madrid)",
        datacenters: "Equinix MD1/MD2, Interxion MAD1~MAD4, Data4 Madrid, Merlin Properties DC, AWS Spain (Aragon)"
    },
    "ESP_CT_Barcelona-El.Prat.AP.081810_TMYx.2011-2025": {
        cityZh: "巴塞隆納 (Barcelona)",
        datacenters: "Equinix BA1, Merlin Properties BCN01, EdgeConneX Barcelona, BitNAP Barcelona"
    },
    "ITA_LM_Milano-Linate.AP.160800_TMYx.2011-2025": {
        cityZh: "米蘭 (Milan)",
        datacenters: "Equinix ML2~ML5, Caldera Park Carrier Hotel, Aruba Global Cloud Data Center (Bergamo IT3), Stack Milan"
    },
    "ITA_LZ_Rome-Fiumicino-da.Vinci.AP.162420_TMYx.2011-2025": {
        cityZh: "羅馬 (Rome)",
        datacenters: "Aruba Hyper Cloud Data Center Rome (IT4), TIM Rome Data Center, Rai Way Edge DC"
    },
    "ITA_PM_Torino-Caselle.AP.160590_TMYx.2011-2025": {
        cityZh: "杜林 (Turin)",
        datacenters: "TIM Torino IDC, CSI Piemonte Cloud Center, Fastweb Torino DC"
    },
    "PRT_LB_Lisboa.Portela.AP.085360_TMYx.2011-2025": {
        cityZh: "里斯本 (Lisbon)",
        datacenters: "Equinix LS1, Altice Portugal Covilhã/Lisbon, Sines Start Campus (500MW 綠能超算中心)"
    },
    "POL_MZ_Okecie-Warszawa-Chopina.Intl.AP.123750_TMYx.2011-2025": {
        cityZh: "華沙 (Warsaw)",
        datacenters: "Equinix WA1~WA3, EdgeConneX Warsaw, Atman Data Centers, Google Cloud Warsaw Region"
    },
    "CZE_PM_Praha-Ruzyne.AP.115180_TMYx.2011-2025": {
        cityZh: "布拉格 (Prague)",
        datacenters: "TTC Teleport DC1/DC2, CE Colo Prague, GTS Novera DC"
    },
    "GRC_AT_Athinai.Venizelos.Intl.AP.167410_TMYx.2011-2025": {
        cityZh: "雅典 (Athens)",
        datacenters: "Digital Realty (Lamda Hellix ATH1~ATH3), Microsoft Athens DC Campus, Sparkle Greece"
    },
    "GRC_MH_Thessaloniki-Makedonia.AP.166220_TMYx.2011-2025": {
        cityZh: "塞薩洛尼基 (Thessaloniki)",
        datacenters: "Lancom Cloud DC (Balkan Gate), Sparkle Northern Greece"
    },
    "TUR_IB_Istanbul-Ataturk.AP.170600_TMYx.2004-2018": {
        cityZh: "伊斯坦堡 (Istanbul)",
        datacenters: "Equinix IL1/IL2, Turkcell Gebze Data Center, Vodafone Istanbul IDC, Star of Bosphorus"
    },
    "ROU_B_Bucharest-Baneasa-Vlaicu.AP.154200_TMYx.2011-2025": {
        cityZh: "布加勒斯特 (Bucharest)",
        datacenters: "NXDATA-1 / NXDATA-2 Carrier Hotel, GTS Telecom Bucharest, ClusterPower Craiova"
    },
    "BGR_SF_Sofia.Intl.AP.156140_TMYx.2011-2025": {
        cityZh: "索菲亞 (Sofia)",
        datacenters: "Equinix SO1/SO2, Telepoint Sofia Tier-3, Neterra Sofia Data Center"
    },
    "HRV_GZ_Zagreb-Tudman.AP.142410_TMYx.2011-2025": {
        cityZh: "札格瑞布 (Zagreb)",
        datacenters: "Digital Realty Zagreb (ZAG1), A1 Croatia Data Center, Hrvatski Telekom IDC"
    },
    "LTU_VL_Vilnius.Intl.AP.267300_TMYx.2011-2025": {
        cityZh: "維爾紐斯 (Vilnius)",
        datacenters: "Telia Vilnius DC, Baltneta Tier-III Data Center, Duomenų Logistikos Centras"
    },
    "LVA_PR_Riga.264220_TMYx.2011-2025": {
        cityZh: "里加 (Riga)",
        datacenters: "DEAC Riga Data Centers (Riga/Pils), Tet Data Center Dattum (Tier-III)"
    },
    "ISR_TA_Tel.Aviv-Ben.Gurion.Intl.AP.401800_TMYx.2011-2025": {
        cityZh: "特拉維夫 (Tel Aviv)",
        datacenters: "MedOne Petah Tikva / Tirat Carmel, EdgeConneX Tel Aviv, Compass Datacenters, AWS Israel Region"
    },

    // === AMERICAS (52) ===
    "USA_VA_Dulles-Washington.Dulles.Intl.AP.724030_TMYx.2011-2025": {
        cityZh: "北維吉尼亞 杜勒斯 (Northern Virginia / Ashburn)",
        datacenters: "Data Center Alley (Equinix DC1~DC15, Digital Realty Ashburn Campus, AWS US-East-1, QTS Ashburn, Vantage VA1, CloudHQ)"
    },
    "USA_CA_San.Jose-Mineta.Intl.AP.724945_TMYx.2011-2025": {
        cityZh: "矽谷 聖荷西 (Silicon Valley / San Jose)",
        datacenters: "Equinix SV1~SV17, Digital Realty Santa Clara, Vantage CA1~CA3, CoreSite SV1~SV8, AWS US-West-1"
    },
    "USA_AZ_Phoenix-Sky.Harbor.Intl.AP.722780_TMYx.2011-2025": {
        cityZh: "鳳凰城 (Phoenix / Mesa / Chandler)",
        datacenters: "TSMC Fab 21 Arizona DC, Apple Mesa Mega DC, CyrusOne Chandler, Iron Mountain AZP-1, EdgeCore Mesa, Aligned Phoenix"
    },
    "USA_TX_Dallas-Fort.Worth.Intl.AP.722590_TMYx.2011-2025": {
        cityZh: "達拉斯 (Dallas / Fort Worth)",
        datacenters: "Equinix DA1~DA11, Digital Realty Dallas/Richardson, CyrusOne Carrollton, DataBank DFW, QTS Fort Worth (Meta Campus)"
    },
    "USA_IL_Chicago.OHare.Intl.AP.725300_TMYx.2011-2025": {
        cityZh: "芝加哥 (Chicago)",
        datacenters: "Digital Realty 350 E Cermak (全球頂級電信交換樞紐), QTS Chicago, CyrusOne Aurora, Equinix CH1~CH4, Microsoft Chicago"
    },
    "USA_GA_Atlanta-Hartsfield-Jackson.Intl.AP.722190_TMYx.2011-2025": {
        cityZh: "亞特蘭大 (Atlanta)",
        datacenters: "QTS Atlanta Metro Campus, Google Lithia Springs, Switch The Keep, Digital Realty ATL, Vantage South Fulton"
    },
    "USA_OR_Portland-Hillsboro.AP.726986_TMYx.2011-2025": {
        cityZh: "波特蘭 / 希爾斯伯勒 (Portland / Hillsboro)",
        datacenters: "Hillsboro DC 聚落 (Digital Realty, Stack Infrastructure, Vantage, NTT Hillsboro, Flexential Portland)"
    },
    "USA_NJ_Newark.Liberty.Intl.AP.725020_TMYx.2011-2025": {
        cityZh: "紐澤西 紐華克 (Newark / Secaucus)",
        datacenters: "Equinix NY4/NY5 Secaucus (華爾街高頻交易主機核心), Digital Realty Clifton, CoreSite NY2, CyrusOne Somerset"
    },
    "USA_FL_Miami.Natl.Hurricane.Center.722020_TMYx.2011-2025": {
        cityZh: "邁阿密 (Miami)",
        datacenters: "Equinix MI1 (NAP of the Americas - 美洲骨幹樞紐), Digital Realty MIA, EdgeConneX Miami"
    },
    "USA_CO_Denver.Intl.AP.725650_TMYx.2011-2025": {
        cityZh: "丹佛 (Denver)",
        datacenters: "CoreSite Denver (DE1/DE2), Flexential Denver, DataBank Denver, EdgeConneX Denver"
    },
    "USA_AL_Andalusia-South.Alabama.Rgnl.AP.722275_TMYx.2011-2025": {
        cityZh: "南阿拉巴馬 (South Alabama / Andalusia)",
        datacenters: "Alabama 區域光纖節點, Southern Telecom 網路樞紐設施"
    },
    "CAN_ON_Toronto-Pearson.Intl.AP.716240_TMYx.2011-2025": {
        cityZh: "多倫多 (Toronto)",
        datacenters: "Equinix TR1/TR2, Digital Realty Toronto (Vaughan), Vantage Toronto, Cologix TOR1~TOR4, AWS Canada Central"
    },
    "CAN_QC_Montreal-Trudeau.Intl.AP.716270_TMYx.2011-2025": {
        cityZh: "蒙特婁 (Montreal)",
        datacenters: "Cologix MTL1~MTL11, Vantage Montreal Campus, OVHcloud Beauharnois (水冷超算園區), AWS Montreal"
    },
    "CAN_BC_Vancouver.Intl.AP.718920_TMYx.2011-2025": {
        cityZh: "溫哥華 (Vancouver)",
        datacenters: "Cologix VAN1~VAN3, Equinix VA1, TELUS Harbour Centre Data Center"
    },
    "CAN_AB_Calgary.Intl.AP.718770_TMYx.2011-2025": {
        cityZh: "卡加利 (Calgary)",
        datacenters: "AWS Canada West (Calgary Region), Cologix CGY1/CGY2, Rogers Data Centre Calgary"
    },
    "CAN_AB_Edmonton.Intl.AP.711230_TMYx.2011-2025": {
        cityZh: "艾德蒙頓 (Edmonton)",
        datacenters: "TELUS Edmonton IDC, Rogers Edmonton Data Centre"
    },
    "CAN_ON_Ottawa-Macdonald-Cartier.Intl.AP.716280_TMYx.2011-2025": {
        cityZh: "渥太華 (Ottawa)",
        datacenters: "Shared Services Canada (SSC) 聯邦政府雲端運算中心, Cologix Ottawa"
    },
    "CAN_NS_Halifax-Stanfield.Intl.AP.713950_TMYx.2011-2025": {
        cityZh: "哈利法克斯 (Halifax)",
        datacenters: "Bell Aliant Halifax IDC, Eastlink Data Centre, 大西洋海底電纜登陸站"
    },
    "MEX_QUE_Queretaro.766250_TMYx.2011-2025": {
        cityZh: "克雷塔羅 (Querétaro)",
        datacenters: "Ascenty QRO1~QRO3, ODATA QR01/QR02, Equinix MX1/MX2, CloudHQ Querétaro Campus, AWS Mexico Central"
    },
    "MEX_CMX_Cuidad.Mexico-Mexico.City.Intl.AP-Juarez.Intl.AP.766793_TMYx.2011-2025": {
        cityZh: "墨西哥城 (Mexico City)",
        datacenters: "KIO Networks MEX1~MEX5, Equinix MX1, Alestra Mexico City IDC, Triara Telmex"
    },
    "MEX_NLE_Monterrey-del.Norte.Intl.AP.763940_TMYx.2011-2025": {
        cityZh: "蒙特雷 (Monterrey)",
        datacenters: "KIO Networks Monterrey, Alestra Monterrey, ODATA Monterrey Campus"
    },
    "MEX_JAL_Guadalajara-Chapalita.766120_TMYx.2011-2025": {
        cityZh: "瓜達拉哈拉 (Guadalajara)",
        datacenters: "KIO Networks Guadalajara, Alestra Technology Campus Guadalajara"
    },
    "MEX_BCN_Tijuana-Rodriguez.Intl.AP.760013_TMYx.2011-2025": {
        cityZh: "提華納 (Tijuana)",
        datacenters: "KIO Networks Tijuana, Telnor/Telmex 跨境骨幹資料節點"
    },
    "BRA_SP_Sao.Paulo-Congonhas.AP.837800_TMYx.2011-2025": {
        cityZh: "聖保羅 (São Paulo)",
        datacenters: "Ascenty SP1~SP5, Scala Data Centers Tamboré Mega Campus, Equinix SP1~SP4, ODATA SP01~SP03, AWS São Paulo Region"
    },
    "BRA_SP_Campinas-Viracopos.Intl.AP.837210_TMYx.2011-2025": {
        cityZh: "坎皮納斯 (Campinas)",
        datacenters: "Ascenty Campinas 1/2, Scala Data Centers Campinas Campus, Santander 巨型金融資料中心"
    },
    "BRA_RJ_Rio.de.Janeiro-Galeao-Jobim.Intl.AP.837460_TMYx.2011-2025": {
        cityZh: "里約熱內盧 (Rio de Janeiro)",
        datacenters: "Equinix RJ1/RJ2, Ascenty Rio de Janeiro, Scala Data Centers RJ"
    },
    "BRA_DF_Brasilia-Kubitschek.Intl.AP.833780_TMYx.2011-2025": {
        cityZh: "巴西利亞 (Brasília)",
        datacenters: "Banco do Brasil / Caixa 聯邦國家級機房, Serpro 巴西政府核心雲端園區"
    },
    "BRA_CE_Fortaleza-Pinto.Martins.Intl.AP.823980_TMYx.2011-2025": {
        cityZh: "福塔萊薩 (Fortaleza)",
        datacenters: "HostDime Tier-IV Fortaleza, Angola Cables AngoNAP Fortaleza, 跨大西洋海底電纜陸上總站"
    },
    "BRA_BA_Salvador-Magalhaes.Intl.AP.832480_TMYx.2011-2025": {
        cityZh: "薩爾瓦多 (Salvador)",
        datacenters: "Claro/Embratel Salvador IDC, Oi Telecom Bahia Hub"
    },
    "BRA_PR_Curitiba-Pena.Intl.AP.838400_TMYx.2011-2025": {
        cityZh: "庫里奇巴 (Curitiba)",
        datacenters: "Scala Data Centers Curitiba, Copel Telecom IDC"
    },
    "BRA_RS_Porto.Alegre-Salgado.Filho.Intl.AP.839710_TMYx.2011-2025": {
        cityZh: "阿雷格里港 (Porto Alegre)",
        datacenters: "Scala Data Centers Porto Alegre, Banrisul 金融數據中心"
    },
    "CHL_RM_Santiago-Pudahuel-Benitez.Intl.AP.855740_TMYx.2011-2025": {
        cityZh: "聖地牙哥 (Santiago)",
        datacenters: "Google Quilicura DC, Ascenty Santiago 1/2, Scala Data Centers Santiago, ODATA ST01, Equinix ST1/ST2, Microsoft Chile Central"
    },
    "COL_CUN_Bogota-Eldorado.Intl.AP.802220_TMYx.2011-2025": {
        cityZh: "波哥大 (Bogotá)",
        datacenters: "Equinix BG1, Ascenty Bogota 1/2, ODATA BG01, Claro Megacentro El Dorado, ETB Data Center"
    },
    "COL_ANT_Medellin-Olaya.Herrera.AP.801100_TMYx.2011-2025": {
        cityZh: "麥德林 (Medellín)",
        datacenters: "Tigo/UNE Data Center Medellín, EPM 科技運算中心"
    },
    "COL_VAC_Cali-Aragon.Intl.AP.802590_TMYx.2011-2025": {
        cityZh: "卡利 (Cali)",
        datacenters: "Claro Cali IDC, Carvajal 企業雲端中心"
    },
    "COL_BOL_Cartagena-Nunez.Intl.AP.800220_TMYx.2011-2025": {
        cityZh: "卡塔赫納 (Cartagena)",
        datacenters: "Columbus Networks / C&W 海底電纜陸上站, Claro 加勒比門戶中心"
    },
    "ARG_BA_Buenos.Aires-Newbery.Intl.AP.875820_TMYx.2011-2025": {
        cityZh: "布宜諾斯艾利斯 (Buenos Aires)",
        datacenters: "Telecom Argentina Pacheco 巨型機房, Cirion Technologies BA, Lumen IDC, Equinix BA1"
    },
    "ARG_CB_Cordoba-Taravella.Intl.AP.873440_TMYx.2011-2025": {
        cityZh: "科爾多瓦 (Córdoba)",
        datacenters: "Telecom Argentina Córdoba, EPEC 能源與雲端運算中心"
    },
    "PER_LMA_Lima-Chavez.Intl.AP.846280_TMYx.2011-2025": {
        cityZh: "利馬 (Lima)",
        datacenters: "Equinix LM1, Cirion Technologies Lima, Claro Villa El Salvador IDC, GTD Perú DC"
    },
    "ECU_PC_Quito-Mariscal.Sucre.Intl.AP.840725_TMYx.2011-2025": {
        cityZh: "基多 (Quito)",
        datacenters: "Telconet Cloud Center Quito, CNT EP 國家數據中心, Cirion Quito"
    },
    "ECU_GY_Guayaquil-Olmedo.Intl.AP.842030_TMYx.2011-2025": {
        cityZh: "瓜亞基爾 (Guayaquil)",
        datacenters: "Telconet Guayaquil Mega DC, 太平洋海底電纜登陸總站"
    },
    "URY_CA_Montevideo-Carrasco.Intl.AP.865800_TMYx.2011-2025": {
        cityZh: "蒙特維多 (Montevideo)",
        datacenters: "Antel Data Center José Joaquín de Viana (Tier-IV), Google Canelones 綠能算力中心"
    },
    "PRY_AS_Asuncion-Pettirossi.Intl.AP.862180_TMYx.2011-2025": {
        cityZh: "亞松森 (Asunción)",
        datacenters: "Tigo Paraguay Tier-III Data Center, Copaco 國家電信機房"
    },
    "BOL_LP_La.Paz-El.Alto.Intl.AP.852010_TMYx.2011-2025": {
        cityZh: "拉巴斯 / 埃爾阿爾托 (La Paz / El Alto)",
        datacenters: "Entel Bolivia El Alto Tier-III Data Center (高海拔機房), Tigo Bolivia DC"
    },
    "BOL_SC_Santa.Cruz.de.la.Sierra-Viru.Viru.Intl.AP.852440_TMYx.2011-2025": {
        cityZh: "聖克魯斯 (Santa Cruz de la Sierra)",
        datacenters: "AXS Bolivia Tier-III Data Center, Entel Santa Cruz IDC"
    },
    "VEN_VA_Maiquetia-Bolivar.Intl.AP.804150_TMYx.2011-2025": {
        cityZh: "卡拉卡斯 (Caracas / Maiquetía)",
        datacenters: "Cantv 國家數據中心, Daycohost Caracas Data Center"
    },
    "CRI_AL_San.Jose-Santamaria.Intl.AP.787620_TMYx.2011-2025": {
        cityZh: "聖荷西 (San José)",
        datacenters: "ICE (Instituto Costarricense de Electricidad) Tier-III IDC, Rackwoods Costa Rica"
    },
    "PAN_PM_Tocumen.Intl.AP.787920_TMYx.2011-2025": {
        cityZh: "巴拿馬市 (Panama City)",
        datacenters: "KIO Networks Panama (PAC1), Cable & Wireless Panama IDC, 兩洋海底電纜互聯樞紐"
    },
    "GTM_GU_Ciudad.Guatemala-La.Aurora.Intl.AP.786410_TMYx.2011-2025": {
        cityZh: "瓜地馬拉市 (Guatemala City)",
        datacenters: "KIO Networks Guatemala, Tigo Guatemala IDC, Claro Guatemala DC"
    },
    "DOM_SD_Las.Americas.Intl.AP.784850_TMYx.2011-2025": {
        cityZh: "聖多明哥 (Santo Domingo)",
        datacenters: "Claro Dominican Republic Tier-III DC, NAP del Caribe (加勒比海科技園區機房)"
    },
    "JAM_KI_Kingston-Manley.Intl.AP.783970_TMYx.2011-2025": {
        cityZh: "京斯敦 (Kingston)",
        datacenters: "Digicel Jamaica Data Center, FLOW / Cable & Wireless Jamaica IDC"
    },
    "TTO_TP_Piarco.Intl.AP.789700_TMYx.2011-2025": {
        cityZh: "西班牙港 / 皮亞爾科 (Port of Spain / Piarco)",
        datacenters: "TSTT Tier-III IDC, Fujitsu Caribbean Regional Data Center"
    },

    // === AFRICA (21) ===
    "ZAF_GT_Johannesburg-Tambo.Intl.AP.683680_TMYx.2011-2025": {
        cityZh: "約翰尼斯堡 (Johannesburg)",
        datacenters: "Teraco JB1~JB4 (Isando Campus), Vantage JNB1, Equinix JN1, Africa Data Centres (JOS1), NTT Johannesburg, AWS South Africa"
    },
    "ZAF_WC_Cape.Town.Intl.AP.688160_TMYx.2011-2025": {
        cityZh: "開普敦 (Cape Town)",
        datacenters: "Teraco CT1/CT2 (Rondebosch), Africa Data Centres (CPT1), Vantage CPT1, Dimension Data CT, AWS Cape Town Region"
    },
    "EGY_QH_Cairo.Intl.AP.623660_TMYx.2011-2025": {
        cityZh: "開羅 (Cairo / Smart Village)",
        datacenters: "Telecom Egypt Regional Data Hub (RDH), Orange Egypt Smart Village DC, Raya Data Center, Vodafone Egypt DC"
    },
    "EGY_IK_Alexandria-Nozha.Intl.AP.623180_TMYx.2011-2025": {
        cityZh: "亞歷山大 (Alexandria)",
        datacenters: "Telecom Egypt Alexandria 海底電纜陸上國際門戶中繼站"
    },
    "NGA_LA_Lagos-Muhammed.Intl.AP.652010_TMYx.2011-2025": {
        cityZh: "拉哥斯 (Lagos)",
        datacenters: "MainOne MDXi Tier-III DC, Equinix MDXi Lagos, Rack Centre (LGS1), Medallion Data Centres, Africa Data Centres (LOS1)"
    },
    "NGA_FC_Abuja.651250_TMYx.2011-2025": {
        cityZh: "阿布加 (Abuja)",
        datacenters: "Galaxy Backbone Tier-IV 國家數據中心, Galaxy 聯邦政府雲端樞紐"
    },
    "MAR_CS_Casablanca-Mohammed.Intl.AP.601560_TMYx.2011-2025": {
        cityZh: "卡薩布蘭卡 (Casablanca)",
        datacenters: "Maroc Telecom Casablanca IDC, Orange Morocco DC, N+ONE Datacenters Casablanca"
    },
    "MAR_RK_Rabat-Sale.AP.601350_TMYx.2011-2025": {
        cityZh: "拉巴特 (Rabat)",
        datacenters: "Maroc Telecom Rabat Cloud Center, Technopolis Rabat 科技城數據中心"
    },
    "KEN_NB_Nairobi-Kenyatta.Intl.AP.637400_TMYx.2011-2025": {
        cityZh: "奈洛比 (Nairobi)",
        datacenters: "Africa Data Centres (NBO1), iColo NBO1/NBO2, Safaricom Tier-III DC, East Africa Data Centre (EADC), Microsoft Azure Local Zone"
    },
    "ETH_AA_Addis.Ababa-Bole.Intl.AP.634500_TMYx.2011-2025": {
        cityZh: "阿迪斯阿貝巴 (Addis Ababa)",
        datacenters: "Ethio Telecom Tier-III 國家數據中心, Raxio Ethiopia (ET01 - ICT Park), Wingu.Africa Addis DC"
    },
    "AGO_LUA_Luanda-Quatro.de.Fevereiro.Intl.AP.661600_TMYx.2011-2025": {
        cityZh: "羅安達 (Luanda)",
        datacenters: "Angola Cables AngoNAP Luanda Tier-III, Unitel Angola Data Center, SACS 南大西洋海底電纜站"
    },
    "BWA_GA_Gaborone-Khama.Intl.AP.682400_TMYx.2011-2025": {
        cityZh: "嘉柏隆里 (Gaborone)",
        datacenters: "Botswana Telecommunications Corporation (BTC) Mega DC, InnoLead Data Centre"
    },
    "GHA_AA_Accra-Kotoka.Intl.AP.654720_TMYx.2011-2025": {
        cityZh: "阿克拉 (Accra)",
        datacenters: "MainOne MDXi Tier-III Accra (Appolonia City), Africa Data Centres (ACC1), MTN Ghana Data Center"
    },
    "MUS_GP_Plaine.Magnien-Ramgoolam.Intl.AP.619900_TMYx.2011-2025": {
        cityZh: "模里西斯 馬埃堡 (Mauritius)",
        datacenters: "Mauritius Telecom Tier-IV Data Centre (Rose Belle), Emtel Data Centre (Arsenal), 印度洋國際光纖樞紐"
    },
    "ZMB_LS_Lusaka-Kaunda.Intl.AP.676650_TMYx.2011-2025": {
        cityZh: "路沙卡 (Lusaka)",
        datacenters: "Zamtel National Data Center, INFRATEL Tier-III Lusaka Data Center, Liquid Intelligent Technologies DC"
    },
    "MOZ_MC_Maputo.Intl.AP.673410_TMYx.2011-2025": {
        cityZh: "馬布多 (Maputo)",
        datacenters: "Tmcel Mozambique IDC, Raxio Mozambique (MZ01), 2Africa 環非海底電纜登陸站"
    },
    "TZA_PW_Dar.es.Salaam-Nyerere.Intl.AP.638940_TMYx.2011-2025": {
        cityZh: "三蘭港 (Dar es Salaam)",
        datacenters: "TTCL National Data Center, Raxio Tanzania (TZ01), SEACOM / EASSy 海底電纜陸上總站"
    },
    "UGA_CEN_Entebbe.Intl.AP.637050_TMYx.2011-2025": {
        cityZh: "恩德培 / 坎帕拉 (Entebbe / Kampala)",
        datacenters: "Raxio Uganda (UG01 Tier-III Namanve), National Information Technology Authority (NITA-U) Data Center"
    },
    "COD_KN_Kinshasa-Ndjili.Intl.AP.642100_TMYx.2011-2025": {
        cityZh: "金夏沙 (Kinshasa)",
        datacenters: "Raxio DR Congo (CD01 Tier-III Kinshasa), OADC Kinshasa (Texaf Digital Campus)"
    },
    "CIV_AB_Abidjan-Houphouet-Boigny.Intl.AP.655780_TMYx.2011-2025": {
        cityZh: "阿必尚 (Abidjan)",
        datacenters: "Orange Côte d'Ivoire Data Center (Grand-Bassam), MainOne MDXi Abidjan, Raxio Abidjan (CI01)"
    },
    "SEN_DK_Dakar-Senghor.Intl.AP.616410_TMYx.2011-2025": {
        cityZh: "達卡 (Dakar)",
        datacenters: "Sonatel / Orange Dakar DC, 塞內加爾國家數據中心 (Diamniadio Tier-III), MainOne Dakar Hub"
    }
};

if (typeof module !== 'undefined') {
    module.exports = { STATION_META };
}
