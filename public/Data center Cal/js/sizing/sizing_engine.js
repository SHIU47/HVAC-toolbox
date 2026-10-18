'use strict';
/**
 * sizing_engine.js - Generic Equipment Sizing and Validation Engine
 * Handles sizing generation, derating calculations, redundancy (N+1),
 * capacity checks, and validation messages for CDU and Fanwall systems.
 */
(function (root) {
    const t = (k, p, fb) => (root.I18N ? root.I18N.t(k, p) : (fb || k));

    function getCatalog(category) {
        if (typeof root.CatalogManager !== 'undefined' && typeof root.CatalogManager.getCatalog === 'function') {
            return root.CatalogManager.getCatalog(category) || [];
        }
        return [];
    }

    function getTowerRejectionFactor(sys) {
        if (sys && Array.isArray(sys.sizing)) {
            const chillerItem = sys.sizing.find(s => s.key === 'water_cooled_chiller' || s.key === 'trim_chiller');
            if (chillerItem) {
                const catChiller = (chillerItem.catalog || []).find(c => c.model === chillerItem.selectedModel);
                const cop = catChiller?.cop ?? catChiller?.cop_design;
                if (typeof cop === 'number' && cop > 0) {
                    return 1 + (1 / cop);
                }
            }
        }
        if (typeof root.A === 'function' && root.ASSUMPTIONS && root.ASSUMPTIONS.tower_heat_rejection_factor) {
            return root.A('tower_heat_rejection_factor');
        }
        return 1.2;
    }

    const SizingEngine = {
        standbyUnits(qty, redundancy) {
            const r = redundancy || 'N+1';
            if (r === 'N') return 0;
            if (r === 'N+1') return 1;
            if (r === 'N+2') return 2;
            if (r === '2N') return Math.ceil((Number(qty) || 0) / 2);
            return 1;
        },

        runningQty(qty, redundancy) {
            const q = Number(qty) || 0;
            return Math.max(1, q - this.standbyUnits(q, redundancy));
        },

        requiredQty(reqKw, unitCapKw, derate, redundancy) {
            const r = redundancy || 'N+1';
            const effUnitCap = (unitCapKw || 100) * (derate || 1.0);
            const baseN = Math.max(1, Math.ceil((reqKw || 0) / effUnitCap));
            if (r === 'N') return baseN;
            if (r === 'N+1') return baseN + 1;
            if (r === 'N+2') return baseN + 2;
            if (r === '2N') return 2 * baseN;
            return baseN + 1;
        },

        minAllowedQty(redundancy) {
            const r = redundancy || 'N+1';
            if (r === 'N') return 1;
            if (r === 'N+2') return 3;
            return 2; // 'N+1' and '2N'
        },

        standbyLabel(redundancy) {
            const r = redundancy || 'N+1';
            if (r === 'N') return 'N';
            if (r === 'N+1') return 'N-1';
            if (r === 'N+2') return 'N-2';
            if (r === '2N') return '2N';
            return 'N-1';
        },

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
                category: eq.category,
                catalog: cat,
                selectedModel,
                unitCapKw,
                selectedQty: qty,
                requiredKw: reqKw,
                requiredUnitsN1: n1,
                userEdited: false,
                redundancy: ctx?.defaultRedundancy || 'N+1',
                runMode: 'standby'
            };

            Object.defineProperty(item, 'label', {
                get() { return this._customLabel || (typeof eq.label === 'function' ? eq.label() : eq.label); },
                set(v) { this._customLabel = v; },
                enumerable: true,
                configurable: true
            });

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
                cwPumpKw: helpers?.cwPumpKw || 0,
                helpers,
                getTowerRejectionFactor: (s) => getTowerRejectionFactor(s),
                isCdu: true
            };
            return archDesc.equipment.map(eq => this._createSizingItem(eq, ctx));
        },

        generateFwSizing(arch, reqKw, pumpPowerKw, helpers = {}) {
            const archDesc = (arch && arch.equipment)
                ? arch
                : ((typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(arch) : null);
            if (!archDesc || !Array.isArray(archDesc.equipment)) {
                return [];
            }
            const ctx = {
                reqKw,
                pumpPowerKw,
                cwPumpKw: helpers?.cwPumpKw || 0,
                helpers,
                getTowerRejectionFactor: (s) => getTowerRejectionFactor(s),
                isFw: true
            };
            return archDesc.equipment.map(eq => this._createSizingItem(eq, ctx));
        },

        evaluateCduSizing(cduSys, reqCduKw, designCond, helpers = {}) {
            cduSys.sizing.forEach(s => {
                s.requiredKw = reqCduKw;
                if (s.key === 'cooling_tower' || s.key === 'heat_exchanger') s.requiredKw = reqCduKw * getTowerRejectionFactor(cduSys);
                if (s.key === 'cdu_pump') s.requiredKw = cduSys.hydraulics?.pump_power_kw || 0;
                if (s.key === 'cw_pump') s.requiredKw = cduSys.hydraulics?.cw_pump_power_kw || 0;

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

                const curItem = (s.catalog && Array.isArray(s.catalog))
                    ? (s.catalog.find(c => c.model === s.selectedModel) || s.catalog[0] || { capKw: s.unitCapKw || 100 })
                    : { capKw: s.unitCapKw || 100 };
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
                const red = s.redundancy || 'N+1';
                s.redundancy = red;
                if (!s.runMode) s.runMode = 'standby';
                s.requiredUnits = SizingEngine.requiredQty(s.requiredKw, s.unitCapKw, s.derateFactor, red);
                s.requiredUnitsN1 = s.requiredUnits;
                if (!s.userEdited && s.selectedQty < s.requiredUnits) s.selectedQty = s.requiredUnits;
                const standby = SizingEngine.standbyUnits(s.selectedQty, red);
                const activeUnits = Math.max(0, (s.selectedQty || 0) - standby);
                s.effectiveCapKw = Math.round(activeUnits * s.unitCapKw * s.derateFactor);
                const minUnits = SizingEngine.minAllowedQty(red);
                s.passed = (s.effectiveCapKw >= s.requiredKw) && (s.selectedQty >= minUnits);
                const derateNote = (s.derateFactor < 0.999) ? t('sizing.derateNote', { factor: s.derateFactor.toFixed(2) }) : '';
                s.requiredText = (red === 'N+1')
                    ? t('sizing.requiredN1', { reqKw: s.requiredKw.toFixed(1), n1: s.requiredUnits, derateNote })
                    : t('sizing.requiredWithRedundancy', { reqKw: s.requiredKw.toFixed(1), redundancy: red, minUnits: s.requiredUnits, derateNote });
                if (s.key === 'cdu_pump' || s.key === 'cw_pump') {
                    s.effectiveCapKw = Math.round(activeUnits * s.unitCapKw * s.derateFactor);
                    const isMotorDeficit = s.requiredKw > s.effectiveCapKw;
                    s.passed = (s.selectedQty >= minUnits) && !isMotorDeficit;
                    const pfx = (s.key === 'cw_pump') ? t('sizing.cwPumpHydDemand') : t('sizing.pumpHydDemand');
                    const minUnitsStr = (red === 'N+1')
                        ? ((root.I18N && root.I18N.lang === 'en') ? ` (N+1 Min ${s.requiredUnits} units)` : ` (N+1 最少 ${s.requiredUnits} 台)`)
                        : t('sizing.minUnitsWithRedundancy', { redundancy: red, minUnits: s.requiredUnits });
                    s.requiredText = pfx + s.requiredKw.toFixed(1) + ' kW' + minUnitsStr + (isMotorDeficit ? t('sizing.motorDeficit') : '');
                }
                if (s.key === 'trim_chiller') {
                    s.maxMechanicalPassed = s.effectiveCapKw >= s.maxMechanicalKw;
                    const peak = designCond?.peakDb;
                    if (peak && Number.isFinite(peak.value)) {
                        let basisNote = t('sizing.basisNote', { db: peak.value, basis: peak.basis });
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
                if (s.key === 'cooling_tower') s.requiredKw = reqAirKw * getTowerRejectionFactor(fwSys);
                if (s.key === 'fw_pump') s.requiredKw = fwSys.hydraulics?.pump_power_kw || 0;
                if (s.key === 'cw_pump') s.requiredKw = fwSys.hydraulics?.cw_pump_power_kw || 0;

                const curItem = (s.catalog && Array.isArray(s.catalog))
                    ? (s.catalog.find(c => c.model === s.selectedModel) || s.catalog[0] || { capKw: s.unitCapKw || 100 })
                    : { capKw: s.unitCapKw || 100 };
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
                const red = s.redundancy || 'N+1';
                s.redundancy = red;
                if (!s.runMode) s.runMode = 'standby';
                s.requiredUnits = SizingEngine.requiredQty(s.requiredKw, s.unitCapKw, s.derateFactor, red);
                s.requiredUnitsN1 = s.requiredUnits;
                if (!s.userEdited && s.selectedQty < s.requiredUnits) s.selectedQty = s.requiredUnits;
                const standby = SizingEngine.standbyUnits(s.selectedQty, red);
                const activeUnits = Math.max(0, (s.selectedQty || 0) - standby);
                s.effectiveCapKw = Math.round(activeUnits * s.unitCapKw * s.derateFactor);
                const minUnits = SizingEngine.minAllowedQty(red);
                s.passed = (s.effectiveCapKw >= s.requiredKw) && (s.selectedQty >= minUnits);
                const derateNote = (s.derateFactor < 0.999) ? t('sizing.derateNote', { factor: s.derateFactor.toFixed(2) }) : '';
                s.requiredText = (red === 'N+1')
                    ? t('sizing.requiredN1', { reqKw: s.requiredKw.toFixed(1), n1: s.requiredUnits, derateNote })
                    : t('sizing.requiredWithRedundancy', { reqKw: s.requiredKw.toFixed(1), redundancy: red, minUnits: s.requiredUnits, derateNote });
                if (s.key === 'fw_pump' || s.key === 'cw_pump') {
                    s.effectiveCapKw = Math.round(activeUnits * s.unitCapKw * s.derateFactor);
                    const isMotorDeficit = s.requiredKw > s.effectiveCapKw;
                    s.passed = (s.selectedQty >= minUnits) && !isMotorDeficit;
                    const pfx = (s.key === 'cw_pump') ? t('sizing.cwPumpHydDemand') : t('sizing.fwPumpHydDemand');
                    const minUnitsStr = (red === 'N+1')
                        ? ((root.I18N && root.I18N.lang === 'en') ? ` (N+1 Min ${s.requiredUnits} units)` : ` (N+1 最少 ${s.requiredUnits} 台)`)
                        : t('sizing.minUnitsWithRedundancy', { redundancy: red, minUnits: s.requiredUnits });
                    s.requiredText = pfx + s.requiredKw.toFixed(1) + ' kW' + minUnitsStr + (isMotorDeficit ? t('sizing.motorDeficit') : '');
                }
            });
        },

        validateCdu(cduSys, pipeCduVelocityMps, designCond, archDesc) {
            const cduVelOk = pipeCduVelocityMps >= 1.0 && pipeCduVelocityMps <= 3.0;
            const cduArchDesc = archDesc || ((typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(cduSys?.architecture) : null);
            const dCond = designCond || ((typeof root.AppStore !== 'undefined' && root.AppStore.designConditions) ? root.AppStore.designConditions() : { designDb: 35.0, designWb: 28.0 });
            const designWb = dCond?.designWb ?? 28.0;

            const trimChillerForCheck = cduSys.sizing?.find(s => s.key === 'trim_chiller');
            const hasTerminal = (cduSys.sizing || []).some(s => s.role === 'terminal' || s.key === 'cdu_unit');
            const checks = [];
            if (hasTerminal) {
                checks.push(
                    t('sizing.checkCduCap', {
                        mark: cduSys.sizing?.[0]?.passed ? '✓' : '✗',
                        cap: cduSys.sizing?.[0]?.effectiveCapKw,
                        status: cduSys.sizing?.[0]?.passed ? t('sizing.statusOk') : t('sizing.statusFail')
                    }),
                    cduSys.sizing?.[1] ? t('sizing.checkItemCap', {
                        mark: cduSys.sizing[1].passed ? '✓' : '✗',
                        label: cduSys.sizing[1].label,
                        cap: cduSys.sizing[1].effectiveCapKw,
                        status: cduSys.sizing[1].passed ? t('sizing.statusOk') : t('sizing.statusFail')
                    }) : ''
                );
            } else {
                (cduSys.sizing || []).forEach(item => {
                    checks.push(t('sizing.checkItemCap', {
                        mark: item.passed ? '✓' : '✗',
                        label: item.label,
                        cap: item.effectiveCapKw,
                        status: item.passed ? t('sizing.statusOk') : t('sizing.statusFail')
                    }));
                });
            }
            checks.push(
                t('sizing.checkCduVelocity', {
                    mark: cduVelOk ? '✓' : '⚠',
                    vel: pipeCduVelocityMps,
                    advice: cduVelOk ? '' : t('sizing.adjustPipeDia')
                }),
                trimChillerForCheck ? t('sizing.checkTrimMode3', {
                    mark: trimChillerForCheck.maxMechanicalPassed ? '✓' : '⚠',
                    req: trimChillerForCheck.maxMechanicalKw,
                    avail: trimChillerForCheck.effectiveCapKw,
                    note: trimChillerForCheck.maxMechanicalPassed ? t('sizing.trimAdequate') : t('sizing.trimInadequate')
                }) : ''
            );

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
                        checks.push(t('sizing.warnTrimCewt', { cewt: opPeak.tCewt.toFixed(1), limit: limit.toFixed(1) }));
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
                    checks.push(t('sizing.warnTowerApproach'));
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
                        checks.push(t('sizing.warnPureDcPeak', { peak: peakVal, tSupply: tSupplyPeak.toFixed(1), design: fwsSupplyC }));
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
                sizing[0] ? t('sizing.checkItemCap', {
                    mark: sizing[0].passed ? '✓' : '✗',
                    label: sizing[0].label,
                    cap: sizing[0].effectiveCapKw,
                    status: sizing[0].passed ? t('sizing.statusOk') : t('sizing.statusFail')
                }) : '',
                sizing[1] ? t('sizing.checkItemCap', {
                    mark: sizing[1].passed ? '✓' : '✗',
                    label: sizing[1].label,
                    cap: sizing[1].effectiveCapKw,
                    status: sizing[1].passed ? t('sizing.statusOk') : t('sizing.statusFail')
                }) : '',
                sizing[2] ? t('sizing.checkItemCap', {
                    mark: sizing[2].passed ? '✓' : '✗',
                    label: sizing[2].label,
                    cap: sizing[2].effectiveCapKw,
                    status: sizing[2].passed ? t('sizing.statusOk') : t('sizing.statusFail')
                }) : '',
                t('sizing.checkFwVelocity', {
                    mark: fwVelOk ? '✓' : '⚠',
                    vel: pipeFwVelocityMps,
                    advice: fwVelOk ? '' : t('sizing.adjustPipeDia')
                })
            ];
            if (fwArchDesc?.flags?.isRdhx) {
                const roomDb = fwSys?.roomDbC;
                const roomRh = fwSys?.roomRhPct;
                const marginK = (typeof root.A === 'function') ? root.A('rdhx_dewpoint_margin_k') : 2.0;
                let dp, source;
                if (roomDb !== null && roomDb !== undefined && roomRh !== null && roomRh !== undefined && Number.isFinite(Number(roomDb)) && Number.isFinite(Number(roomRh))) {
                    const calcDp = (typeof root.calcDewPointC === 'function') ? root.calcDewPointC : (typeof calcDewPointC === 'function' ? calcDewPointC : null);
                    dp = calcDp ? calcDp(Number(roomDb), Number(roomRh)) : 15.0;
                    source = t('sizing.rdhxRoomCond', { db: Number(roomDb), rh: Number(roomRh) });
                } else {
                    dp = (typeof root.A === 'function') ? root.A('rdhx_default_room_dp_c') : 15.0;
                    source = t('sizing.rdhxAshraeDefault');
                }
                const limit = dp + marginK;
                const chwSup = fwSys?.chwSupplyC ?? 12.0;
                if (chwSup < limit) {
                    checks.push(t('sizing.warnRdhxCondensation', { sup: chwSup.toFixed(1), limit: limit.toFixed(1), dp: dp.toFixed(1), source }));
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
