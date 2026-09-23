'use strict';
/**
 * sizing_engine.js - Generic Equipment Sizing and Validation Engine
 * Handles sizing generation, derating calculations, redundancy (N+1),
 * capacity checks, and validation messages for CDU and Fanwall systems.
 */
(function (root) {
    const SizingEngine = {
        generateCduSizing(arch, reqKw, hydKw, helpers = {}) {
            const minCduUnits = Math.max(1, Math.ceil(reqKw / 100));
            const cduCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('cdu') : [
                { model: 'Vertiv XDU 80kW', capKw: 80 },
                { model: 'CoolIT CDU 100kW (標準)', capKw: 100 },
                { model: 'Vertiv XDU 150kW', capKw: 150 },
                { model: 'Airedale CoolTrap CDU 200kW', capKw: 200 }
            ];
            const cduUnit = {
                key: 'cdu_unit',
                label: 'CDU 液冷分配主機 (Cooling Distribution Unit)',
                category: 'CDU',
                catalog: cduCat,
                selectedModel: 'CoolIT CDU 100kW (標準)',
                unitCapKw: 100,
                selectedQty: minCduUnits + 1,
                requiredKw: reqKw,
                requiredUnitsN1: minCduUnits + 1
            };

            const pumpCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('pump') : [
                { model: 'Grundfos CR64 VFD (5.5kW)', capKw: 5.5 },
                { model: 'Grundfos CR120 VFD (11.0kW)', capKw: 11.0 },
                { model: 'Armstrong 4300 VFD (15.0kW)', capKw: 15.0 },
                { model: 'Wilo IL-E Mega (22.0kW)', capKw: 22.0 }
            ];
            const pump = {
                key: 'cdu_pump',
                label: 'CDU Primary Pump 一次側設施循環水泵',
                category: 'Pump',
                catalog: pumpCat,
                selectedModel: 'Grundfos TPE 5.5kW Inverter Pump (標準)',
                unitCapKw: 5.5,
                selectedQty: 3,
                requiredKw: hydKw || 5.5,
                requiredUnitsN1: 3
            };

            const trimChillerCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('chiller_water') : [
                { model: 'Carrier 30XW-500kW Water Chiller (COP 5.8)', capKw: 500, cop: 5.8 },
                { model: 'Trane RTHD 800kW Water Chiller (COP 6.2)', capKw: 800, cop: 6.2 },
                { model: 'York YVWH 1000kW VFD Chiller (COP 6.5)', capKw: 1000, cop: 6.5 }
            ];
            const designCond = (typeof helpers.designConditions === 'function')
                ? helpers.designConditions()
                : (root.AppStore?.designConditions ? root.AppStore.designConditions() : { designDb: 34.0, designWb: 28.0, maxDb: 38.0 });
            const dummyCduSys = { fwsSupplyC: 40.0, fwsReturnC: 55.0, dryCoolerApproachC: 5.0, pheApproachC: 2.0 };
            const opDesign = (typeof helpers.trimOperatingPoint === 'function')
                ? helpers.trimOperatingPoint(dummyCduSys, designCond.designDb)
                : (root.AppStore?.trimOperatingPoint
                    ? root.AppStore.trimOperatingPoint(dummyCduSys, designCond.designDb)
                    : { chiller_fraction: 0.35, tChws: 30, tCewt: 39 });
            const trimReqKw = Math.max(50, Math.round(reqKw * opDesign.chiller_fraction));
            const minTrimUnits = Math.max(1, Math.ceil(trimReqKw / (trimChillerCat[0]?.capKw || 500)));
            const trimChiller = {
                key: 'trim_chiller',
                label: 'In-line Trim Chiller 輔助修整冰機 (NVIDIA Mode 2/3 機械製冷)',
                category: 'Chiller',
                catalog: trimChillerCat,
                selectedModel: trimChillerCat[0]?.model || 'Carrier 30XW-500kW Water Chiller (COP 5.8)',
                unitCapKw: trimChillerCat[0]?.capKw || 500,
                selectedQty: minTrimUnits + 1,
                requiredKw: trimReqKw,
                requiredUnitsN1: minTrimUnits + 1,
                peakRatio: opDesign.chiller_fraction
            };

            if (arch === 'dry_cooler_trim' || arch === 'dry_cooler_hx') {
                const minDryUnits = Math.max(1, Math.ceil(reqKw / 1200));
                const dcCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('dry_cooler') : [
                    { model: 'Güntner 1200kW V-Bank Dry Cooler', capKw: 1200 },
                    { model: 'BAC Trillium 2000kW Closed-Loop', capKw: 2000 },
                    { model: 'Güntner 6000kW Raised-Bed (DSX Standard)', capKw: 6000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'dry_cooler',
                        label: 'Dry Cooler 乾式冷卻器 (零耗水)',
                        category: 'DryCooler',
                        catalog: dcCat,
                        selectedModel: dcCat[0]?.model || 'Güntner 1200kW V-Bank Dry Cooler',
                        unitCapKw: dcCat[0]?.capKw || 1200,
                        selectedQty: minDryUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minDryUnits + 1
                    },
                    pump,
                    trimChiller
                ];
            } else if (arch === 'dry_cooler_pure') {
                const minDryUnits = Math.max(1, Math.ceil(reqKw / 1200));
                const dcCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('dry_cooler') : [
                    { model: 'Güntner 1200kW V-Bank Dry Cooler', capKw: 1200 },
                    { model: 'BAC Trillium 2000kW Closed-Loop', capKw: 2000 },
                    { model: 'Güntner 6000kW Raised-Bed (DSX Standard)', capKw: 6000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'dry_cooler',
                        label: 'Dry Cooler 乾式冷卻器 (純直冷・零冰機)',
                        category: 'DryCooler',
                        catalog: dcCat,
                        selectedModel: dcCat[0]?.model || 'Güntner 1200kW V-Bank Dry Cooler',
                        unitCapKw: dcCat[0]?.capKw || 1200,
                        selectedQty: minDryUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minDryUnits + 1
                    },
                    pump
                ];
            } else if (arch === 'adiabatic_tower') {
                const minAdiaUnits = Math.max(1, Math.ceil(reqKw / 1000));
                const ctCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Series 3000 600kW', capKw: 600 },
                    { model: 'BAC Series 3000 1000kW (標準)', capKw: 1000 },
                    { model: 'BAC VFL-1200 2000kW', capKw: 2000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'adiabatic_tower',
                        label: 'Adiabatic Tower 絕熱噴淋冷卻塔',
                        category: 'AdiabaticTower',
                        catalog: ctCat,
                        selectedModel: ctCat[1]?.model || 'BAC Series 3000 1000kW (標準)',
                        unitCapKw: ctCat[1]?.capKw || 1000,
                        selectedQty: minAdiaUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minAdiaUnits + 1
                    },
                    pump
                ];
            } else if (arch === 'cooling_tower_hx') {
                const minCtUnits = Math.max(1, Math.ceil(reqKw / 1000));
                const ctCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Closed-Circuit FXV 600kW', capKw: 600 },
                    { model: 'BAC Closed-Circuit FXV 1000kW (標準)', capKw: 1000 },
                    { model: 'BAC Closed-Circuit FXV 2000kW', capKw: 2000 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'cooling_tower',
                        label: 'Closed-Circuit Cooling Tower 密閉式冷卻水塔',
                        category: 'CoolingTower',
                        catalog: ctCat,
                        selectedModel: ctCat[1]?.model || 'BAC Closed-Circuit FXV 1000kW (標準)',
                        unitCapKw: ctCat[1]?.capKw || 1000,
                        selectedQty: minCtUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minCtUnits + 1
                    },
                    pump
                ];
            } else if (arch === 'water_chiller') {
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 500));
                const chillerCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('chiller_water') : [
                    { model: 'Carrier 23XRV Variable-Speed Screw 350kW', capKw: 350 },
                    { model: 'Trane RTHD Water-Cooled Screw 500kW (標準)', capKw: 500 },
                    { model: 'York YZ Magnetic Bearing Centrifugal 800kW', capKw: 800 }
                ];
                const ctCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Series 3000 600kW', capKw: 600 },
                    { model: 'BAC Series 3000 1200kW (標準)', capKw: 1200 }
                ];
                return [
                    cduUnit,
                    {
                        key: 'water_cooled_chiller',
                        label: 'Water-Cooled Chiller 水冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerCat,
                        selectedModel: 'Trane RTHD Water-Cooled Screw 500kW (標準)',
                        unitCapKw: 500,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    {
                        key: 'cooling_tower',
                        label: 'Cooling Tower 冰機散熱冷卻水塔',
                        category: 'CoolingTower',
                        catalog: ctCat,
                        selectedModel: 'BAC Series 3000 600kW',
                        unitCapKw: 600,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw * 1.2,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    pump
                ];
            }
            return [cduUnit, pump];
        },

        generateFwSizing(arch, reqKw, pumpPowerKw) {
            const minCrahUnits = Math.max(1, Math.ceil(reqKw / 60));
            const crahCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('crah') : [
                { model: 'Stulz CyberAir 4 CFD 600 A (60kW)', capKw: 60 },
                { model: 'Stulz CyberAir 4 CFD 1000 A (100kW)', capKw: 100 },
                { model: 'Vertiv Liebert PCW 100kW EC Fan', capKw: 100 },
                { model: 'FanWall FW-150-EC (Network/AI Optim 150kW)', capKw: 150 }
            ];
            const crahUnit = {
                key: 'crah_unit',
                label: 'CRAH / Fanwall 機房空調',
                category: 'CRAH',
                catalog: crahCat,
                selectedModel: 'Stulz CyberAir 4 CFD 600 A (60kW)',
                unitCapKw: 60,
                selectedQty: minCrahUnits + 1,
                requiredKw: reqKw,
                requiredUnitsN1: minCrahUnits + 1
            };

            const pumpKw = pumpPowerKw || 5.0;
            const pumpCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('pump') : [
                { model: 'Grundfos TPE 3.0kW Inverter Pump', capKw: 3.0 },
                { model: 'Grundfos TPE 5.5kW Inverter Pump (標準)', capKw: 5.5 },
                { model: 'Armstrong Design Envelope 11.0kW', capKw: 11.0 }
            ];
            const pumpUnit = {
                key: 'fw_pump',
                label: 'Secondary CHW Pump 二次側冰水循環水泵',
                category: 'Pump',
                catalog: pumpCat,
                selectedModel: pumpKw <= 3.5 ? 'Grundfos TPE 3.0kW Inverter Pump' : (pumpKw <= 6.0 ? 'Grundfos TPE 5.5kW Inverter Pump (標準)' : 'Armstrong Design Envelope 11.0kW'),
                unitCapKw: pumpKw <= 3.5 ? 3.0 : (pumpKw <= 6.0 ? 5.5 : 11.0),
                selectedQty: 2, // 1用1備 (N+1)
                requiredKw: pumpKw,
                requiredUnitsN1: 2
            };

            const chillerAirCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('chiller_air') : [
                { model: 'Carrier 30XA 150kW Screw Air-Cooled', capKw: 150 },
                { model: 'Carrier 30XA 300kW Screw Air-Cooled (標準)', capKw: 300 },
                { model: 'York YVAA 500kW VFD Screw Air-Cooled', capKw: 500 }
            ];
            const chillerWaterCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('chiller_water') : [
                { model: 'Carrier 23XRV Variable-Speed Screw 350kW', capKw: 350 },
                { model: 'Trane RTHD Water-Cooled Screw 500kW (標準)', capKw: 500 },
                { model: 'York YZ Magnetic Bearing Centrifugal 800kW', capKw: 800 }
            ];

            if (arch === 'rdhx') {
                const rdhxCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('rdhx') : [
                    { model: 'Stulz CyberDoor RDHX 35kW', capKw: 35 },
                    { model: 'Motivair ChilledDoor 45kW Active RDHX', capKw: 45 },
                    { model: 'Vertiv Geist RDHX 60kW (標準)', capKw: 60 },
                    { model: 'High-Density RDHX 80kW MegaDoor', capKw: 80 }
                ];
                const minRdhxUnits = Math.max(1, Math.ceil(reqKw / 60));
                const rdhxUnit = {
                    key: 'rdhx_unit',
                    label: 'RDHX 背板式熱交換器 (Rear Door HX)',
                    category: 'RDHX',
                    catalog: rdhxCat,
                    selectedModel: 'Vertiv Geist RDHX 60kW (標準)',
                    unitCapKw: 60,
                    selectedQty: minRdhxUnits + 1,
                    requiredKw: reqKw,
                    requiredUnitsN1: minRdhxUnits + 1
                };
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 300));
                return [
                    rdhxUnit,
                    {
                        key: 'air_cooled_chiller',
                        label: 'Air-Cooled Chiller 氣冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerAirCat,
                        selectedModel: 'Carrier 30XA 300kW Screw Air-Cooled (標準)',
                        unitCapKw: 300,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    pumpUnit
                ];
            } else if (arch === 'air_cooled_chiller') {
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 300));
                return [
                    crahUnit,
                    {
                        key: 'air_cooled_chiller',
                        label: 'Air-Cooled Chiller 氣冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerAirCat,
                        selectedModel: 'Carrier 30XA 300kW Screw Air-Cooled (標準)',
                        unitCapKw: 300,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    pumpUnit
                ];
            } else if (arch === 'water_cooled_chiller' || arch === 'water_cooled_chiller_tower') {
                const minChillerUnits = Math.max(1, Math.ceil(reqKw / 400));
                const minCtUnits = Math.max(1, Math.ceil(reqKw * 1.2 / 600));
                const ctCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('cooling_tower') : [
                    { model: 'BAC Series 3000 600kW', capKw: 600 },
                    { model: 'BAC Series 3000 1200kW (標準)', capKw: 1200 }
                ];
                return [
                    crahUnit,
                    {
                        key: 'water_cooled_chiller',
                        label: 'Water-Cooled Chiller 水冷式冰水主機',
                        category: 'Chiller',
                        catalog: chillerWaterCat,
                        selectedModel: 'Trane RTHD Water-Cooled Screw 500kW (標準)',
                        unitCapKw: 500,
                        selectedQty: minChillerUnits + 1,
                        requiredKw: reqKw,
                        requiredUnitsN1: minChillerUnits + 1
                    },
                    {
                        key: 'cooling_tower',
                        label: 'Cooling Tower 冰機散熱冷卻水塔',
                        category: 'CoolingTower',
                        catalog: ctCat,
                        selectedModel: 'BAC Series 3000 600kW',
                        unitCapKw: 600,
                        selectedQty: minCtUnits + 1,
                        requiredKw: reqKw * 1.2,
                        requiredUnitsN1: minCtUnits + 1
                    },
                    pumpUnit
                ];
            } else if (arch === 'chilled_water_plant' || arch === 'campus_chilled_water') {
                const hxCat = (typeof root.CatalogManager !== 'undefined') ? root.CatalogManager.getCatalog('heat_exchanger') : [
                    { model: 'Alfa Laval M10 Plate HX 500kW', capKw: 500 },
                    { model: 'Alfa Laval M15 Plate HX 1000kW (標準)', capKw: 1000 }
                ];
                return [
                    crahUnit,
                    {
                        key: 'plant_decoupler_hx',
                        label: 'Central Plant Decoupler / 廠務冰水介面',
                        category: 'Decoupler',
                        catalog: hxCat,
                        selectedModel: 'Alfa Laval M10 Plate HX 500kW',
                        unitCapKw: 500,
                        selectedQty: 2,
                        requiredKw: reqKw,
                        requiredUnitsN1: 2
                    },
                    pumpUnit
                ];
            }

            return [crahUnit, pumpUnit];
        },

        evaluateCduSizing(cduSys, reqCduKw, designCond, helpers = {}) {
            cduSys.sizing.forEach(s => {
                s.requiredKw = reqCduKw;
                if (s.key === 'cooling_tower' || s.key === 'heat_exchanger') s.requiredKw = reqCduKw * 1.2;
                if (s.key === 'cdu_pump') s.requiredKw = cduSys.hydraulics.pump_power_kw;

                if (s.key === 'trim_chiller') {
                    const opDesign = helpers.trimOperatingPoint
                        ? helpers.trimOperatingPoint(cduSys, designCond.designDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(cduSys, designCond.designDb) : { chiller_fraction: 0.35 });
                    const opMax = helpers.trimOperatingPoint
                        ? helpers.trimOperatingPoint(cduSys, designCond.maxDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(cduSys, designCond.maxDb) : { chiller_fraction: 0.35 });
                    s.peakRatio = opDesign.chiller_fraction;
                    s.requiredKw = Math.max(50, Math.round(reqCduKw * opDesign.chiller_fraction));
                    s.maxMechanicalKw = Math.round(reqCduKw * opMax.chiller_fraction);
                }
                if (s.key === 'dry_cooler') {
                    const opDesign = helpers.trimOperatingPoint
                        ? helpers.trimOperatingPoint(cduSys, designCond.designDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(cduSys, designCond.designDb) : { chiller_fraction: 0.35 });
                    const trimLoadKw = reqCduKw * opDesign.chiller_fraction;
                    const trimItem = (cduSys.sizing || []).find(x => x.key === 'trim_chiller');
                    const trimCop = trimItem?.catalog?.find(c => c.model === trimItem.selectedModel)?.cop || 5.8;
                    const trimDesignPowerKw = trimLoadKw > 0 ? trimLoadKw / trimCop : 0;
                    s.requiredKw = Math.round(reqCduKw + trimDesignPowerKw);
                }

                const curItem = s.catalog.find(c => c.model === s.selectedModel) || s.catalog[0];
                s.unitCapKw = curItem.capKw;

                let derateFactor = 1.0;
                if (s.key === 'cdu_unit' && typeof root.CDUEngine !== 'undefined') {
                    const d = root.CDUEngine.deratedCapacityKW(curItem.capKw, cduSys.fwsSupplyC);
                    derateFactor = d.derate_factor;
                } else if (s.key === 'trim_chiller' && typeof root.ChillerEngine !== 'undefined') {
                    const opDesign = helpers.trimOperatingPoint
                        ? helpers.trimOperatingPoint(cduSys, designCond.designDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(cduSys, designCond.designDb) : {});
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'water_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    const d = root.ChillerEngine.deratedCapacityKW(spec, opDesign.tChws, opDesign.tCewt, designCond.designDb);
                    derateFactor = d.derate_factor;
                } else if (s.key === 'water_cooled_chiller' && typeof root.ChillerEngine !== 'undefined') {
                    const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
                    const towerApp = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
                    const T_cewt = Math.max(minCewt, designCond.designWb + towerApp);
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'water_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    const d = root.ChillerEngine.deratedCapacityKW(spec, cduSys.fwsSupplyC || 40.0, T_cewt, designCond.designDb);
                    derateFactor = d.derate_factor;
                } else if ((s.key === 'cooling_tower' || s.key === 'closed_tower' || s.key === 'adiabatic_tower') && typeof root.CoolingTowerEngine !== 'undefined') {
                    const spec = { heat_rejection_kw: curItem.capKw || curItem.heat_rejection_kw };
                    const d = root.CoolingTowerEngine.deratedCapacityKW(spec, designCond.designWb);
                    derateFactor = d.derate_factor;
                }
                s.derateFactor = Math.round(derateFactor * 1000) / 1000;
                s.requiredUnitsN1 = Math.max(2, Math.ceil(s.requiredKw / (s.unitCapKw * s.derateFactor)) + 1);
                s.effectiveCapKw = Math.round(Math.max(0, s.selectedQty - 1) * s.unitCapKw * s.derateFactor);
                s.passed = (s.effectiveCapKw >= s.requiredKw) && (s.selectedQty >= 2);
                const derateNote = (s.derateFactor < 0.999) ? `（已依設計工況降額 ×${s.derateFactor.toFixed(2)}）` : '';
                s.requiredText = '需求 ≥ ' + s.requiredKw.toFixed(1) + ' kW (N+1 最少 ' + s.requiredUnitsN1 + ' 台)' + derateNote;
                if (s.key === 'cdu_pump') {
                    s.passed = s.selectedQty >= 2 && (s.effectiveCapKw >= s.requiredKw * 0.9);
                    s.requiredText = '水力揚程需求 ' + s.requiredKw + ' kW (2用1備 N+1)';
                }
                if (s.key === 'trim_chiller') {
                    s.maxMechanicalPassed = s.effectiveCapKw >= s.maxMechanicalKw;
                }
            });
        },

        evaluateFwSizing(fwSys, reqAirKw, designCond) {
            fwSys.sizing.forEach(s => {
                s.requiredKw = reqAirKw;
                if (s.key === 'cooling_tower') s.requiredKw = reqAirKw * 1.2;
                if (s.key === 'fw_pump') s.requiredKw = fwSys.hydraulics.pump_power_kw;

                const curItem = s.catalog.find(c => c.model === s.selectedModel) || s.catalog[0];
                s.unitCapKw = curItem.capKw;

                let derateFactor = 1.0;
                if (s.key === 'air_cooled_chiller' && typeof root.ChillerEngine !== 'undefined') {
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'air_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    const d = root.ChillerEngine.deratedCapacityKW(spec, fwSys.chwSupplyC || 12.0, undefined, designCond.designDb);
                    derateFactor = d.derate_factor;
                } else if (s.key === 'water_cooled_chiller' && typeof root.ChillerEngine !== 'undefined') {
                    const minCewt = (typeof root.A === 'function') ? root.A('min_cewt_c') : 16.0;
                    const towerApp = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
                    const T_cewt = Math.max(minCewt, designCond.designWb + towerApp);
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'water_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    const d = root.ChillerEngine.deratedCapacityKW(spec, fwSys.chwSupplyC || 12.0, T_cewt, designCond.designDb);
                    derateFactor = d.derate_factor;
                } else if (s.key === 'cooling_tower' && typeof root.CoolingTowerEngine !== 'undefined') {
                    const spec = { heat_rejection_kw: curItem.capKw || curItem.heat_rejection_kw };
                    const d = root.CoolingTowerEngine.deratedCapacityKW(spec, designCond.designWb);
                    derateFactor = d.derate_factor;
                }
                s.derateFactor = Math.round(derateFactor * 1000) / 1000;
                s.requiredUnitsN1 = Math.max(2, Math.ceil(s.requiredKw / (s.unitCapKw * s.derateFactor)) + 1);
                s.effectiveCapKw = Math.round(Math.max(0, s.selectedQty - 1) * s.unitCapKw * s.derateFactor);
                s.passed = (s.effectiveCapKw >= s.requiredKw) && (s.selectedQty >= 2);
                const derateNote = (s.derateFactor < 0.999) ? `（已依設計工況降額 ×${s.derateFactor.toFixed(2)}）` : '';
                s.requiredText = '需求 ≥ ' + s.requiredKw.toFixed(1) + ' kW (N+1 最少 ' + s.requiredUnitsN1 + ' 台)' + derateNote;
                if (s.key === 'fw_pump') {
                    s.passed = s.selectedQty >= 2 && (s.effectiveCapKw >= s.requiredKw * 0.9);
                    s.requiredText = '二次側水力揚程需求 ' + s.requiredKw + ' kW (2用1備 N+1)';
                }
            });
        },

        validateCdu(cduSys, pipeCduVelocityMps) {
            const cduVelOk = pipeCduVelocityMps >= 1.0 && pipeCduVelocityMps <= 3.0;
            const trimChillerForCheck = cduSys.sizing.find(s => s.key === 'trim_chiller');
            return {
                ok: cduSys.sizing.every(s => s.passed),
                checks: [
                    (cduSys.sizing[0].passed ? '✓' : '✗') + ' CDU 總有效容量 ' + cduSys.sizing[0].effectiveCapKw + ' kW (N-1) ' + (cduSys.sizing[0].passed ? '滿足' : '不足！'),
                    (cduSys.sizing[1] ? ((cduSys.sizing[1].passed ? '✓' : '✗') + ' ' + cduSys.sizing[1].label + ' 有效容量 ' + cduSys.sizing[1].effectiveCapKw + ' kW (N-1) ' + (cduSys.sizing[1].passed ? '滿足' : '不足！')) : ''),
                    (cduVelOk ? '✓' : '⚠') + ' 一次側管路流速 (計算值) ' + pipeCduVelocityMps + ' m/s，建議範圍 1.0~3.0 m/s' + (cduVelOk ? '' : '，建議調整管徑'),
                    trimChillerForCheck ? ((trimChillerForCheck.maxMechanicalPassed ? '✓' : '⚠') + ' Trim Chiller 全機械製冷(Mode 3)最大需求 ' + trimChillerForCheck.maxMechanicalKw + ' kW，N+1可用 ' + trimChillerForCheck.effectiveCapKw + ' kW' + (trimChillerForCheck.maxMechanicalPassed ? '（足夠）' : '（不足！極端高溫時可能超載，實際是否發生請以Dashboard的容量缺口小時數為準）')) : ''
                ]
            };
        },

        validateFw(fwSys, pipeFwVelocityMps) {
            const fwVelOk = pipeFwVelocityMps >= 1.0 && pipeFwVelocityMps <= 3.0;
            return {
                ok: fwSys.sizing.every(s => s.passed),
                checks: [
                    (fwSys.sizing[0] ? ((fwSys.sizing[0].passed ? '✓' : '✗') + ' ' + fwSys.sizing[0].label + ' 有效容量 ' + fwSys.sizing[0].effectiveCapKw + ' kW (N-1) ' + (fwSys.sizing[0].passed ? '滿足' : '不足！')) : ''),
                    (fwSys.sizing[1] ? ((fwSys.sizing[1].passed ? '✓' : '✗') + ' ' + fwSys.sizing[1].label + ' 有效容量 ' + fwSys.sizing[1].effectiveCapKw + ' kW (N-1) ' + (fwSys.sizing[1].passed ? '滿足' : '不足！')) : ''),
                    (fwSys.sizing[2] ? ((fwSys.sizing[2].passed ? '✓' : '✗') + ' ' + fwSys.sizing[2].label + ' 有效容量 ' + fwSys.sizing[2].effectiveCapKw + ' kW (N-1) ' + (fwSys.sizing[2].passed ? '滿足' : '不足！')) : ''),
                    (fwVelOk ? '✓' : '⚠') + ' 二次側管路流速 (計算值) ' + pipeFwVelocityMps + ' m/s，建議範圍 1.0~3.0 m/s' + (fwVelOk ? '' : '，建議調整管徑')
                ].filter(Boolean)
            };
        }
    };

    root.SizingEngine = SizingEngine;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
