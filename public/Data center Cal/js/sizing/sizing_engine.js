'use strict';
/**
 * sizing_engine.js - Generic Equipment Sizing and Validation Engine
 * Handles sizing generation, derating calculations, redundancy (N+1),
 * capacity checks, and validation messages for CDU and Fanwall systems.
 */
(function (root) {
    function getCatalog(category) {
        if (typeof root.CatalogManager !== 'undefined' && typeof root.CatalogManager.getCatalog === 'function') {
            return root.CatalogManager.getCatalog(category) || [];
        }
        return [];
    }

    function getTowerRejectionFactor() {
        if (typeof root.A === 'function' && root.ASSUMPTIONS && root.ASSUMPTIONS.tower_heat_rejection_factor) {
            return root.A('tower_heat_rejection_factor');
        }
        return 1.2;
    }

    const SizingEngine = {
        _createSizingItem(eq, ctx) {
            const cat = getCatalog(eq.catalog);
            const reqKw = (typeof eq.requiredKw === 'function') ? eq.requiredKw(ctx) : ctx.reqKw;

            let selectedModel = '';
            let unitCapKw = eq.defaultUnitCapKw || 100;

            if (typeof eq.selectModel === 'function') {
                const sel = eq.selectModel(cat, ctx);
                selectedModel = sel.model;
                unitCapKw = sel.capKw;
            } else if (eq.defaultModel) {
                selectedModel = eq.defaultModel;
                unitCapKw = eq.defaultUnitCapKw || cat.find(c => c.model === selectedModel)?.capKw || 100;
            } else {
                const idx = eq.defaultModelIndex || 0;
                selectedModel = cat[idx]?.model || '';
                unitCapKw = cat[idx]?.capKw || eq.defaultUnitCapKw || 100;
            }

            let qty = 2;
            let n1 = 2;
            if (typeof eq.calcQty === 'function') {
                const q = eq.calcQty(reqKw, unitCapKw, ctx);
                qty = q.qty;
                n1 = q.n1;
            } else {
                const minUnits = Math.max(1, Math.ceil(reqKw / unitCapKw));
                qty = minUnits + 1;
                n1 = minUnits + 1;
            }

            const item = {
                key: eq.key,
                role: eq.role,
                label: eq.label,
                category: eq.category,
                catalog: cat,
                selectedModel,
                unitCapKw,
                selectedQty: qty,
                requiredKw: reqKw,
                requiredUnitsN1: n1
            };

            if (typeof eq.extraProps === 'function') {
                Object.assign(item, eq.extraProps(ctx, cat, reqKw));
            }

            return item;
        },

        generateCduSizing(arch, reqKw, hydKw, helpers = {}) {
            const archDesc = (arch && arch.equipment)
                ? arch
                : ((typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(arch) : null);
            if (!archDesc || !Array.isArray(archDesc.equipment)) {
                return [];
            }
            const ctx = {
                reqKw,
                hydKw,
                helpers,
                getTowerRejectionFactor,
                isCdu: true
            };
            return archDesc.equipment.map(eq => this._createSizingItem(eq, ctx));
        },

        generateFwSizing(arch, reqKw, pumpPowerKw) {
            const archDesc = (arch && arch.equipment)
                ? arch
                : ((typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(arch) : null);
            if (!archDesc || !Array.isArray(archDesc.equipment)) {
                return [];
            }
            const ctx = {
                reqKw,
                pumpPowerKw,
                getTowerRejectionFactor,
                isFw: true
            };
            return archDesc.equipment.map(eq => this._createSizingItem(eq, ctx));
        },

        evaluateCduSizing(cduSys, reqCduKw, designCond, helpers = {}) {
            cduSys.sizing.forEach(s => {
                s.requiredKw = reqCduKw;
                if (s.key === 'cooling_tower' || s.key === 'heat_exchanger') s.requiredKw = reqCduKw * getTowerRejectionFactor();
                if (s.key === 'cdu_pump') s.requiredKw = cduSys.hydraulics.pump_power_kw;

                if (s.key === 'trim_chiller') {
                    const peakDb = designCond?.peakDb?.value ?? designCond?.maxDb ?? ((designCond?.designDb ?? 34.0) + 3.0);
                    const opPeak = helpers.trimOperatingPoint
                        ? helpers.trimOperatingPoint(cduSys, peakDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(cduSys, peakDb) : { chiller_fraction: 0.35 });
                    s.peakRatio = opPeak.chiller_fraction ?? 0.35;
                    s.requiredKw = Math.max(50, Math.round(reqCduKw * s.peakRatio));
                    s.maxMechanicalKw = Math.round(reqCduKw);
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
                    const peakDb = designCond?.peakDb?.value ?? designCond?.maxDb ?? ((designCond?.designDb ?? 34.0) + 3.0);
                    const opPeak = helpers.trimOperatingPoint
                        ? helpers.trimOperatingPoint(cduSys, peakDb)
                        : (root.AppStore?.trimOperatingPoint ? root.AppStore.trimOperatingPoint(cduSys, peakDb) : {});
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'water_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' }
                    };
                    const d = root.ChillerEngine.deratedCapacityKW(spec, opPeak.tChws, opPeak.tCewt, peakDb);
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
                    const peak = designCond?.peakDb;
                    if (peak && Number.isFinite(peak.value)) {
                        let basisNote = `（選型基準 DB ${peak.value}°C，${peak.basis}）`;
                        if (designCond.dataQualityWarning) {
                            basisNote += ' ⚠ ' + designCond.dataQualityWarning;
                        }
                        s.requiredText += basisNote;
                    }
                }
            });
        },

        evaluateFwSizing(fwSys, reqAirKw, designCond) {
            fwSys.sizing.forEach(s => {
                s.requiredKw = reqAirKw;
                if (s.key === 'cooling_tower') s.requiredKw = reqAirKw * getTowerRejectionFactor();
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

        validateCdu(cduSys, pipeCduVelocityMps, designCond, archDesc) {
            const cduVelOk = pipeCduVelocityMps >= 1.0 && pipeCduVelocityMps <= 3.0;
            const cduArchDesc = archDesc || ((typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(cduSys?.architecture) : null);
            const dCond = designCond || ((typeof root.AppStore !== 'undefined' && root.AppStore.designConditions) ? root.AppStore.designConditions() : { designDb: 35.0, designWb: 28.0 });
            const designWb = dCond?.designWb ?? 28.0;

            const trimChillerForCheck = cduSys.sizing?.find(s => s.key === 'trim_chiller');
            const checks = [
                (cduSys.sizing?.[0]?.passed ? '✓' : '✗') + ' CDU 總有效容量 ' + cduSys.sizing?.[0]?.effectiveCapKw + ' kW (N-1) ' + (cduSys.sizing?.[0]?.passed ? '滿足' : '不足！'),
                (cduSys.sizing?.[1] ? ((cduSys.sizing[1].passed ? '✓' : '✗') + ' ' + cduSys.sizing[1].label + ' 有效容量 ' + cduSys.sizing[1].effectiveCapKw + ' kW (N-1) ' + (cduSys.sizing[1].passed ? '滿足' : '不足！')) : ''),
                (cduVelOk ? '✓' : '⚠') + ' 一次側管路流速 (計算值) ' + pipeCduVelocityMps + ' m/s，建議範圍 1.0~3.0 m/s' + (cduVelOk ? '' : '，建議調整管徑'),
                trimChillerForCheck ? ((trimChillerForCheck.maxMechanicalPassed ? '✓' : '⚠') + ' Trim Chiller 全機械製冷(Mode 3)最大需求 ' + trimChillerForCheck.maxMechanicalKw + ' kW，N+1可用 ' + trimChillerForCheck.effectiveCapKw + ' kW' + (trimChillerForCheck.maxMechanicalPassed ? '（足夠）' : '（不足！極端高溫時可能超載，實際是否發生請以Dashboard的容量缺口小時數為準）')) : ''
            ];

            // Q-1: Trim chiller CEWT envelope check at extreme/peak heat conditions
            if (trimChillerForCheck) {
                const peakDb = dCond?.peakDb?.value ?? dCond?.maxDb ?? ((dCond?.designDb ?? 34.0) + 3.0);
                const opPeak = (root.AppStore?.trimOperatingPoint) ? root.AppStore.trimOperatingPoint(cduSys, peakDb) : {};
                if (opPeak && typeof opPeak.tCewt === 'number') {
                    const curItem = trimChillerForCheck.catalog?.find(c => c.model === trimChillerForCheck.selectedModel) || trimChillerForCheck.catalog?.[0] || {};
                    let limit = (typeof root.A === 'function') ? root.A('chiller_max_cewt_standard_c') : 45.0;
                    const htLimit = (typeof root.A === 'function') ? root.A('chiller_max_cewt_hightemp_c') : 60.0;
                    if (typeof curItem.max_cewt_c === 'number') {
                        limit = curItem.max_cewt_c;
                    } else {
                        const cat = `${curItem.category || ''} ${curItem.model || ''} ${curItem.name || ''}`.toLowerCase();
                        if (cat.includes('high temp') || cat.includes('heat pump') || cat.includes('heat-pump')) {
                            limit = htLimit;
                        }
                    }
                    if (opPeak.tCewt > limit) {
                        checks.push(`⚠ 極端熱工況冷凝進水 ${opPeak.tCewt.toFixed(1)}°C 超過所選冰機運轉上限 ${limit.toFixed(1)}°C，需選用高溫型冰機`);
                    }
                }
            }

            // P4-6: R-f D5 warning for water_chiller
            const isWaterChiller = cduArchDesc?.id === 'water_chiller' || cduSys?.architecture === 'water_chiller' || !!cduArchDesc?.flags?.isWaterChiller;
            if (isWaterChiller) {
                const towerApp = (typeof root.A === 'function') ? root.A('tower_approach_c') : 4.0;
                const hasPhe = cduSys?.hasPhe ?? false;
                const pheApp = cduSys?.pheApproachC ?? 2.0;
                const fwsSupplyC = cduSys?.fwsSupplyC ?? 40.0;
                if ((designWb + towerApp + (hasPhe ? pheApp : 0)) < fwsSupplyC) {
                    checks.push('⚠ 設計濕球 + 塔 approach 已低於 FWS 供水溫，冷卻水塔可直接供冷；建議改用閉式塔或加裝水側經濟器');
                }
            }

            // Y-3: pure dry cooler warning when peakDb + dcApproach + pheApproach > fwsSupplyC
            const isDryCoolerPure = cduArchDesc?.id === 'dry_cooler_pure' || cduSys?.architecture === 'dry_cooler_pure';
            if (isDryCoolerPure) {
                const peak = dCond?.peakDb;
                const peakVal = peak?.value ?? dCond?.maxDb;
                if (peakVal != null && Number.isFinite(peakVal)) {
                    const dcApproach = cduSys?.dryCoolerApproachC ?? 5.0;
                    const hasPhe = cduSys?.hasPhe !== undefined ? !!cduSys.hasPhe : true;
                    const pheApproach = hasPhe ? (cduSys?.pheApproachC ?? 2.0) : 0.0;
                    const fwsSupplyC = cduSys?.fwsSupplyC ?? 40.0;
                    const tSupplyPeak = peakVal + dcApproach + pheApproach;
                    if (tSupplyPeak > fwsSupplyC) {
                        checks.push(`⚠ ASHRAE 尖峰乾球 ${peakVal}°C 時 FWS 供水將升至 ${tSupplyPeak.toFixed(1)}°C（超出設計 ${fwsSupplyC}°C），純乾冷器無機械備援`);
                    }
                }
            }

            return {
                ok: (cduSys.sizing || []).every(s => s.passed),
                checks: checks.filter(Boolean)
            };
        },

        validateFw(fwSys, pipeFwVelocityMps, archDesc) {
            const fwVelOk = pipeFwVelocityMps >= 1.0 && pipeFwVelocityMps <= 3.0;
            const fwArchDesc = archDesc || ((typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(fwSys?.architecture) : null);
            const sizing = fwSys?.sizing || [];
            const checks = [
                (sizing[0] ? ((sizing[0].passed ? '✓' : '✗') + ' ' + sizing[0].label + ' 有效容量 ' + sizing[0].effectiveCapKw + ' kW (N-1) ' + (sizing[0].passed ? '滿足' : '不足！')) : ''),
                (sizing[1] ? ((sizing[1].passed ? '✓' : '✗') + ' ' + sizing[1].label + ' 有效容量 ' + sizing[1].effectiveCapKw + ' kW (N-1) ' + (sizing[1].passed ? '滿足' : '不足！')) : ''),
                (sizing[2] ? ((sizing[2].passed ? '✓' : '✗') + ' ' + sizing[2].label + ' 有效容量 ' + sizing[2].effectiveCapKw + ' kW (N-1) ' + (sizing[2].passed ? '滿足' : '不足！')) : ''),
                (fwVelOk ? '✓' : '⚠') + ' 二次側管路流速 (計算值) ' + pipeFwVelocityMps + ' m/s，建議範圍 1.0~3.0 m/s' + (fwVelOk ? '' : '，建議調整管徑')
            ];
            if (fwArchDesc?.flags?.isRdhx) {
                const roomDb = fwSys?.roomDbC;
                const roomRh = fwSys?.roomRhPct;
                const marginK = (typeof root.A === 'function') ? root.A('rdhx_dewpoint_margin_k') : 2.0;
                let dp, source;
                if (roomDb !== null && roomDb !== undefined && roomRh !== null && roomRh !== undefined && Number.isFinite(Number(roomDb)) && Number.isFinite(Number(roomRh))) {
                    const calcDp = (typeof root.calcDewPointC === 'function') ? root.calcDewPointC : (typeof calcDewPointC === 'function' ? calcDewPointC : null);
                    dp = calcDp ? calcDp(Number(roomDb), Number(roomRh)) : 15.0;
                    source = `機房 ${Number(roomDb)}°C / ${Number(roomRh)}%`;
                } else {
                    dp = (typeof root.A === 'function') ? root.A('rdhx_default_room_dp_c') : 15.0;
                    source = 'ASHRAE TC9.9 預設';
                }
                const limit = dp + marginK;
                const chwSup = fwSys?.chwSupplyC ?? 12.0;
                if (chwSup < limit) {
                    checks.push(`⚠ RDHX 供水 ${chwSup.toFixed(1)}°C 低於結露保護溫度 ${limit.toFixed(1)}°C（機房露點 ${dp.toFixed(1)}°C，${source}），有結露風險`);
                }
            }
            return {
                ok: sizing.every(s => s.passed),
                checks: checks.filter(Boolean)
            };
        }
    };

    root.SizingEngine = SizingEngine;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
