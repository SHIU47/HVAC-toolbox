'use strict';
/**
 * schematic_series_trim.js - NVIDIA DSX Series Trim Hybrid Cooling Topology SVG
 * Used by: dry_cooler_trim (and legacy alias dry_cooler_hx)
 */
(function (root) {
    root.CoolingSchematics = root.CoolingSchematics || {
        _map: {},
        register(id, renderer) {
            this._map[id] = renderer;
        },
        get(id) {
            return this._map[id] || null;
        },
        render(id, ctx) {
            const s = this._map[id];
            if (!s) return '';
            return typeof s.render === 'function' ? s.render(ctx) : s(ctx);
        }
    };

    root.CoolingSchematics.register('series_trim', {
        render(ctx) {
            const t = ctx.t || {};
            const cduSys = ctx.cduSys || t.obj?.plantDesign?.cduSystem || {};
            const arch = ctx.arch || cduSys.architecture || 'dry_cooler_trim';
            const archDesc = (typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(arch) : null;

            const cduModeHours = ctx.cduModeHours || null;
            const deficitHours = ctx.deficitHours || 0;

            const designCond = (typeof AppStore !== 'undefined' && AppStore.designConditions)
                ? AppStore.designConditions()
                : { designDb: 35.0, designWb: 28.0, maxDb: 38.0 };
            const equip = (typeof AppStore !== 'undefined' && AppStore.resolveEquipment && archDesc)
                ? AppStore.resolveEquipment(archDesc, cduSys)
                : {};
            const model = archDesc?.topology
                ? archDesc.topology(cduSys, null, { ...designCond, cduModeHours, deficitHours }, { equip, cduModeHours, deficitHours })
                : null;
            const op = model?.op || null;
            const peak = model?.peak || null;

            const nIt = model?.nodes?.find(n => n.id === 'it') || {};
            const nPrimary = model?.nodes?.find(n => n.id === 'hx_primary') || {};
            const nSecondary = model?.nodes?.find(n => n.id === 'hx_secondary') || {};
            const nChiller = model?.nodes?.find(n => n.id === 'chiller') || {};
            const nDryCooler = model?.nodes?.find(n => n.id === 'dry_cooler') || {};
            const nPump = model?.nodes?.find(n => n.id === 'pump_fws') || {};

            const getPipe = (from, to, fallback = '') => model?.pipes?.find(p => p.from === from && p.to === to)?.label || fallback;

            const fitTextAttr = (str, maxPx, fontSize = 11) => {
                if (!str || typeof str !== 'string') return '';
                let est = 0;
                for (let i = 0; i < str.length; i++) {
                    est += str.charCodeAt(i) > 255 ? fontSize : fontSize * 0.58;
                }
                if (est > maxPx) {
                    return `textLength="${maxPx}" lengthAdjust="spacingAndGlyphs"`;
                }
                return '';
            };

            const cduApproachC = cduSys.cduApproachC ?? 3.0;
            const dcApproach = cduSys.dryCoolerApproachC ?? 5.0;
            const trimChwDtC = cduSys.trimChwDtC ?? ((typeof root.A === 'function') ? root.A('trim_chw_dt_default_c') : 5.0);
            const fwsSupplyC = op?.temps?.fwsSup ?? cduSys.fwsSupplyC ?? 40.0;
            const fwsReturnC = op?.temps?.fwsRet ?? cduSys.fwsReturnC ?? 55.0;
            const precoolTemp = op?.temps?.fwsPre ?? fwsSupplyC;
            const chwSupplyTemp = op?.temps?.chwSup ?? 30.0;
            const chwReturnTemp = op?.temps?.chwRet ?? (chwSupplyTemp + trimChwDtC);
            const dcWaterSupplyExact = (op?.temps?.dcOut !== undefined && op?.temps?.dcOut !== null) ? op.temps.dcOut.toFixed(1) : '—';
            const condWaterEnterExact = (op?.temps?.condIn !== undefined && op?.temps?.condIn !== null) ? op.temps.condIn.toFixed(1) : '—';
            const condWaterLeaveExact = (op?.temps?.condOut !== undefined && op?.temps?.condOut !== null) ? op.temps.condOut.toFixed(1) : '—';
            const outdoorDb = (designCond.designDb !== undefined && designCond.designDb !== null) ? Number(designCond.designDb).toFixed(1) : '—';
            const cduFcThresh = (op?.thresholds?.full !== undefined && op?.thresholds?.full !== null) ? Number(op.thresholds.full).toFixed(1) : '—';

            const liqLoadKw = (cduSys.designBasis?.liq_load_kw || t.summ?.liquidHeatKw || 0);
            const dtSec = Math.max(0.5, (cduSys.secReturnC || 57) - (cduSys.secSupplyC || 45));
            const dtPrim = Math.max(0.5, fwsReturnC - fwsSupplyC);
            const flowSecLpm = Math.round((liqLoadKw * 14.33) / dtSec);
            const flowPrimLpm = Math.round((liqLoadKw * 14.33) / dtPrim);
            const cduUnitQty = (cduSys.sizing || []).find(s => s.key === 'cdu_unit')?.selectedQty || 3;
            const secSupplyC = cduSys.secSupplyC || 45;
            const secReturnC = cduSys.secReturnC || 57;

            // 設計工況 (0.4% DB) 狀態判斷
            const isDesignMode1 = op?.mode ? (op.mode === 'free') : ((designCond.designDb != null && op?.thresholds?.full != null) ? designCond.designDb <= op.thresholds.full : true);

            // 尖峰工況 (年最高 DB)
            const maxDb = peak?.db ?? designCond.maxDb ?? ((designCond.designDb ?? 35.0) + 3.0);
            const fwsPre_peak = (peak?.temps?.fwsPre !== undefined && peak?.temps?.fwsPre !== null) ? peak.temps.fwsPre.toFixed(1) : (fwsSupplyC !== undefined ? fwsSupplyC.toFixed(1) : '—');
            const trimKw_peak = peak?.chillerKw !== undefined ? Math.round(peak.chillerKw) : 0;
            const condIn_peak = (peak?.temps?.condIn !== undefined && peak?.temps?.condIn !== null) ? peak.temps.condIn.toFixed(1) : condWaterEnterExact;
            const condOut_peak = (peak?.temps?.condOut !== undefined && peak?.temps?.condOut !== null) ? peak.temps.condOut.toFixed(1) : condIn_peak;
            const cop_peak = (peak?.chillerCop !== undefined && peak?.chillerCop !== null) ? peak.chillerCop.toFixed(1) : '—';

            // 樣式變數 (設計工況 Mode 1 停機 vs Active)
            const secHxStroke = isDesignMode1 ? '#475569' : '#818cf8';
            const secHxHeaderFill = isDesignMode1 ? '#1e293b' : '#312e81';
            const secHxIconStroke = isDesignMode1 ? '#64748b' : '#a5b4fc';
            const secHxLine1 = isDesignMode1 ? '待機停用 (Standby)' : (nSecondary.lines?.[0] || '接力修整 (Trim Cooling)');
            const secHxLine2 = isDesignMode1 ? '設計點全自然冷卻，無需修整' : (nSecondary.lines?.[1] || `精確修整至 ${fwsSupplyC}°C`);
            const secHxLine3 = isDesignMode1 ? '零冰機運轉・零壓縮機耗電' : (nSecondary.lines?.[2] || `由 Trim Chiller ${chwSupplyTemp}°C 冰水冷卻`);

            const chillerStroke = isDesignMode1 ? '#475569' : '#818cf8';
            const chillerHeaderFill = isDesignMode1 ? '#1e293b' : '#312e81';
            const chillerIconStroke = isDesignMode1 ? '#64748b' : '#a5b4fc';
            const chillerLine1 = nChiller.lines?.[0] || 'Trim';
            const chillerLine2 = isDesignMode1 ? '設計工況無修整需求 (停機)' : (nChiller.lines?.[1] || '冷凝熱串聯排放至 Dry Coolers');
            const chillerLine3 = isDesignMode1 ? '年尖峰或高溫時自動啟動' : (nChiller.lines?.[2] || '高效離心/螺桿式機械壓縮製冷');

            const chwPipeColor = isDesignMode1 ? '#475569' : '#0284c7';
            const chwPipeDash = isDesignMode1 ? '4,4' : 'none';
            const chwSupBadge = isDesignMode1 ? '待機 (Standby)' : getPipe('chiller', 'hx_secondary', `${chwSupplyTemp}°C`);
            const chwRetBadge = isDesignMode1 ? '待機 (Standby)' : getPipe('hx_secondary', 'chiller', `${chwReturnTemp}°C`);

            // =========================================================================
            // 雙迴路混合架構 (dry_cooler_trim 專屬: NVIDIA DSX 官方標準 Trim/Hybrid Cooling)
            // =========================================================================
            const facilitySchematicSvg = `
                <!-- 年最高 DB 尖峰工況小表格 -->
                <rect x="740" y="8" width="510" height="26" rx="6" fill="#0f172a" stroke="#f59e0b" stroke-width="1.2" />
                <text x="995" y="25" fill="#fef3c7" font-size="9.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(`年最高 DB ${maxDb.toFixed(1)}°C 工況：預冷至 ${fwsPre_peak}°C ｜ Trim 負擔 ${trimKw_peak} kW ｜ 冷凝器 ${condIn_peak}→${condOut_peak}°C ｜ 冰機 COP ${cop_peak}`, 495, 9.5)}>年最高 DB ${maxDb.toFixed(1)}°C 工況：預冷至 ${fwsPre_peak}°C ｜ Trim 負擔 ${trimKw_peak} kW ｜ 冷凝器 ${condIn_peak}→${condOut_peak}°C ｜ 冰機 COP ${cop_peak}</text>

                <!-- ======================================================= -->
                <!-- 1. PRIMARY FWS LOOP (廠務側串聯換熱鏈) -->
                <!-- ======================================================= -->
                <!-- CDU 熱回水出口 (X=320, Y=75) → Primary HX 入口 (X=430, Y=75) -->
                <line x1="320" y1="75" x2="430" y2="75" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round" />
                <rect x="330" y="42" width="80" height="24" rx="5" fill="#881337" stroke="#f43f5e" stroke-width="1.5" />
                <text x="370" y="58" fill="#ffe4e6" font-size="10.5" font-weight="bold" text-anchor="middle">${getPipe('cdu', 'hx_primary', `${fwsReturnC}°C`)}</text>

                <!-- Primary HX 預冷出水 (X=430, Y=115) → 串聯進入 Secondary HX 入口 (X=430, Y=205) -->
                <path d="M 430 115 L 365 115 L 365 205 L 430 205" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6,4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="330" y="148" width="70" height="22" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
                <text x="365" y="163" fill="#fef3c7" font-size="10" font-weight="bold" text-anchor="middle">${getPipe('hx_primary', 'hx_secondary', `${precoolTemp}°C`)}</text>

                <!-- Secondary HX 修整出水 (X=430, Y=265) → Secondary Pump → CDU 冷供水入口 (X=320, Y=265) -->
                <line x1="430" y1="265" x2="385" y2="265" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                
                <!-- Secondary Pump (二次側設施供水泵) -->
                <circle cx="370" cy="265" r="14" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
                <polygon points="376,259 364,265 376,271" fill="#ffffff" />
                <text x="370" y="293" fill="#38bdf8" font-size="9" font-weight="bold" text-anchor="middle" ${fitTextAttr(nPump.title || 'FWS Pump', 90, 9)}>${nPump.title || 'FWS Pump'}</text>

                <line x1="355" y1="265" x2="320" y2="265" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                <rect x="330" y="222" width="80" height="24" rx="5" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.5" />
                <text x="370" y="238" fill="#e0f2fe" font-size="10.5" font-weight="bold" text-anchor="middle">${getPipe('hx_secondary', 'cdu', `${fwsSupplyC}°C`)}</text>

                <!-- ======================================================= -->
                <!-- 2. PRIMARY HEAT EXCHANGER (Primary 板換 / 預冷) -->
                <!-- ======================================================= -->
                <rect x="430" y="35" width="200" height="100" rx="10" fill="#0f172a" stroke="#10b981" stroke-width="2" />
                <rect x="430" y="35" width="200" height="26" rx="10" fill="#064e3b" />
                <text x="530" y="53" fill="#d1fae5" font-size="11" font-weight="bold" text-anchor="middle" ${fitTextAttr(nPrimary.title || 'Liquid-to-Liquid HX (Primary)', 180, 11)}>${nPrimary.title || 'Liquid-to-Liquid HX (Primary)'}</text>

                <rect x="442" y="68" width="22" height="55" rx="4" fill="#1e293b" stroke="#34d399" stroke-width="1" />
                <path d="M 447 75 L 455 85 L 447 95 M 453 75 L 461 85 L 453 95 M 447 95 L 455 105 L 447 115" stroke="#34d399" stroke-width="1.3" fill="none" stroke-linecap="round" />
                <text x="540" y="82" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle" ${fitTextAttr(nPrimary.lines?.[0] || '自然預冷 (Free Pre-Cool)', 150, 11)}>${nPrimary.lines?.[0] || '自然預冷 (Free Pre-Cool)'}</text>
                <text x="540" y="100" fill="#a7f3d0" font-size="9.5" text-anchor="middle" ${fitTextAttr(nPrimary.lines?.[1] || `回水預冷至 ${precoolTemp}°C`, 150, 9.5)}>${nPrimary.lines?.[1] || `回水預冷至 ${precoolTemp}°C`}</text>
                <text x="540" y="118" fill="#cbd5e1" font-size="9" text-anchor="middle" ${fitTextAttr(nPrimary.lines?.[2] || '以乾冷器出水為冷源', 150, 9)}>${nPrimary.lines?.[2] || '以乾冷器出水為冷源'}</text>

                <!-- ======================================================= -->
                <!-- 3. SECONDARY HEAT EXCHANGER (Secondary 板換 / Trim 修整) -->
                <!-- ======================================================= -->
                <rect x="430" y="185" width="200" height="100" rx="10" fill="#0f172a" stroke="${secHxStroke}" stroke-width="2" />
                <rect x="430" y="185" width="200" height="26" rx="10" fill="${secHxHeaderFill}" />
                <text x="530" y="203" fill="#e0e7ff" font-size="11" font-weight="bold" text-anchor="middle" ${fitTextAttr(nSecondary.title || 'Liquid-to-Liquid HX (Secondary)', 180, 11)}>${nSecondary.title || 'Liquid-to-Liquid HX (Secondary)'}</text>

                <rect x="442" y="218" width="22" height="55" rx="4" fill="#1e293b" stroke="${secHxIconStroke}" stroke-width="1" />
                <path d="M 447 225 L 455 235 L 447 245 M 453 225 L 461 235 L 453 245 M 447 245 L 455 255 L 447 265" stroke="${secHxIconStroke}" stroke-width="1.3" fill="none" stroke-linecap="round" />
                <text x="540" y="232" fill="${secHxStroke}" font-size="11" font-weight="bold" text-anchor="middle" ${fitTextAttr(secHxLine1, 150, 11)}>${secHxLine1}</text>
                <text x="540" y="250" fill="${isDesignMode1 ? '#cbd5e1' : '#c7d2fe'}" font-size="9.5" text-anchor="middle" ${fitTextAttr(secHxLine2, 150, 9.5)}>${secHxLine2}</text>
                <text x="540" y="268" fill="#cbd5e1" font-size="9" text-anchor="middle" ${fitTextAttr(secHxLine3, 150, 9)}>${secHxLine3}</text>

                <!-- ======================================================= -->
                <!-- 4. TRIM CHILLER EVAPORATOR LOOP (冰水主機蒸發器迴路) -->
                <!-- ======================================================= -->
                <!-- Chiller 產出冰水 (X=730, Y=205) → Secondary HX 右上入口 (X=630, Y=205) -->
                <line x1="730" y1="205" x2="630" y2="205" stroke="${chwPipeColor}" stroke-width="4" stroke-dasharray="${chwPipeDash}" stroke-linecap="round" />
                <rect x="655" y="180" width="60" height="20" rx="4" fill="#0c4a6e" stroke="${chwPipeColor}" stroke-width="1.2" />
                <text x="685" y="194" fill="#e0f2fe" font-size="9" font-weight="bold" text-anchor="middle">${chwSupBadge}</text>

                <!-- Secondary HX 吸熱回水 (X=630, Y=265) → 冰機蒸發器入口 (X=730, Y=265) -->
                <line x1="630" y1="265" x2="730" y2="265" stroke="${isDesignMode1 ? '#475569' : '#ea580c'}" stroke-width="4" stroke-dasharray="${chwPipeDash}" stroke-linecap="round" />
                <rect x="655" y="272" width="60" height="20" rx="4" fill="#881337" stroke="${isDesignMode1 ? '#475569' : '#f43f5e'}" stroke-width="1.2" />
                <text x="685" y="286" fill="#ffe4e6" font-size="9" font-weight="bold" text-anchor="middle">${chwRetBadge}</text>

                <!-- ======================================================= -->
                <!-- 5. WATER COOLED CHILLERS (水冷式冰水主機) -->
                <!-- ======================================================= -->
                <rect x="730" y="185" width="200" height="100" rx="10" fill="#1e1b4b" stroke="${chillerStroke}" stroke-width="2" />
                <rect x="730" y="185" width="200" height="26" rx="10" fill="${chillerHeaderFill}" />
                <text x="830" y="203" fill="#f8fafc" font-size="11.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(nChiller.title || 'Water Cooled Chillers', 180, 11.5)}>${nChiller.title || 'Water Cooled Chillers'}</text>
                ${isDesignMode1 ? '<text x="918" y="202" fill="#94a3b8" font-size="8.5" font-weight="bold" text-anchor="end">待機 (Standby)</text>' : ''}

                <circle cx="755" cy="235" r="13" fill="#312e81" stroke="${chillerIconStroke}" stroke-width="1.5" />
                <text x="755" y="239" fill="#ffffff" font-size="8.5" font-weight="bold" text-anchor="middle">${chillerLine1}</text>

                <text x="845" y="235" fill="${isDesignMode1 ? '#cbd5e1' : '#e0e7ff'}" font-size="10" font-weight="bold" text-anchor="middle" ${fitTextAttr(chillerLine2, 150, 10)}>${chillerLine2}</text>
                <text x="845" y="258" fill="#94a3b8" font-size="9.5" text-anchor="middle" ${fitTextAttr(chillerLine3, 150, 9.5)}>${chillerLine3}</text>

                <!-- ======================================================= -->
                <!-- 6. DRY COOLER & CONDENSER SERIES LOOP (乾冷器與冷凝器串聯排熱鏈) -->
                <!-- ======================================================= -->
                <!-- A. Dry Coolers 出水 (X=1060, Y=105) → Primary HX 右上冷源入口 (X=630, Y=75) -->
                <path d="M 1060 105 L 1010 105 L 1010 75 L 630 75" stroke="#0284c7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="795" y="50" width="70" height="20" rx="4" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.2" />
                <text x="830" y="64" fill="#e0f2fe" font-size="9.5" font-weight="bold" text-anchor="middle">${getPipe('dry_cooler', 'hx_primary', `${dcWaterSupplyExact}°C`)}</text>

                <!-- B. Primary HX 預冷吸熱出水 (X=630, Y=115) → 串聯進入 Chiller 冷凝器 (X=930, Y=205) [X=960 立管] -->
                <path d="M 630 115 L 960 115 L 960 205 L 930 205" stroke="#ec4899" stroke-width="3.5" stroke-dasharray="6,4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="795" y="93" width="70" height="20" rx="4" fill="#831843" stroke="#f472b6" stroke-width="1.2" />
                <text x="830" y="107" fill="#fdf2f8" font-size="9.5" font-weight="bold" text-anchor="middle">${getPipe('hx_primary', 'chiller', `${condWaterEnterExact}°C`)}</text>

                <!-- C. Chiller 冷凝熱全額排熱水 (X=930, Y=245) → Dry Coolers 下方入口 (X=1060, Y=185) [X=1010 立管，完全不重疊] -->
                <path d="M 930 245 L 1010 245 L 1010 185 L 1060 185" stroke="#ea580c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <rect x="942" y="222" width="65" height="20" rx="4" fill="#881337" stroke="#f43f5e" stroke-width="1.2" />
                <text x="974" y="236" fill="#ffe4e6" font-size="9" font-weight="bold" text-anchor="middle">${getPipe('chiller', 'dry_cooler', `${condWaterLeaveExact}°C`)}</text>

                <!-- ======================================================= -->
                <!-- 7. DRY COOLERS (室外乾式冷卻器模組) -->
                <!-- ======================================================= -->
                <!-- 頂部氣流箭頭 (進風外氣設計乾球溫) -->
                <text x="1160" y="55" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">設計乾球 (0.4%): ${outdoorDb}°C</text>
                <polygon points="1110,60 1120,60 1115,70" fill="#38bdf8" />
                <polygon points="1160,60 1170,60 1165,70" fill="#38bdf8" />
                <polygon points="1210,60 1220,60 1215,70" fill="#38bdf8" />

                <rect x="1060" y="75" width="200" height="150" rx="10" fill="#042f2e" stroke="#14b8a6" stroke-width="2" />
                <rect x="1060" y="75" width="200" height="28" rx="10" fill="#0f172a" />
                <text x="1160" y="94" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle" ${fitTextAttr(nDryCooler.title || 'Dry Coolers', 180, 12)}>${nDryCooler.title || 'Dry Coolers'}</text>
                
                <text x="1075" y="122" fill="#f1f5f9" font-size="11" font-weight="bold" ${fitTextAttr(nDryCooler.lines?.[0] || '零耗水自然風冷', 170, 11)}>${nDryCooler.lines?.[0] || '零耗水自然風冷'}</text>
                <text x="1075" y="142" fill="#a7f3d0" font-size="10" ${fitTextAttr(nDryCooler.lines?.[1] || `Approach: ${dcApproach}°C ｜ 門檻: ≤${cduFcThresh}°C`, 170, 10)}>${nDryCooler.lines?.[1] || `Approach: ${dcApproach}°C ｜ 門檻: ≤${cduFcThresh}°C`}</text>
                <text x="1075" y="162" fill="#cbd5e1" font-size="9.5" ${fitTextAttr(nDryCooler.lines?.[2] || 'Mode 1: 滿載自然風冷', 170, 9.5)}>${nDryCooler.lines?.[2] || 'Mode 1: 滿載自然風冷'}</text>
                <text x="1075" y="178" fill="#cbd5e1" font-size="9.5" ${fitTextAttr(nDryCooler.lines?.[3] || 'Mode 2: 串聯預冷與主機冷凝排熱', 170, 9.5)}>${nDryCooler.lines?.[3] || 'Mode 2: 串聯預冷與主機冷凝排熱'}</text>

                <!-- 底部排熱箭頭 -->
                <polygon points="1110,230 1120,230 1115,240" fill="#ef4444" />
                <polygon points="1160,230 1170,230 1165,240" fill="#ef4444" />
                <polygon points="1210,230 1220,230 1215,240" fill="#ef4444" />
            `;

            return `
                <div class="p-4 bg-slate-950 rounded-2xl text-white font-mono border border-slate-800 shadow-xl overflow-hidden">
                    <style>
                        .valve-glyph { fill: #1e293b; stroke: #94a3b8; stroke-width: 1.5; }
                    </style>

                    <!-- 頂部標題與 NVIDIA 參考規範標籤 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs pb-3 border-b border-slate-800/80 gap-2">
                        <div class="flex items-center gap-2">
                            ${model?.referenceLabel ? `<span class="inline-flex items-center justify-center px-3 py-1 rounded-md bg-emerald-950 text-emerald-300 font-black text-xs border border-emerald-700">${model.referenceLabel}</span>` : ''}
                            <span class="font-bold text-slate-100 text-sm">${model?.title || 'NVIDIA DSX 參考拓樸'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded-md bg-purple-950/80 text-purple-300 text-xs font-bold border border-purple-800 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-purple-400"></span>
                                排熱架構: ${nDryCooler.title || '乾冷器 (Dry Cooler)'}
                            </span>
                        </div>
                    </div>

                    <!-- 運轉模式狀態橫幅 (三段) -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 my-2.5 text-xs">
                        ${(model?.banners || []).map(b => {
                            const toneMap = {
                                emerald: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 bg-emerald-400',
                                amber: 'bg-amber-950/40 border-amber-800/60 text-amber-300 bg-amber-400',
                                red: 'bg-red-950/40 border-red-800/60 text-red-300 bg-red-400'
                            };
                            const toneCls = (toneMap[b.tone] || toneMap.emerald).split(' ');
                            const line1 = b.title || b.label;
                            const line2 = b.sub || b.detail || '';
                            return `
                                <div class="p-2.5 rounded-lg ${toneCls[0]} border ${toneCls[1]} flex flex-col gap-1">
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full ${toneCls[3]} shrink-0"></span>
                                        <span class="${toneCls[2]} font-bold text-xs">${line1}</span>
                                    </div>
                                    ${line2 ? `<div class="text-[11px] text-slate-300 pl-4.5 whitespace-nowrap overflow-hidden text-ellipsis">${line2}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- SVG 拓樸畫布 (viewBox 0 0 1260 330) -->
                    <div class="w-full overflow-x-auto pt-1">
                        <svg viewBox="0 0 1260 330" class="w-full min-w-[1050px] h-auto select-none font-sans">
                            <!-- 1. COMPUTE DATA HALL (AI GPU 機櫃與冷板) -->
                            <rect x="20" y="35" width="130" height="250" rx="10" fill="#0f172a" stroke="#475569" stroke-width="2" />
                            <rect x="20" y="35" width="130" height="28" rx="10" fill="#1e293b" />
                            <text x="85" y="54" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle" ${fitTextAttr(nIt.title || 'Compute Data Hall', 120, 11)}>${nIt.title || 'Compute Data Hall'}</text>
                            
                            <rect x="28" y="72" width="114" height="60" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
                            <text x="85" y="92" fill="#f1f5f9" font-size="9.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(nIt.lines?.[0] || 'Cold Plate 晶片液冷', 110, 9.5)}>${nIt.lines?.[0] || 'Cold Plate 晶片液冷'}</text>
                            <text x="85" y="118" fill="#ec4899" font-size="14" font-weight="900" text-anchor="middle">${liqLoadKw.toFixed(0)} kW</text>

                            <text x="85" y="160" fill="#38bdf8" font-size="10.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(nIt.lines?.[1] || `晶片水溫: ${secSupplyC} ⇄ ${secReturnC}°C`, 110, 10.5)}>${nIt.lines?.[1] || `晶片水溫: ${secSupplyC} ⇄ ${secReturnC}°C`}</text>
                            <text x="85" y="185" fill="#a5b4fc" font-size="10" text-anchor="middle" ${fitTextAttr(`二次側流量: ${flowSecLpm.toLocaleString()} LPM`, 110, 10)}>二次側流量: ${flowSecLpm.toLocaleString()} LPM</text>
                            <text x="85" y="208" fill="#94a3b8" font-size="9" text-anchor="middle" ${fitTextAttr(`ΔT = ${dtSec}°C (晶片溫升)`, 110, 9)}>ΔT = ${dtSec}°C (晶片溫升)</text>

                            <!-- 2. SECONDARY TCS PIPING (機櫃 ⇄ CDU 二次側水路) -->
                            <!-- Hot Secondary Return -->
                            <line x1="150" y1="95" x2="190" y2="95" stroke="#f43f5e" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="68" width="40" height="18" rx="3" fill="#881337" />
                            <text x="170" y="81" fill="#ffe4e6" font-size="8" font-weight="bold" text-anchor="middle">≤${secReturnC}°C</text>

                            <!-- Cold Secondary Supply -->
                            <line x1="190" y1="245" x2="150" y2="245" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="218" width="40" height="18" rx="3" fill="#0c4a6e" />
                            <text x="170" y="231" fill="#e0f2fe" font-size="8" font-weight="bold" text-anchor="middle">≤${secSupplyC}°C</text>

                            <!-- 3. CDU - LC (100% 液冷分配單元) -->
                            <rect x="190" y="35" width="130" height="250" rx="10" fill="#1e1b4b" stroke="#8b5cf6" stroke-width="2" />
                            <rect x="190" y="35" width="130" height="28" rx="10" fill="#3b0764" />
                            <text x="255" y="54" fill="#faf5ff" font-size="11.5" font-weight="bold" text-anchor="middle">CDU - LC (100%)</text>

                            <rect x="200" y="72" width="110" height="95" rx="8" fill="#0f172a" stroke="#6d28d9" stroke-width="1.5" />
                            <path d="M 230 82 L 238 157 M 244 82 L 252 157 M 258 82 L 266 157 M 272 82 L 280 157" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" />
                            
                            <rect x="215" y="110" width="80" height="20" rx="4" fill="#2e1065" stroke="#c084fc" stroke-width="1" />
                            <text x="255" y="124" fill="#f5d0fe" font-size="9" font-weight="bold" text-anchor="middle">Approach ${cduApproachC}°C</text>

                            <text x="255" y="195" fill="#e9d5ff" font-size="11" font-weight="bold" text-anchor="middle">${cduUnitQty} 台 (N+1)</text>
                            <text x="255" y="215" fill="#a78bfa" font-size="9.5" text-anchor="middle" ${fitTextAttr('一二次側 100% 隔離', 110, 9.5)}>一二次側 100% 隔離</text>
                            <text x="255" y="235" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle" ${fitTextAttr(`設施流量: ${flowPrimLpm.toLocaleString()} LPM`, 110, 10)}>設施流量: ${flowPrimLpm.toLocaleString()} LPM</text>

                            <!-- 4. FACILITY HEAT REJECTION SCHEMATIC (一次側廠務拓樸) -->
                            ${facilitySchematicSvg}
                        </svg>
                    </div>

                    <!-- 底部即時物理驗算摘要條 -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px]">
                        <div class="flex items-center gap-1.5 text-slate-300">
                            <span class="w-2 h-2 rounded-full bg-pink-500"></span>
                            <span>二次側水流: <strong class="text-pink-300">${flowSecLpm.toLocaleString()} LPM</strong> (ΔT=${dtSec}°C)</span>
                        </div>
                        <div class="flex items-center gap-1.5 text-slate-300">
                            <span class="w-2 h-2 rounded-full bg-teal-400"></span>
                            <span>一次側水流: <strong class="text-teal-300">${flowPrimLpm.toLocaleString()} LPM</strong> (ΔT=${dtPrim}°C)</span>
                        </div>
                        <div class="flex items-center gap-1.5 text-slate-300">
                            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>自然冷卻門檻: <strong class="text-emerald-300">DB ≤ ${cduFcThresh}°C (Mode 1 滿載風冷)</strong></span>
                        </div>
                    </div>
                </div>
            `;
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
