/**
 * catalog_manager.js - Centralized Equipment Catalog Manager (V27)
 * Loads, parses and serves rich device catalogs from device_catalog/ directory
 * with complete built-in vendor fallback models for offline/file:// runtime.
 */
(function(window) {
    'use strict';

    const BUILTIN_VENDOR_CATALOGS = {
        cdu: [
            { model: 'Vertiv XDU 80kW', capKw: 80, vendor: 'Vertiv', powerKw: 3.5 },
            { model: 'CoolIT CDU 100kW (標準)', capKw: 100, vendor: 'CoolIT', powerKw: 4.2 },
            { model: 'Vertiv XDU 150kW', capKw: 150, vendor: 'Vertiv', powerKw: 5.2 },
            { model: 'Airedale CoolTrap CDU 200kW', capKw: 200, vendor: 'Airedale', powerKw: 7.8 },
            { model: 'Schneider InRow CDU 300kW', capKw: 300, vendor: 'Schneider', powerKw: 9.5 },
            { model: 'CoolIT High Density CDU 600kW', capKw: 600, vendor: 'CoolIT', powerKw: 18.0 },
            { model: 'Motivair CDU 800kW Megawatt', capKw: 800, vendor: 'Motivair', powerKw: 24.0 },
            { model: 'CoolIT CHx1200 1200kW', capKw: 1200, vendor: 'CoolIT', powerKw: 35.0 }
        ],
        dry_cooler: [
            { model: 'Güntner 1200kW V-Bank Dry Cooler', capKw: 1200, vendor: 'Güntner', fanKwDx: 30, approachC: 5.0 },
            { model: 'BAC Trillium 2000kW Closed-Loop', capKw: 2000, vendor: 'BAC', fanKwDx: 50, approachC: 5.0 },
            { model: 'Güntner 6000kW Raised-Bed (DSX Standard)', capKw: 6000, vendor: 'Güntner', fanKwDx: 150, approachC: 5.0 },
            { model: 'BAC Trillium 6000kW Raised-Bed (DSX)', capKw: 6000, vendor: 'BAC', fanKwDx: 145, approachC: 5.0 }
        ],
        cooling_tower: [
            { model: 'BAC Series 3000 600kW', capKw: 600, vendor: 'BAC', fanKwDx: 15, approachC: 5.0 },
            { model: 'BAC Series 3000 1000kW (標準)', capKw: 1000, vendor: 'BAC', fanKwDx: 25, approachC: 5.0 },
            { model: 'BAC VFL-1200 2000kW', capKw: 2000, vendor: 'BAC', fanKwDx: 55, approachC: 5.0 },
            { model: 'BAC VFL-1500 2500kW', capKw: 2500, vendor: 'BAC', fanKwDx: 75, approachC: 5.0 },
            { model: 'BAC Closed CXV-1500 1800kW', capKw: 1800, vendor: 'BAC', fanKwDx: 55, approachC: 7.0 },
            { model: 'Liang Chi LBC 1500kW Industrial', capKw: 1500, vendor: 'Liang Chi', fanKwDx: 38, approachC: 5.0 }
        ],
        heat_exchanger: [
            { model: 'Alfa Laval M10 Plate HX 500kW', capKw: 500, vendor: 'Alfa Laval', approachC: 1.5 },
            { model: 'Alfa Laval M15 Plate HX 1000kW (標準)', capKw: 1000, vendor: 'Alfa Laval', approachC: 1.5 },
            { model: 'Sondex S65 Plate HX 1500kW', capKw: 1500, vendor: 'Sondex', approachC: 1.5 },
            { model: 'Alfa Laval T20 Plate HX 2000kW High Flow', capKw: 2000, vendor: 'Alfa Laval', approachC: 1.5 }
        ],
        chiller_water: [
            { model: 'Carrier 23XRV Variable-Speed Screw 350kW', capKw: 350, vendor: 'Carrier', cop: 6.2 },
            { model: 'Trane RTHD Water-Cooled Screw 500kW (標準)', capKw: 500, vendor: 'Trane', cop: 6.5 },
            { model: 'Trane Turbocor TC 700kW Magnetic Bearing', capKw: 700, vendor: 'Trane', cop: 8.3 },
            { model: 'York YZ Magnetic Bearing Centrifugal 800kW', capKw: 800, vendor: 'York', cop: 7.5 },
            { model: 'Carrier 19DV Centrifugal 1200kW', capKw: 1200, vendor: 'Carrier', cop: 7.0 },
            { model: 'Trane RTWD 1500kW Screw Chiller', capKw: 1500, vendor: 'Trane', cop: 6.5 },
            { model: 'Trane CTV 2000kW Centrifugal', capKw: 2000, vendor: 'Trane', cop: 6.8 },
            { model: 'York YT 2500kW Centrifugal Chiller', capKw: 2500, vendor: 'York', cop: 6.9 }
        ],
        chiller_air: [
            { model: 'Carrier 30XA 150kW Screw Air-Cooled', capKw: 150, vendor: 'Carrier', cop: 3.4 },
            { model: 'Carrier 30XA 300kW Screw Air-Cooled (標準)', capKw: 300, vendor: 'Carrier', cop: 3.6 },
            { model: 'York YVAA 500kW VFD Screw Air-Cooled', capKw: 500, vendor: 'York', cop: 3.8 },
            { model: 'Trane Stealth 750kW Air-Cooled', capKw: 750, vendor: 'Trane', cop: 3.9 },
            { model: 'York YVAA 1000kW High Efficiency Air-Cooled', capKw: 1000, vendor: 'York', cop: 4.0 }
        ],
        crah: [
            { model: 'Stulz CyberAir 4 CFD 600 A (60kW)', capKw: 60, vendor: 'Stulz', fanPowerKw: 4.8 },
            { model: 'Stulz CyberAir 4 CFD 1000 A (100kW)', capKw: 100, vendor: 'Stulz', fanPowerKw: 7.5 },
            { model: 'Stulz CyberAir 4 CFD 1500 A (150kW)', capKw: 150, vendor: 'Stulz', fanPowerKw: 11.2 },
            { model: 'Vertiv Liebert PCW 100kW EC Fan', capKw: 100, vendor: 'Vertiv', fanPowerKw: 7.0 },
            { model: 'FanWall FW-150-EC (Network/AI Optim 150kW)', capKw: 150, vendor: 'High-Density FanWall', fanPowerKw: 8.5 },
            { model: 'FanWall FW-200-EC (Ultra High Density 200kW)', capKw: 200, vendor: 'High-Density FanWall', fanPowerKw: 12.0 },
            { model: 'FanWall FW-300-EC (Mega Modular 300kW)', capKw: 300, vendor: 'High-Density FanWall', fanPowerKw: 18.0 }
        ],
        rdhx: [
            { model: 'Stulz CyberDoor RDHX 35kW', capKw: 35, vendor: 'Stulz', fanPowerKw: 0.65, approachC: 4.5 },
            { model: 'Motivair ChilledDoor 45kW Active RDHX', capKw: 45, vendor: 'Motivair', fanPowerKw: 0.9, approachC: 4.0 },
            { model: 'Vertiv Geist RDHX 60kW (標準)', capKw: 60, vendor: 'Vertiv', fanPowerKw: 1.2, approachC: 4.0 },
            { model: 'High-Density RDHX 80kW MegaDoor', capKw: 80, vendor: 'CoolIT / High-Density', fanPowerKw: 1.6, approachC: 3.5 }
        ],
        pump: [
            { model: 'Grundfos TPE 3.0kW Inverter Pump', capKw: 3.0, vendor: 'Grundfos' },
            { model: 'Grundfos TPE 5.5kW Inverter Pump (標準)', capKw: 5.5, vendor: 'Grundfos' },
            { model: 'Armstrong Design Envelope 11.0kW', capKw: 11.0, vendor: 'Armstrong' },
            { model: 'Wilo IL-E 15.0kW High Efficiency', capKw: 15.0, vendor: 'Wilo' },
            { model: 'Grundfos TPE 22.0kW Mega Flow Pump', capKw: 22.0, vendor: 'Grundfos' },
            { model: 'Armstrong 30.0kW Plant Distribution Pump', capKw: 30.0, vendor: 'Armstrong' }
        ]
    };

    const CatalogManager = {
        catalogs: JSON.parse(JSON.stringify(BUILTIN_VENDOR_CATALOGS)),
        loaded: false,

        async init() {
            const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
            if (isFileProtocol) {
                // file:// 開啟時 fetch() 無法讀取本機 JSON 檔（CORS 限制），改用
                // device_catalog/build_builtin.js 預先內嵌的 device_catalog_builtin.js
                // (window.DEVICE_CATALOG_BUILTIN_RAW)，內容與 device_catalog/*.json 相同。
                this.loadEmbeddedCatalogs();
            } else if (typeof fetch === 'function') {
                try {
                    await this.loadVendorCatalogs();
                } catch (e) {
                    console.log('[CatalogManager] fetch 載入失敗，改用內嵌廠商型錄資料');
                    this.loadEmbeddedCatalogs();
                }
            }
            this.loaded = true;
        },

        loadEmbeddedCatalogs() {
            const raw = (typeof window !== 'undefined') ? window.DEVICE_CATALOG_BUILTIN_RAW : null;
            if (!raw) {
                console.warn('[CatalogManager] 找不到 device_catalog_builtin.js 內嵌資料，使用最小內建型錄');
                return;
            }
            for (const [catKey, dataList] of Object.entries(raw)) {
                for (const data of (dataList || [])) {
                    try {
                        this.mergeVendorData(catKey, data);
                    } catch (_) {}
                }
            }
            console.log('[CatalogManager] 已從內嵌資料 (device_catalog_builtin.js) 合併廠商型錄');
        },

        async loadVendorCatalogs() {
            try {
                const idxResp = await fetch('device_catalog/catalog_index.json');
                if (!idxResp.ok) return;
                const idx = await idxResp.json();

                // Parse vendor files if available
                for (const [catKey, catDef] of Object.entries(idx.categories || {})) {
                    for (const vendor of (catDef.vendors || [])) {
                        try {
                            const r = await fetch('device_catalog/' + vendor.file);
                            if (!r.ok) continue;
                            const data = await r.json();
                            this.mergeVendorData(catKey, data);
                        } catch (_) {}
                    }
                }
                console.log('[CatalogManager] Vendor catalogs successfully merged');
            } catch (e) {
                console.warn('[CatalogManager] Catalog index loading failed, using built-in database:', e);
            }
        },

        upsertItem(catKey, item) {
            if (!this.catalogs[catKey]) this.catalogs[catKey] = [];
            const idx = this.catalogs[catKey].findIndex(x => x.model === item.model);
            if (idx >= 0) {
                this.catalogs[catKey][idx] = { ...this.catalogs[catKey][idx], ...item };
            } else {
                this.catalogs[catKey].push(item);
            }
        },

        mergeVendorData(catKey, data) {
            // Helper to merge parsed objects into our typed catalogs
            if (catKey === 'crac_crah' && data.models) {
                data.models.forEach(m => {
                    this.upsertItem('crah', {
                        model: m.model,
                        capKw: m.capacityKw || 60,
                        vendor: data.manufacturer || 'Vendor',
                        fanPowerKw: m.fanPowerKw || 5.0,
                        ...m
                    });
                });
            } else if (catKey === 'fanwall' && data.models) {
                data.models.forEach(m => {
                    this.upsertItem('crah', {
                        model: m.model,
                        capKw: m.capacityKw || 150,
                        vendor: data.manufacturer || 'FanWall',
                        fanPowerKw: m.fanPowerKw || 10.0,
                        ...m
                    });
                });
            } else if (catKey === 'rdhx') {
                Object.entries(data).forEach(([k, v]) => {
                    if (k !== '_meta') {
                        this.upsertItem('rdhx', {
                            model: v.model || k,
                            capKw: v.cooling_capacity_kw || 45,
                            vendor: v.vendor || 'RDHX',
                            fanPowerKw: v.fan_power_kw || 1.0,
                            approachC: v.approach_temp_c || 4.0,
                            ...v
                        });
                    }
                });
            } else if (catKey === 'chiller') {
                // v31 Phase3: device_catalog/chiller/*.json 用 {model,vendor,chiller_type,
                // cooling_capacity_kw,cop_design,power_input_kw,cop_curve,...} 鍵值物件格式
                // (非 .models 陣列)，依 chiller_type 分流進 chiller_water / chiller_air。
                Object.entries(data).forEach(([k, v]) => {
                    if (k === '_meta' || !v.cooling_capacity_kw) return;
                    const targetCat = (v.chiller_type === 'air_cooled') ? 'chiller_air' : 'chiller_water';
                    this.upsertItem(targetCat, {
                        model: v.model || k,
                        capKw: v.cooling_capacity_kw,
                        vendor: v.vendor || 'Vendor',
                        cop: v.cop_design ?? 5.0,
                        cop_curve: v.cop_curve,
                        iplv: v.iplv,
                        _verified: v._verified ?? false,
                        _source: v._source,
                        ...v
                    });
                });
            } else if (catKey === 'cooling_tower') {
                // device_catalog/cooling_tower/*.json: {model,vendor,heat_rejection_kw,fan_kw_dx,
                // fan_kw_fc,approach_design_c,...}
                Object.entries(data).forEach(([k, v]) => {
                    if (k === '_meta' || !v.heat_rejection_kw) return;
                    this.upsertItem('cooling_tower', {
                        model: v.model || k,
                        capKw: v.heat_rejection_kw,
                        vendor: v.vendor || 'Vendor',
                        fanKwDx: v.fan_kw_dx,
                        fanKwFc: v.fan_kw_fc,
                        approachC: v.approach_design_c ?? 5.0,
                        ...v
                    });
                });
            } else if (catKey === 'dry_cooler') {
                // device_catalog/dry_cooler.json: {category,model,vendor,heat_rejection_kw,
                // approach_temp_c,fan_kw_dx,fan_kw_fc,...}
                Object.entries(data).forEach(([k, v]) => {
                    if (k === '_meta' || !v.heat_rejection_kw) return;
                    this.upsertItem('dry_cooler', {
                        model: v.model || k,
                        capKw: v.heat_rejection_kw,
                        vendor: v.vendor || 'Vendor',
                        fanKwDx: v.fan_kw_dx,
                        fanKwFc: v.fan_kw_fc,
                        approachC: v.approach_temp_c ?? 5.0,
                        ...v
                    });
                });
            } else if (catKey === 'cdu_xdu') {
                // device_catalog/cdu_xdu.json: {category,model,vendor,cooling_capacity_kw,power_kw,...}
                Object.entries(data).forEach(([k, v]) => {
                    if (k === '_meta' || !v.cooling_capacity_kw) return;
                    this.upsertItem('cdu', {
                        model: v.model || k,
                        capKw: v.cooling_capacity_kw,
                        vendor: v.vendor || 'Vendor',
                        powerKw: v.power_kw,
                        ...v
                    });
                });
            } else if (catKey === 'pump') {
                // device_catalog/pump/*.json: {model,vendor,series,capKw(額定馬達功率),
                // design_flow_m3h,design_head_m,motor_efficiency_pct,...}。capKw 對應
                // store.js resolvePumpFromSizing() 目前拿來當 power_kw 用的欄位；
                // design_flow_m3h/design_head_m 先隨資料帶入，供日後真實水力模型使用。
                Object.entries(data).forEach(([k, v]) => {
                    if (k === '_meta' || !v.capKw) return;
                    this.upsertItem('pump', {
                        model: v.model || k,
                        capKw: v.capKw,
                        vendor: v.vendor || 'Vendor',
                        designFlowM3h: v.design_flow_m3h,
                        designHeadM: v.design_head_m,
                        ...v
                    });
                });
            }
        },

        getCatalog(category) {
            return this.catalogs[category] || BUILTIN_VENDOR_CATALOGS[category] || [];
        }
    };

    window.CatalogManager = CatalogManager;
    CatalogManager.init();
})(typeof window !== 'undefined' ? window : global);
