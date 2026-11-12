/**
 * V10 Phase 6：設備規格與數量統整（純函式，不碰 DOM）
 * - collectSystems(state)：列出全案所有冷卻系統（共用機房、非成員單元、成員單元的終端設備）
 * - build(state)：全案相同「設備 key + 型號」合併成一列，附台數、裝置容量、耗電、使用位置、正規化規格
 * - 規格只讀型錄欄位，沒有的輸出 null，不自行補數字
 */
(function (root) {
    'use strict';

    const TERMINAL_KEYS = ['cdu_unit', 'crah_unit', 'rdhx_unit'];

    const firstNum = (c, keys) => {
        for (const k of keys) {
            const v = c ? c[k] : undefined;
            if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))) return Number(v);
        }
        return null;
    };
    const firstStr = (c, keys) => {
        for (const k of keys) {
            const v = c ? c[k] : undefined;
            if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return null;
    };

    const EquipmentSchedule = {
        isPump(s) {
            return !!s && (s.role === 'pump' || /_pump$/.test(s.key || ''));
        },

        isTerminal(s) {
            return !!s && (s.role === 'terminal' || TERMINAL_KEYS.includes(s.key));
        },

        // 設備分組（電力需求彙總用）
        groupOf(s) {
            const k = String(s.key || '');
            if (this.isPump(s)) return 'pump';
            if (k === 'cdu_unit') return 'cdu';
            if (k === 'crah_unit' || k === 'rdhx_unit') return 'crah';
            if (/chiller/.test(k)) return 'chiller';
            if (/tower|cooler|rejection/.test(k)) return 'heatRejection';
            return 'other';
        },

        // 依 sizing 的 catalog 找到所選型號的原始資料
        catalogItem(s) {
            return (s.catalog || []).find(c => c.model === s.selectedModel) || null;
        },

        // 規格正規化（見計畫 §3.2）
        normalizeSpec(s, c) {
            const isPump = this.isPump(s);
            const capKw = firstNum(c, ['capKw', 'cooling_capacity_kw', 'capacityKw', 'heat_rejection_kw']) ?? (Number(s.unitCapKw) || null);
            const cop = firstNum(c, ['cop', 'cop_design']);
            let unitPowerKw = null, unitPowerBasis = null;
            if (isPump) {
                unitPowerKw = capKw; unitPowerBasis = capKw != null ? 'motor' : null;
            } else {
                unitPowerKw = firstNum(c, ['powerKw', 'power_kw', 'power_input_kw', 'fanPowerKw', 'fan_power_kw', 'fanKwDx', 'fan_kw_dx']);
                if (unitPowerKw != null) unitPowerBasis = 'catalog';
                else if (/chiller/.test(s.key || '') && capKw && cop) { unitPowerKw = capKw / cop; unitPowerBasis = 'cap/cop'; }
            }
            const flowLpm = firstNum(c, ['flow_rate_lpm']);
            const waterFlowLh = firstNum(c, ['water_flow_lh']);
            const flowM3h = firstNum(c, ['designFlowM3h', 'design_flow_m3h', 'flow_rate_m3h'])
                ?? (flowLpm != null ? flowLpm * 0.06 : (waterFlowLh != null ? waterFlowLh / 1000 : null));
            const dims = (c && typeof c.dimensions_mm === 'object' && c.dimensions_mm) ? c.dimensions_mm : {};
            return {
                capKw,
                unitPowerKw,
                unitPowerBasis,
                cop,
                iplv: firstNum(c, ['iplv']),
                refrigerant: firstStr(c, ['refrigerant']),
                flowM3h,
                headM: firstNum(c, ['designHeadM', 'design_head_m']),
                pressureDropBar: firstNum(c, ['external_pressure_drop_bar']),
                airflowM3h: firstNum(c, ['airflowM3h', 'airflow_m3h']) ?? (firstNum(c, ['air_flow_m3s']) != null ? firstNum(c, ['air_flow_m3s']) * 3600 : null),
                sensibleKw: firstNum(c, ['netSensibleCapacityKw']),
                tChwsC: firstNum(c, ['t_chws_c', 'chwInletTempC', 'chw_supply_temp_c']),
                chwDtC: firstNum(c, ['chwDeltaTC']),
                approachC: firstNum(c, ['approachC', 'approach_temp_c']),
                fanKwDx: firstNum(c, ['fanKwDx', 'fan_kw_dx']),
                fanKwFc: firstNum(c, ['fanKwFc', 'fan_kw_fc']),
                pumpEta: firstNum(c, ['pumpEtaDesign']),
                motorEta: firstNum(c, ['motorEtaDesign']) ?? (firstNum(c, ['motor_efficiency_pct']) != null ? firstNum(c, ['motor_efficiency_pct']) / 100 : null),
                motorClass: firstStr(c, ['motor_efficiency_class']),
                pumpType: firstStr(c, ['pump_type']),
                widthMm: firstNum(c, ['widthMm']) ?? firstNum(dims, ['width']),
                depthMm: firstNum(c, ['depthMm']) ?? firstNum(dims, ['depth']),
                heightMm: firstNum(c, ['heightMm']) ?? firstNum(dims, ['height']),
                weightKg: firstNum(c, ['weight_kg', 'operating_weight_kg'])
            };
        },

        // 全案冷卻系統清單（view_report 也用這份，避免兩套邏輯）
        collectSystems(state) {
            const st = state || {};
            const out = [];
            const plants = (st.coolingPlants || []).filter(p => !p.isEmpty && Array.isArray(p.memberIds) && p.memberIds.length > 0);
            const units = [];
            (st.halls || []).forEach(h => (h.dus || []).forEach(d => units.push({ obj: d, kind: 'DU', hall: h.name })));
            (st.corePods || []).filter(p => p.enabled !== false).forEach(p => units.push({ obj: p, kind: 'CorePOD', hall: '—' }));
            const nameOf = (id) => (units.find(u => u.obj.id === id)?.obj.name) || id;

            plants.forEach(p => out.push({
                id: p.id, title: p.name, loop: p.loop, shared: true, sys: p.system || {},
                members: p.memberIds.map(nameOf), terminalOnly: false, plantName: null
            }));
            units.forEach(u => {
                const pd = u.obj.plantDesign || {};
                [['cduSystem', 'liquid'], ['fanwallSystem', 'air']].forEach(([k, loop]) => {
                    const sys = pd[k];
                    if (!sys || !(sys.sizing || []).length) return;
                    // 負載為 0 的系統不列（以選型需求判斷）
                    if (!(sys.sizing || []).some(s => (s.requiredKw || 0) > 0)) return;
                    const plant = sys.plantId ? plants.find(p => p.id === sys.plantId) : null;
                    out.push({
                        id: u.obj.id, title: u.obj.name, kind: u.kind, loop, shared: false, sys,
                        members: null, terminalOnly: !!plant, plantName: plant ? plant.name : null
                    });
                });
            });
            return out;
        },

        build(state) {
            const SE = root.SizingEngine;
            const standbyOf = (qty, red) => (SE && typeof SE.standbyUnits === 'function') ? SE.standbyUnits(qty, red) : 1;
            const systems = this.collectSystems(state);
            const map = new Map();
            const warnings = [];

            systems.forEach(sy => {
                (sy.sys.sizing || []).forEach(s => {
                    if (!((s.requiredKw || 0) > 0)) return;
                    if (sy.terminalOnly && !this.isTerminal(s)) return;
                    const qty = Number(s.selectedQty) || 0;
                    if (qty <= 0) return;
                    const red = s.redundancy || 'N+1';
                    const standby = Math.min(qty, standbyOf(qty, red));
                    const running = Math.max(0, qty - standby);
                    const key = `${s.key}||${s.selectedModel || ''}`;
                    let row = map.get(key);
                    if (!row) {
                        const c = this.catalogItem(s);
                        const spec = this.normalizeSpec(s, c);
                        row = {
                            key: s.key,
                            category: this.isTerminal(s) ? 'terminal' : 'plant',
                            group: this.groupOf(s),
                            label: String(s.label || s.key),
                            model: s.selectedModel || '—',
                            vendor: (c && c.vendor) || null,
                            unitCapKw: spec.capKw,
                            unitPowerKw: spec.unitPowerKw,
                            unitPowerBasis: spec.unitPowerBasis,
                            qtyTotal: 0, qtyRunning: 0, qtyStandby: 0,
                            locations: [],
                            spec,
                            source: (c && c._source) || null,
                            verified: c ? (c._verified === true ? true : (c._verified === false ? false : null)) : null,
                            aiConfidence: (c && Number.isFinite(Number(c._ai_confidence))) ? Number(c._ai_confidence) : null,
                            fromVendorData: !!(c && c._extracted_from),   // V11：來自原廠選型報告（device_catalog/verified）
                            ratingIssues: []
                        };
                        map.set(key, row);
                    }
                    (Array.isArray(s.ratingIssues) ? s.ratingIssues : []).forEach(x => { if (!row.ratingIssues.includes(x)) row.ratingIssues.push(x); });
                    row.qtyTotal += qty;
                    row.qtyRunning += running;
                    row.qtyStandby += standby;
                    row.locations.push({ name: sy.title, loop: sy.loop, qty, redundancy: red, shared: sy.shared });
                });
            });

            const rows = [...map.values()].map(r => {
                r.installedCapKw = (r.unitCapKw || 0) * r.qtyTotal;
                r.connectedKw = r.unitPowerKw != null ? r.unitPowerKw * r.qtyTotal : null;
                r.runningKw = r.unitPowerKw != null ? r.unitPowerKw * r.qtyRunning : null;
                if (!r.source) warnings.push({ type: 'noSource', label: r.label, model: r.model });
                else if (r.verified === false) warnings.push({ type: 'unverified', label: r.label, model: r.model });
                if (r.unitPowerKw == null) warnings.push({ type: 'noPower', label: r.label, model: r.model });
                if (r.ratingIssues.length) warnings.push({ type: 'ratingMismatch', label: r.label, model: r.model, issues: r.ratingIssues });
                return r;
            });
            // 排序：主機房 → 終端；同區依分組、key
            const gOrder = { chiller: 1, heatRejection: 2, pump: 3, cdu: 4, crah: 5, other: 6 };
            rows.sort((a, b) => (a.category === b.category ? 0 : (a.category === 'plant' ? -1 : 1))
                || (gOrder[a.group] - gOrder[b.group]) || String(a.key).localeCompare(String(b.key)) || String(a.model).localeCompare(String(b.model)));

            const byGroup = {};
            Object.keys(gOrder).forEach(g => { byGroup[g] = { connectedKw: 0, runningKw: 0, installedCapKw: 0, qty: 0 }; });
            rows.forEach(r => {
                const g = byGroup[r.group];
                g.connectedKw += r.connectedKw || 0;
                g.runningKw += r.runningKw || 0;
                g.installedCapKw += r.installedCapKw || 0;
                g.qty += r.qtyTotal;
            });
            const totals = {
                connectedKw: rows.reduce((s, r) => s + (r.connectedKw || 0), 0),
                runningKw: rows.reduce((s, r) => s + (r.runningKw || 0), 0),
                byGroup
            };
            return { rows, totals, warnings, systems };
        }
    };

    root.EquipmentSchedule = EquipmentSchedule;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
