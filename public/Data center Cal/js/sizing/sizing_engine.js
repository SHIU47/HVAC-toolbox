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
        if (!sys) return 1.0;
        const arch = sys.architecture;
        const archDesc = (typeof root.CoolingArchRegistry !== 'undefined' && arch) ? root.CoolingArchRegistry.get(arch) : null;

        // 零冰機純自然冷卻架構 (例如 cooling_tower_hx 密閉式冷卻水塔)：無主機壓縮機耗電轉化之廢熱，排熱係數為 1.0
        if (archDesc?.flags?.isClosedTower || archDesc?.flags?.hasMechanical === false) {
            return 1.0;
        }

        // 若系統包含水冷冰機或修整冰機，冷卻塔需帶走蒸發器吸熱 + 壓縮機耗電功: Q_cond = Q_evap * (1 + 1/COP)
        if (Array.isArray(sys.sizing)) {
            const chillerItem = sys.sizing.find(s => s.key === 'water_cooled_chiller' || s.key === 'trim_chiller');
            if (chillerItem) {
                const catChiller = (chillerItem.catalog || []).find(c => c.model === chillerItem.selectedModel);
                const cop = catChiller?.cop ?? catChiller?.cop_design;
                if (typeof cop === 'number' && cop > 0) {
                    return 1 + (1 / cop);
                }
                return (typeof root.A === 'function' && root.ASSUMPTIONS && root.ASSUMPTIONS.tower_heat_rejection_factor)
                    ? root.A('tower_heat_rejection_factor')
                    : 1.2;
            }
        }

        // 若架構本身為水冷冰水主機架構 (例如 water_chiller 或 water_cooled_chiller)
        if (archDesc?.flags?.isWaterChiller || archDesc?.flags?.needsCwPump) {
            if (typeof root.A === 'function' && root.ASSUMPTIONS && root.ASSUMPTIONS.tower_heat_rejection_factor) {
                return root.A('tower_heat_rejection_factor');
            }
            return 1.2;
        }

        return 1.0;
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

        // ─────────────────────────────────────────────────────────
        // R8: 泵組水力設計 — 每個迴路依冷卻架構列出完整泵組，逐組以「流量 × 揚程」計算電功率
        //   流量 LPM = Q × 60 ÷ (cp × ΔT)（密度 1 kg/L）；電功率 = 流量 × 揚程 × g ÷ (60000 × η泵 × η馬達)
        //   operation: 'always' = 迴路有負載即運轉；'mechanical' = 僅冰機運轉時（Trim 冰水泵）
        // ─────────────────────────────────────────────────────────
        designPumps(archDesc, sys, loop, qKw, opts = {}) {
            const Af = (k, d) => ((typeof root.A === 'function') ? root.A(k) : d);
            const H = root.CoolingArchHelpers || {};
            const id = archDesc?.id || sys?.architecture;
            const flags = archDesc?.flags || {};
            const cpW = 4.186;
            const cpG = Af('glycol_cp_kj_kgk', 3.90);
            const g = 9.80665;
            const etaOf = opts.etaOf || (() => [Af('pump_eta_default', 0.75), Af('motor_eta_default', 0.92)]);
            const pumps = [];
            const add = (key, labelKey, q, cp, dt, head, operation = 'always') => {
                if (!(q > 0) || !(head > 0)) return;
                const dtE = Math.max(1, dt);
                const flow = q * 60 / (cp * dtE);
                const [ep, em] = etaOf(key);
                pumps.push({
                    key, labelKey, q_kw: q, cp, dt_c: dtE, flow_lpm: flow, head_m: head,
                    eta_pump: ep, eta_motor: em, power_kw: flow * head * g / (60000 * ep * em), operation
                });
            };
            const outdoorArchs = ['dry_cooler_hx', 'dry_cooler_pure', 'dry_cooler_trim', 'adiabatic_tower', 'cooling_tower_hx'];
            const primHead = Af('chw_primary_pump_head_m', 15);

            if (loop === 'liquid') {
                const hasChiller = !!flags.isWaterChiller;
                const ps = hasChiller && (H.usesPrimarySecondary ? H.usesPrimarySecondary(sys) : true);
                const hasPhe = H.archHasPhe ? H.archHasPhe(archDesc, sys) : !!sys?.hasPhe;
                const dt = (sys?.fwsReturnC ?? 55) - (sys?.fwsSupplyC ?? 40);
                // 無 PHE 時 FWS 直接進入室外排熱設備，迴路為防凍水溶液；有 PHE 則 FWS 為純水
                const cpFws = (!hasPhe && outdoorArchs.includes(id)) ? cpG : cpW;
                const mainHead = (sys?.pumpHeadM ?? Af('cdu_pump_head_default_m', 28))
                    + (hasPhe ? Af('phe_primary_side_drop_m', 6) : 0)
                    + ((hasChiller && !ps) ? primHead : 0);
                add('cdu_pump', hasChiller ? (ps ? 'pump.chwSecondaryFws' : 'pump.chwVpfFws') : 'pump.fwsPrimary', qKw, cpFws, dt, mainHead);
                if (hasPhe && outdoorArchs.includes(id)) {
                    const qRej = qKw * (1 + (flags.isTrim ? (opts.trimPeakFrac || 0) / Math.max(1, opts.trimCop || 6.2) : 0));
                    add('rej_pump', 'pump.heatRejGlycol', qRej, cpG, dt, sys?.rejPumpHeadM ?? Af('phe_secondary_loop_head_m', 16));
                }
                if (flags.isTrim) {
                    add('chw_pump', 'pump.trimChw', qKw * (opts.trimPeakFrac || 0), cpW,
                        sys?.trimChwDtC ?? Af('trim_chw_dt_default_c', 5), Af('trim_chw_pump_head_m', 15), 'mechanical');
                }
                if (ps) add('chw_primary_pump', 'pump.chwPrimary', qKw, cpW, dt, primHead);
                if (flags.needsCwPump || flags.isWaterChiller) {
                    add('cw_pump', 'pump.condenserWater', qKw * (opts.rejFactor || Af('tower_heat_rejection_factor', 1.2)), cpW,
                        Af('cw_loop_delta_t_c', 5.5), Af('cw_pump_head_default_m', 22));
                }
            } else {
                const hasChiller = !!flags.hasMechanical && !flags.isDistrict;
                const ps = hasChiller && (H.usesPrimarySecondary ? H.usesPrimarySecondary(sys) : true);
                const dt = (sys?.chwReturnC ?? 18) - (sys?.chwSupplyC ?? 12);
                const mainHead = (sys?.pumpHeadM ?? Af('fw_pump_head_default_m', 22)) + ((hasChiller && !ps) ? primHead : 0);
                add('fw_pump', hasChiller ? (ps ? 'pump.chwSecondary' : 'pump.chwVpf') : 'pump.chwDistribution', qKw, cpW, dt, mainHead);
                if (ps) add('chw_primary_pump', 'pump.chwPrimary', qKw, cpW, dt, primHead);
                if (flags.needsCwPump) {
                    add('cw_pump', 'pump.condenserWater', qKw * (opts.rejFactor || Af('tower_heat_rejection_factor', 1.2)), cpW,
                        Af('cw_loop_delta_t_c', 5.5), Af('cw_pump_head_default_m', 22));
                }
            }
            return pumps;
        },

        isPumpItem(s) {
            return !!s && (s.role === 'pump' || /_pump$/.test(s.key || ''));
        },

        _withRedundancy(baseN, redundancy) {
            const r = redundancy || 'N+1';
            if (r === 'N') return baseN;
            if (r === 'N+2') return baseN + 2;
            if (r === '2N') return 2 * baseN;
            return baseN + 1;
        },

        // 未經使用者指定型號時，自型錄中挑選「揚程足夠、運轉台數 ≤ 6、總馬達功率最小」的泵
        _autoSelectPump(s) {
            const fl = (c) => Number(c.designFlowM3h || c.design_flow_m3h || 0);
            const hd = (c) => Number(c.designHeadM || c.design_head_m || 0);
            const cands = (s.catalog || []).filter(c => c.capKw > 0 && fl(c) > 0 && hd(c) >= s.requiredHeadM);
            if (!cands.length) { s.autoSelected = false; return; }
            // 排序鍵（依序比較）：運轉台數超過 6 台者排後 → 總馬達功率 → 運轉台數 → 單機功率
            const lexLess = (a, b) => {
                for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
                return false;
            };
            let best = null, bestKey = null;
            cands.forEach(c => {
                const nRun = Math.max(1, Math.ceil(s.requiredFlowM3h / fl(c)), Math.ceil(s.requiredKw / c.capKw));
                const key = [nRun > 6 ? 1 : 0, nRun * c.capKw, nRun, c.capKw];
                if (!bestKey || lexLess(key, bestKey)) { best = c; bestKey = key; }
            });
            s.selectedModel = best.model;
            s.unitCapKw = best.capKw;
            s.autoSelected = true;
        },

        // 泵的需求、台數與檢核：馬達功率、型錄流量、型錄揚程三項皆需滿足
        _evaluatePump(s, sys, red) {
            let pp = (sys?.hydraulics?.pumps || []).find(p => p.key === s.key) || null;
            if (!pp && !Array.isArray(sys?.hydraulics?.pumps)) {
                // 舊存檔只有 pump_power_kw / cw_pump_power_kw，無泵組明細（無流量 / 揚程資料）
                const legacyKw = (s.key === 'cw_pump') ? sys?.hydraulics?.cw_pump_power_kw
                    : ((s.key === 'cdu_pump' || s.key === 'fw_pump') ? sys?.hydraulics?.pump_power_kw : 0);
                if (legacyKw > 0) pp = { power_kw: legacyKw, flow_lpm: 0, head_m: 0 };
            }
            s.requiredKw = pp ? pp.power_kw : 0;
            s.requiredFlowM3h = pp ? pp.flow_lpm * 0.06 : 0;
            s.requiredHeadM = pp ? pp.head_m : 0;
            s.autoSelected = false;
            if (!s.userEdited && s.requiredKw > 0) this._autoSelectPump(s);
            const cur = (s.catalog || []).find(c => c.model === s.selectedModel) || {};
            s.unitCapKw = cur.capKw ?? s.unitCapKw ?? 0;
            const catFlow = Number(cur.designFlowM3h || cur.design_flow_m3h || 0);
            const catHead = Number(cur.designHeadM || cur.design_head_m || 0);
            s.unitFlowM3h = catFlow;
            s.unitHeadM = catHead;
            const baseKw = s.unitCapKw > 0 ? Math.ceil(s.requiredKw / s.unitCapKw) : 1;
            const baseFlow = catFlow > 0 ? Math.ceil(s.requiredFlowM3h / catFlow) : 0;
            s.requiredUnits = this._withRedundancy(Math.max(1, baseKw, baseFlow), red);
            s.requiredUnitsN1 = s.requiredUnits;
            if (s.autoSelected || (!s.userEdited && (s.selectedQty || 0) < s.requiredUnits)) s.selectedQty = s.requiredUnits;
            const standby = this.standbyUnits(s.selectedQty, red);
            const active = Math.max(0, (s.selectedQty || 0) - standby);
            s.effectiveCapKw = Math.round(active * s.unitCapKw);
            const minUnits = this.minAllowedQty(red);
            const motorOk = active * s.unitCapKw >= s.requiredKw;
            const flowOk = !(catFlow > 0) || active * catFlow >= s.requiredFlowM3h - 1e-9;
            const headOk = !(catHead > 0) || catHead >= s.requiredHeadM - 1e-9;
            s.pumpChecks = { motorOk, flowOk, headOk, active };
            s.passed = s.requiredKw <= 0 ? true : (s.selectedQty >= minUnits && motorOk && flowOk && headOk);
            const minUnitsStr = (red === 'N+1')
                ? ((root.I18N && root.I18N.lang === 'en') ? ` (N+1 Min ${s.requiredUnits} units)` : ` (N+1 最少 ${s.requiredUnits} 台)`)
                : t('sizing.minUnitsWithRedundancy', { redundancy: red, minUnits: s.requiredUnits });
            const issues = [!motorOk ? t('sizing.motorDeficit') : '', !flowOk ? t('sizing.pumpFlowShort') : '', !headOk ? t('sizing.pumpHeadShort') : ''].join('');
            s.requiredText = t('sizing.pumpDesignText', {
                kw: s.requiredKw.toFixed(1), flow: s.requiredFlowM3h.toFixed(0), head: s.requiredHeadM.toFixed(1)
            }) + minUnitsStr + issues;
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
                defaultRedundancy: helpers?.defaultRedundancy,
                helpers,
                getTowerRejectionFactor: (s) => getTowerRejectionFactor(s),
                isCdu: true
            };
            return archDesc.equipment.filter(eq => typeof eq.when !== 'function' || eq.when(helpers.sys || {})).map(eq => this._createSizingItem(eq, ctx));
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
                defaultRedundancy: helpers?.defaultRedundancy,
                helpers,
                getTowerRejectionFactor: (s) => getTowerRejectionFactor(s),
                isFw: true
            };
            return archDesc.equipment.filter(eq => typeof eq.when !== 'function' || eq.when(helpers.sys || {})).map(eq => this._createSizingItem(eq, ctx));
        },

        evaluateCduSizing(cduSys, reqCduKw, designCond, helpers = {}) {
            cduSys.sizing.forEach(s => {
                s.requiredKw = reqCduKw;
                if (s.key === 'cooling_tower') s.requiredKw = reqCduKw * getTowerRejectionFactor(cduSys);

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
                        cop_curve: curItem.cop_curve || { type: 'fixed' },
                        t_chws_design: curItem.t_chws_c,
                        category: curItem.category
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
                        cop_curve: curItem.cop_curve || { type: 'fixed' },
                        t_chws_design: curItem.t_chws_c,
                        category: curItem.category
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
                if (SizingEngine.isPumpItem(s)) { SizingEngine._evaluatePump(s, cduSys, red); return; }
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

                const curItem = (s.catalog && Array.isArray(s.catalog))
                    ? (s.catalog.find(c => c.model === s.selectedModel) || s.catalog[0] || { capKw: s.unitCapKw || 100 })
                    : { capKw: s.unitCapKw || 100 };
                s.unitCapKw = curItem.capKw;

                let derateFactor = 1.0;
                if (s.key === 'air_cooled_chiller' && typeof root.ChillerEngine !== 'undefined') {
                    const spec = {
                        cooling_capacity_kw: curItem.capKw,
                        chiller_type: 'air_cooled',
                        cop_curve: curItem.cop_curve || { type: 'fixed' },
                        t_chws_design: curItem.t_chws_c,
                        category: curItem.category
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
                        cop_curve: curItem.cop_curve || { type: 'fixed' },
                        t_chws_design: curItem.t_chws_c,
                        category: curItem.category
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
                if (SizingEngine.isPumpItem(s)) { SizingEngine._evaluatePump(s, fwSys, red); return; }
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
