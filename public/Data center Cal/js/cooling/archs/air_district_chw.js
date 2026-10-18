'use strict';
/**
 * air_district_chw.js - Campus / District Chilled Water Supply Network
 */
(function (root) {
    const CoolingArchRegistry = root.CoolingArchRegistry;
    const CoolingStages = root.CoolingStages;
    if (!CoolingArchRegistry || !CoolingStages) {
        throw new Error('CoolingArchRegistry and CoolingStages must be loaded before air_district_chw.js');
    }
    const t = (k, p, fb) => (root.I18N ? root.I18N.t(k, p) : (fb || k));

    CoolingArchRegistry.register({
        id: 'chilled_water_plant',
        aliases: ['campus_chilled_water'],
        loop: 'air',
        get optionLabel() { return t('arch.chilled_water_plant.option', null, '🏢 廠區集中冰水管網 (Central Chilled Water Plant)'); },
        get cardLabel() { return t('arch.chilled_water_plant.card', null, '廠區集中冰水'); },
        get pillLabel() { return t('arch.chilled_water_plant.pill', null, '廠區冰水'); },
        get dashboardLabel() { return t('arch.chilled_water_plant.dashboard', null, '廠區集中冷站 (Chilled Water Plant)'); },
        flags: { hasMechanical: true, consumesWater: false, isDistrict: true },
        terminal: 'crah',
        schematic: 'air_plant',
        params: [],
        equipment: [
            {
                key: 'crah_unit',
                get label() { return t('equip.crah_unit', null, 'CRAH / Fanwall 機房空調'); },
                category: 'CRAH',
                catalog: 'crah',
                role: 'terminal',
                resolver: 'crah',
                defaultModel: 'Stulz CyberAir 4 CFD 600 A (60kW)',
                defaultUnitCapKw: 60,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: (reqKw, cap) => {
                    const minUnits = Math.max(1, Math.ceil(reqKw / 60));
                    return { qty: minUnits + 1, n1: minUnits + 1 };
                }
            },
            {
                key: 'plant_decoupler_hx',
                get label() { return t('equip.plant_decoupler_hx', null, 'Central Plant Decoupler / 廠務冰水介面'); },
                category: 'Decoupler',
                catalog: 'heat_exchanger',
                role: 'decoupler',
                defaultModel: 'Alfa Laval M10 Plate HX 500kW',
                defaultUnitCapKw: 500,
                requiredKw: (ctx) => ctx.reqKw,
                calcQty: () => ({ qty: 2, n1: 2 })
            },
            {
                key: 'fw_pump',
                get label() { return t('equip.fw_pump', null, 'Secondary CHW Pump 二次側冰水循環水泵'); },
                category: 'Pump',
                catalog: 'pump',
                role: 'pump',
                requiredKw: (ctx) => ctx.pumpPowerKw || 5.0,
                selectModel: (cat, ctx) => {
                    const pumpKw = ctx.pumpPowerKw || 5.0;
                    const model = pumpKw <= 3.5 ? 'Grundfos TPE 3.0kW Inverter Pump' : (pumpKw <= 6.0 ? 'Grundfos TPE 5.5kW Inverter Pump (標準)' : 'Armstrong Design Envelope 11.0kW');
                    const capKw = pumpKw <= 3.5 ? 3.0 : (pumpKw <= 6.0 ? 5.5 : 11.0);
                    return { model, capKw };
                },
                calcQty: () => ({ qty: 2, n1: 2 })
            }
        ],

        operatingPoint(sys, w, equip) {
            const chwSupplyC = sys?.chwSupplyC ?? 12.0;
            const chwReturnC = sys?.chwReturnC ?? 18.0;
            return {
                mode: 'mechanical',
                fc_fraction: 0.0,
                chiller_fraction: 1.0,
                chwSupplyC,
                chwReturnC,
                temps: { chwSup: chwSupplyC, chwRet: chwReturnC, districtSup: chwSupplyC - 2.0, districtRet: chwReturnC },
                thresholds: { basis: 'none', full: null, mech: null }
            };
        },

        topology(sys, op, design, extra) {
            if (!op) op = this.operatingPoint(sys, { db: design?.designDb ?? 35.0, wb: design?.designWb ?? 28.0 });
            const chwSup = op?.temps?.chwSup ?? sys?.chwSupplyC ?? 12.0;
            const chwRet = op?.temps?.chwRet ?? sys?.chwReturnC ?? 18.0;
            const distSup = op?.temps?.districtSup ?? (chwSup - 2.0);
            const A = (k) => root.AppStore?.getAssumption ? root.AppStore.getAssumption(k) : (root.ASSUMPTIONS?.[k]?.val ?? 5.5);
            const distCop = A('district_chw_cop') || 5.5;
            return {
                title: t('topo.districtCooling', null, '市政區域冰水排熱拓樸'),
                referenceLabel: null,
                banners: [
                    { id: 'mode1', label: t('topo.districtSupply', null, '區域市政冷源供應 (District Cooling)'), detail: t('topo.districtSupplyDetail', null, '全時連續供應穩定冰水'), tone: 'teal' }
                ],
                nodes: [
                    {
                        id: 'crah',
                        kind: 'crah',
                        title: 'Compute Data Hall (CRAH)',
                        lines: [
                            t('topo.crahAirUnit', null, 'CRAH 氣冷機組'),
                            t('topo.crahSupplyReturn', { sup: chwSup, ret: chwRet }, `供回水: ${chwSup} ⇄ ${chwRet}°C`)
                        ]
                    },
                    {
                        id: 'evaporator',
                        kind: 'hx',
                        title: t('topo.districtPhe', null, '板式熱交換器 (District PHE)'),
                        lines: [
                            t('topo.districtPheLine1', null, '一二次側物理水質隔離'),
                            t('topo.evapSupplyReturn', { sup: chwSup, ret: chwRet }, `供水 ${chwSup}°C ⇄ 回水 ${chwRet}°C`),
                            t('topo.districtPheLine3', null, '廠內無需建置冷卻水塔與冰機'),
                            t('topo.districtPheLine4', null, '合約保證供水水溫與流量')
                        ]
                    },
                    {
                        id: 'heat_rejection',
                        kind: 'district',
                        title: t('topo.districtPlant', null, '市政/園區中央冷源站 (District Plant)'),
                        lines: [
                            t('topo.districtPlantLine1', null, '大型中央冷能集中製造與配送'),
                            t('topo.districtPlantLine2', { sup: distSup, ret: chwRet }, `市政供水 ${distSup}°C ⇄ 回水 ${chwRet}°C`),
                            t('topo.districtPlantLine3', { cop: distCop.toFixed(1) }, `合約等效 COP: ${distCop.toFixed(1)} (園區基準)`),
                            t('topo.districtPlantLine4', null, '超大型離心機組與深層水源熱泵'),
                            t('topo.districtPlantLine5', null, '園區級能源調度與蓄冷槽削峰')
                        ]
                    },
                    {
                        id: 'pump',
                        kind: 'pump',
                        title: 'Secondary CHW Pump',
                        lines: [t('topo.secChwPump', null, '二次側冰水循環泵')]
                    }
                ],
                pipes: [
                    { from: 'crah', to: 'evaporator', label: `${chwRet}°C`, tone: 'hot' },
                    { from: 'evaporator', to: 'crah', label: `${chwSup}°C`, tone: 'cold' },
                    { from: 'evaporator', to: 'heat_rejection', label: `${chwRet}°C`, tone: 'hot' },
                    { from: 'heat_rejection', to: 'evaporator', label: `${distSup}°C`, tone: 'cold' }
                ],
                footer: [],
                warnings: [],
                op
            };
        },

        simulateHour(ctx) {
            const Q_kw = ctx.Q_kw || 0;
            if (Q_kw <= 0) {
                return (typeof root.CoolingArchHelpers !== 'undefined')
                    ? root.CoolingArchHelpers.emptyHourResult('mechanical')
                    : {
                        terminalKw: 0,
                        pumpKw: 0,
                        fanKw: 0,
                        compressorKw: 0,
                        waterM3: 0,
                        mode: 'mechanical',
                        deficitKw: 0,
                        heatRemovedKw: 0,
                        mechLoadKw: 0,
                        diag: {}
                    };
            }

            const op = this.operatingPoint(ctx.sys, ctx.w, ctx.equip);
            const distStage = CoolingStages.get('district_chw');
            const distRes = distStage.simulate(ctx);

            return {
                terminalKw: ctx.terminalKw || 0,
                pumpKw: ctx.pumpKw || 0,
                fanKw: 0,
                compressorKw: distRes.compressorKw,
                waterM3: 0,
                mode: op.mode,
                deficitKw: 0,
                heatRemovedKw: Q_kw,
                mechLoadKw: Q_kw,
                op,
                diag: { distRes }
            };
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
