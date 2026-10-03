'use strict';
/**
 * schematic_single_loop.js - Single Loop Heat Rejection System Topology SVG
 * Used by: dry_cooler_pure, adiabatic_tower, cooling_tower_hx, water_chiller
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

    root.CoolingSchematics.register('single_loop', {
        render(ctx) {
            const t = ctx.t || {};
            const cduSys = ctx.cduSys || t.obj?.plantDesign?.cduSystem || {};
            const arch = ctx.arch || cduSys.architecture || 'dry_cooler_pure';
            const archDesc = (typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(arch) : null;

            const designCond = (typeof AppStore !== 'undefined' && AppStore.designConditions) ? AppStore.designConditions() : { designDb: 35.0, designWb: 28.0 };
            const equip = (typeof AppStore !== 'undefined' && AppStore.resolveEquipment && archDesc) ? AppStore.resolveEquipment(archDesc, cduSys) : {};
            const cduModeHours = ctx.cduModeHours || null;
            const deficitHours = ctx.deficitHours || 0;
            const model = archDesc?.topology ? archDesc.topology(cduSys, null, { ...designCond, cduModeHours, deficitHours }, { equip, cduModeHours, deficitHours }) : null;
            const op = model?.op || null;

            const nIt = model?.nodes?.find(n => n.id === 'it') || {};
            const nHx = model?.nodes?.find(n => n.id === 'hx') || null;
            const nChiller = model?.nodes?.find(n => n.id === 'chiller') || null;
            const nPumpSec = model?.nodes?.find(n => n.id === 'pump_sec') || {};
            const nPumpOut = model?.nodes?.find(n => n.id === 'pump_outdoor') || null;
            const nRej = model?.nodes?.find(n => n.id === 'heat_rejection' || n.id === 'tower') || {};

            const getPipe = (from, to, fallback = '') => {
                const p = model?.pipes?.find(item => item.from === from && item.to === to);
                return p ? p.label : fallback;
            };

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
            const fwsSupplyC = op?.temps?.fwsSup ?? cduSys.fwsSupplyC ?? 40.0;
            const fwsReturnC = op?.temps?.fwsRet ?? cduSys.fwsReturnC ?? 55.0;
            const cduFcThresh = (op?.thresholds?.full !== undefined && op?.thresholds?.full !== null) ? Number(op.thresholds.full).toFixed(1) : (fwsSupplyC - 5.0).toFixed(1);

            const liqLoadKw = (cduSys.designBasis?.liq_load_kw || t.summ?.liquidHeatKw || 0);
            const dtSec = Math.max(0.5, (cduSys.secReturnC || 57) - (cduSys.secSupplyC || 45));
            const dtPrim = Math.max(0.5, fwsReturnC - fwsSupplyC);
            const flowSecLpm = Math.round((liqLoadKw * 14.33) / dtSec);
            const flowPrimLpm = Math.round((liqLoadKw * 14.33) / dtPrim);
            const cduUnitQty = (cduSys.sizing || []).find(s => s.key === 'cdu_unit')?.selectedQty || 3;
            const secSupplyC = cduSys.secSupplyC || 45;
            const secReturnC = cduSys.secReturnC || 57;

            const rejThemeMap = {
                dry_cooler: {
                    fill: '#042f2e', stroke: '#14b8a6',
                    headerFill: '#064e3b', pheStroke: '#34d399',
                    pumpFill: '#0369a1', pumpStroke: '#38bdf8', loopColor: '#0d9488'
                },
                adiabatic: {
                    fill: '#082f49', stroke: '#38bdf8',
                    headerFill: '#0c4a6e', pheStroke: '#7dd3fc',
                    pumpFill: '#0369a1', pumpStroke: '#38bdf8', loopColor: '#0284c7'
                },
                tower: {
                    fill: '#164e63', stroke: '#06b6d4',
                    headerFill: '#164e63', pheStroke: '#67e8f9',
                    pumpFill: '#0891b2', pumpStroke: '#06b6d4', loopColor: '#0891b2'
                },
                chiller: {
                    fill: '#1e293b', stroke: '#94a3b8',
                    headerFill: '#312e81', pheStroke: '#a5b4fc',
                    pumpFill: '#3730a3', pumpStroke: '#818cf8', loopColor: '#4f46e5'
                }
            };
            const theme = rejThemeMap[nRej.kind] || rejThemeMap.dry_cooler;

            const boxTop = 70;
            const boxH = 175;
            const rowSupplyY = 110;
            const rowReturnY = 200;

            const nMid = nHx || nChiller;
            let facilitySchematicSvg = '';

            if (nMid) {
                // Two-box configuration: CDU ⇄ Intermediate Unit (PHE or Chiller) ⇄ Outdoor Rejection Unit
                const isChiller = !nHx && !!nChiller;
                const midTheme = isChiller
                    ? { fill: '#0f172a', stroke: '#818cf8', headerFill: '#312e81', textStroke: '#a5b4fc', iconStroke: '#818cf8' }
                    : { fill: '#0f172a', stroke: theme.pheStroke, headerFill: theme.headerFill, textStroke: '#a7f3d0', iconStroke: theme.pheStroke };

                const midTargetId = isChiller ? 'chiller' : 'hx';
                const pipeCduToMid = getPipe('cdu', midTargetId, `${fwsReturnC}°C`);
                const pipeMidToCdu = getPipe(midTargetId, 'cdu', `${fwsSupplyC}°C`);
                const pipeMidToRej = getPipe(midTargetId, 'heat_rejection', isChiller ? `${op?.temps?.condOut ?? 37}°C` : `${fwsReturnC}°C`);
                const pipeRejToMid = getPipe('heat_rejection', midTargetId, isChiller ? `${op?.temps?.condIn ?? 32}°C` : `${op?.temps?.dcOut ?? op?.temps?.towerOut ?? op?.temps?.ctOut ?? 35}°C`);

                const midIconSvg = isChiller ? `
                    <rect x="525" y="${boxTop + 48}" width="26" height="100" rx="4" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.2" />
                    <circle cx="538" cy="${boxTop + 78}" r="9" fill="#312e81" stroke="#a5b4fc" stroke-width="1.5" />
                    <polygon points="534,${boxTop + 82} 542,${boxTop + 78} 534,${boxTop + 74}" fill="#ffffff" />
                    <path d="M 538 ${boxTop + 95} L 538 ${boxTop + 135}" stroke="#818cf8" stroke-width="2" stroke-linecap="round" />
                ` : `
                    <rect x="525" y="${boxTop + 48}" width="26" height="100" rx="4" fill="#1e293b" stroke="${theme.pheStroke}" stroke-width="1.2" />
                    <path d="M 531 ${boxTop + 58} L 542 ${boxTop + 73} L 531 ${boxTop + 88} M 538 ${boxTop + 58} L 549 ${boxTop + 73} L 538 ${boxTop + 88} M 531 ${boxTop + 88} L 542 ${boxTop + 103} L 531 ${boxTop + 118} M 538 ${boxTop + 88} L 549 ${boxTop + 103} L 538 ${boxTop + 118} M 531 ${boxTop + 118} L 542 ${boxTop + 133} L 531 ${boxTop + 143}" stroke="${theme.pheStroke}" stroke-width="1.5" fill="none" stroke-linecap="round" />
                `;

                facilitySchematicSvg = `
                    <!-- 1. 廠務熱回水總管 (From CDU ⇄ Mid Box) -->
                    <line x1="320" y1="${rowSupplyY}" x2="510" y2="${rowSupplyY}" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round" />
                    
                    <rect x="365" y="65" width="135" height="24" rx="5" fill="#881337" stroke="#f43f5e" stroke-width="1.5" />
                    <text x="432" y="81" fill="#ffe4e6" font-size="10.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(`熱回水: ${pipeCduToMid} (FWS Return)`, 126, 10.5)}>熱回水: ${pipeCduToMid} (FWS Return)</text>

                    <!-- 2. 中間換熱/製冷設備模組 (PHE 或 水冷冰機) -->
                    <rect x="510" y="${boxTop}" width="200" height="${boxH}" rx="10" fill="${midTheme.fill}" stroke="${midTheme.stroke}" stroke-width="2" />
                    <rect x="510" y="${boxTop}" width="200" height="30" rx="10" fill="${midTheme.headerFill}" />
                    <text x="610" y="${boxTop + 20}" fill="#f1f5f9" font-size="12" font-weight="bold" text-anchor="middle" ${fitTextAttr(nMid.title || '換熱設備', 180, 12)}>${nMid.title || '換熱設備'}</text>
                    
                    ${midIconSvg}
                    
                    <text x="630" y="${boxTop + 65}" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle" ${fitTextAttr(nMid.lines?.[0] || '', 140, 12)}>${nMid.lines?.[0] || ''}</text>
                    <text x="630" y="${boxTop + 92}" fill="${midTheme.textStroke}" font-size="11" font-weight="bold" text-anchor="middle" ${fitTextAttr(nMid.lines?.[1] || '', 140, 11)}>${nMid.lines?.[1] || ''}</text>
                    <text x="630" y="${boxTop + 118}" fill="#cbd5e1" font-size="10" text-anchor="middle" ${fitTextAttr(nMid.lines?.[2] || '', 140, 10)}>${nMid.lines?.[2] || ''}</text>
                    <text x="630" y="${boxTop + 142}" fill="#94a3b8" font-size="9.5" text-anchor="middle" ${fitTextAttr(nMid.lines?.[3] || '', 140, 9.5)}>${nMid.lines?.[3] || ''}</text>

                    <!-- 3. 室外側循環管路與水泵 -->
                    <line x1="710" y1="${rowSupplyY}" x2="745" y2="${rowSupplyY}" stroke="${theme.loopColor}" stroke-width="4" stroke-linecap="round" />
                    
                    <!-- 循環水泵 -->
                    <circle cx="760" cy="${rowSupplyY}" r="15" fill="${theme.pumpFill}" stroke="${theme.pumpStroke}" stroke-width="2" />
                    <polygon points="755,${rowSupplyY - 6} 767,${rowSupplyY} 755,${rowSupplyY + 6}" fill="#ffffff" />
                    <text x="760" y="${rowSupplyY + 28}" fill="${theme.pumpStroke}" font-size="10" font-weight="bold" text-anchor="middle" ${fitTextAttr(nPumpOut?.title || 'Circulation Pump', 98, 10)}>${nPumpOut?.title || 'Circulation Pump'}</text>

                    <!-- 水泵出水至室外設備 -->
                    <line x1="775" y1="${rowSupplyY}" x2="820" y2="${rowSupplyY}" stroke="${theme.loopColor}" stroke-width="4" stroke-linecap="round" />

                    <!-- 室外設備回水管至中間設備 -->
                    <line x1="820" y1="${rowReturnY}" x2="710" y2="${rowReturnY}" stroke="${theme.loopColor}" stroke-width="4" stroke-linecap="round" />

                    <!-- 4. 室外排熱設備模組 -->
                    <rect x="820" y="${boxTop}" width="315" height="${boxH}" rx="10" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2" />
                    <rect x="820" y="${boxTop}" width="315" height="30" rx="10" fill="#0f172a" />
                    <text x="977" y="${boxTop + 20}" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle" ${fitTextAttr(nRej.title || '室外排熱設備', 290, 13)}>${nRej.title || '室外排熱設備'}</text>
                    
                    <text x="840" y="${boxTop + 62}" fill="#f1f5f9" font-size="12" font-weight="bold" ${fitTextAttr(nRej.lines?.[0] || '', 275, 12)}>${nRej.lines?.[0] || ''}</text>
                    <text x="840" y="${boxTop + 88}" fill="#a7f3d0" font-size="11" ${fitTextAttr(nRej.lines?.[1] || '', 275, 11)}>${nRej.lines?.[1] || ''}</text>
                    <text x="840" y="${boxTop + 115}" fill="#cbd5e1" font-size="10.5" ${fitTextAttr(nRej.lines?.[2] || '', 275, 10.5)}>${nRej.lines?.[2] || ''}</text>
                    <text x="840" y="${boxTop + 140}" fill="#94a3b8" font-size="9.5" ${fitTextAttr(nRej.lines?.[3] || '', 275, 9.5)}>${nRej.lines?.[3] || ''}</text>

                    <!-- 5. 廠務冷供水總管 (Mid Box ⇄ Secondary Pump ⇄ CDU) -->
                    <line x1="510" y1="${rowReturnY}" x2="445" y2="${rowReturnY}" stroke="#059669" stroke-width="4.5" stroke-linecap="round" />

                    <!-- Secondary Pump (二次側設施主供水泵 / 一次側冰水泵) -->
                    <circle cx="430" cy="${rowReturnY}" r="15" fill="#065f46" stroke="#34d399" stroke-width="2" />
                    <polygon points="436,${rowReturnY - 6} 424,${rowReturnY} 436,${rowReturnY + 6}" fill="#ffffff" />
                    <text x="430" y="${rowReturnY + 28}" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle" ${fitTextAttr(nPumpSec.title || 'Secondary Pump', 98, 10)}>${nPumpSec.title || 'Secondary Pump'}</text>

                    <line x1="415" y1="${rowReturnY}" x2="320" y2="${rowReturnY}" stroke="#059669" stroke-width="4.5" stroke-linecap="round" />

                    <rect x="365" y="${rowReturnY + 38}" width="135" height="24" rx="5" fill="#064e3b" stroke="#10b981" stroke-width="1.5" />
                    <text x="432" y="${rowReturnY + 54}" fill="#d1fae5" font-size="10.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(`冷供水: ${pipeMidToCdu} (FWS Supply)`, 126, 10.5)}>冷供水: ${pipeMidToCdu} (FWS Supply)</text>
                `;
            } else {
                // Direct single loop configuration (no PHE, no intermediate box): CDU ⇄ Pump ⇄ Outdoor Unit
                const pipeCduToRej = getPipe('cdu', 'heat_rejection', `${fwsReturnC}°C`);
                const pipeRejToCdu = getPipe('heat_rejection', 'cdu', `${fwsSupplyC}°C`);
                const rejBoxX = 750;
                const rejBoxW = 385;

                facilitySchematicSvg = `
                    <!-- 1. 廠務熱回水總管 (CDU 直通室外排熱設備) -->
                    <line x1="320" y1="${rowSupplyY}" x2="${rejBoxX}" y2="${rowSupplyY}" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round" />
                    
                    <rect x="480" y="65" width="165" height="24" rx="5" fill="#881337" stroke="#f43f5e" stroke-width="1.5" />
                    <text x="562" y="81" fill="#ffe4e6" font-size="10.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(`熱回水: ${pipeCduToRej} (FWS Return)`, 155, 10.5)}>熱回水: ${pipeCduToRej} (FWS Return)</text>

                    <!-- 2. 室外排熱設備模組 (直冷式密閉水塔 / 乾冷器) -->
                    <rect x="${rejBoxX}" y="${boxTop}" width="${rejBoxW}" height="${boxH}" rx="10" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="2" />
                    <rect x="${rejBoxX}" y="${boxTop}" width="${rejBoxW}" height="30" rx="10" fill="#0f172a" />
                    <text x="${rejBoxX + rejBoxW / 2}" y="${boxTop + 20}" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle" ${fitTextAttr(nRej.title || '室外排熱設備', 355, 13)}>${nRej.title || '室外排熱設備'}</text>
                    
                    <text x="${rejBoxX + 20}" y="${boxTop + 62}" fill="#f1f5f9" font-size="12" font-weight="bold" ${fitTextAttr(nRej.lines?.[0] || '', 345, 12)}>${nRej.lines?.[0] || ''}</text>
                    <text x="${rejBoxX + 20}" y="${boxTop + 88}" fill="#a7f3d0" font-size="11" ${fitTextAttr(nRej.lines?.[1] || '', 345, 11)}>${nRej.lines?.[1] || ''}</text>
                    <text x="${rejBoxX + 20}" y="${boxTop + 115}" fill="#cbd5e1" font-size="10.5" ${fitTextAttr(nRej.lines?.[2] || '', 345, 10.5)}>${nRej.lines?.[2] || ''}</text>
                    <text x="${rejBoxX + 20}" y="${boxTop + 140}" fill="#94a3b8" font-size="9.5" ${fitTextAttr(nRej.lines?.[3] || '', 345, 9.5)}>${nRej.lines?.[3] || ''}</text>

                    <!-- 3. 廠務冷供水總管 (室外設備 ⇄ 循環水泵 ⇄ CDU) -->
                    <line x1="${rejBoxX}" y1="${rowReturnY}" x2="445" y2="${rowReturnY}" stroke="#059669" stroke-width="4.5" stroke-linecap="round" />

                    <!-- Primary Circulation Pump (一次側主循環泵) -->
                    <circle cx="430" cy="${rowReturnY}" r="15" fill="#065f46" stroke="#34d399" stroke-width="2" />
                    <polygon points="436,${rowReturnY - 6} 424,${rowReturnY} 436,${rowReturnY + 6}" fill="#ffffff" />
                    <text x="430" y="${rowReturnY + 28}" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle" ${fitTextAttr(nPumpSec.title || 'Circulation Pump', 98, 10)}>${nPumpSec.title || 'Circulation Pump'}</text>

                    <line x1="415" y1="${rowReturnY}" x2="320" y2="${rowReturnY}" stroke="#059669" stroke-width="4.5" stroke-linecap="round" />

                    <rect x="480" y="${rowReturnY + 38}" width="165" height="24" rx="5" fill="#064e3b" stroke="#10b981" stroke-width="1.5" />
                    <text x="562" y="${rowReturnY + 54}" fill="#d1fae5" font-size="10.5" font-weight="bold" text-anchor="middle" ${fitTextAttr(`冷供水: ${pipeRejToCdu} (FWS Supply)`, 155, 10.5)}>冷供水: ${pipeRejToCdu} (FWS Supply)</text>
                `;
            }

            return `
                <div class="p-4 bg-slate-950 rounded-2xl text-white font-mono border border-slate-800 shadow-xl overflow-hidden">
                    <style>
                        .valve-glyph { fill: #1e293b; stroke: #94a3b8; stroke-width: 1.5; }
                    </style>

                    <!-- 頂部標題與 NVIDIA 參考規範標籤 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs pb-3 border-b border-slate-800/80 gap-2">
                        <div class="flex items-center gap-2">
                            ${model?.referenceLabel ? `<span class="inline-flex items-center justify-center px-3 py-1 rounded-md bg-emerald-950 text-emerald-300 font-black text-xs border border-emerald-700">${model.referenceLabel}</span>` : ''}
                            <span class="font-bold text-slate-100 text-sm">${model?.title || '設施排熱拓樸 (Facility Heat Rejection)'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded-md bg-purple-950/80 text-purple-300 text-xs font-bold border border-purple-800 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-purple-400"></span>
                                排熱架構: ${nRej.title || '排熱設備'}
                            </span>
                        </div>
                    </div>

                    <!-- 運轉模式狀態橫幅 -->
                    <div class="grid grid-cols-1 md:grid-cols-${Math.min(model?.banners?.length || 1, 3)} gap-2 my-2.5 text-xs">
                        ${(model?.banners || []).map(b => {
                            const toneMap = {
                                emerald: { bg: 'bg-emerald-950/40', border: 'border-emerald-800/60', text: 'text-emerald-300', dot: 'bg-emerald-400' },
                                amber: { bg: 'bg-amber-950/40', border: 'border-amber-800/60', text: 'text-amber-300', dot: 'bg-amber-400' },
                                red: { bg: 'bg-red-950/40', border: 'border-red-800/60', text: 'text-red-300', dot: 'bg-red-400' },
                                indigo: { bg: 'bg-indigo-950/40', border: 'border-indigo-800/60', text: 'text-indigo-300', dot: 'bg-indigo-400' },
                                teal: { bg: 'bg-teal-950/40', border: 'border-teal-800/60', text: 'text-teal-300', dot: 'bg-teal-400' },
                                blue: { bg: 'bg-blue-950/40', border: 'border-blue-800/60', text: 'text-blue-300', dot: 'bg-blue-400' },
                                slate: { bg: 'bg-slate-900', border: 'border-slate-700', text: 'text-slate-300', dot: 'bg-slate-400' }
                            };
                            const tCls = toneMap[b.tone] || toneMap.emerald;
                            return `
                                <div class="p-2.5 rounded-lg ${tCls.bg} border ${tCls.border} flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${tCls.dot}"></span>
                                    <span class="${tCls.text} font-bold text-sm">${b.label}</span>
                                    <span class="text-slate-300 ml-auto">${b.detail || ''}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- SVG 拓樸畫布 (viewBox 0 0 1260 330，標準工程正交佈局、零重疊、大字體) -->
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
                            <!-- Secondary Return -->
                            <line x1="150" y1="95" x2="190" y2="95" stroke="#f43f5e" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="68" width="40" height="18" rx="3" fill="#881337" />
                            <text x="170" y="81" fill="#ffe4e6" font-size="8" font-weight="bold" text-anchor="middle">≤${secReturnC}°C</text>

                            <!-- Secondary Supply -->
                            <line x1="190" y1="245" x2="150" y2="245" stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
                            <rect x="150" y="218" width="40" height="18" rx="3" fill="#0c4a6e" />
                            <text x="170" y="231" fill="#e0f2fe" font-size="8" font-weight="bold" text-anchor="middle">≤${secSupplyC}°C</text>

                            <!-- 3. CDU - LC (100% 液冷分配單元) -->
                            <rect x="190" y="35" width="130" height="250" rx="10" fill="#1e1b4b" stroke="#8b5cf6" stroke-width="2" />
                            <rect x="190" y="35" width="130" height="28" rx="10" fill="#3b0764" />
                            <text x="255" y="54" fill="#faf5ff" font-size="11.5" font-weight="bold" text-anchor="middle">CDU - LC (100%)</text>

                            <rect x="200" y="72" width="110" height="95" rx="8" fill="#0f172a" stroke="#6d28d9" stroke-width="1.5" />
                            <!-- CDU 板換內部板片 -->
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
                            ${(() => {
                                const th = op?.thresholds;
                                const basis = th?.basis;
                                if (basis === 'db') {
                                    return `
                                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                                        <span>自然冷卻門檻: <strong class="text-emerald-300">DB ≤ ${th.full}°C</strong></span>
                                    `;
                                }
                                if (basis === 'wb') {
                                    return `
                                        <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                                        <span>自然冷卻門檻: <strong class="text-cyan-300">WB ≤ ${th.full}°C</strong></span>
                                    `;
                                }
                                if (basis === 'db_eff') {
                                    return `
                                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                                        <span>自然冷卻門檻: <strong class="text-emerald-300">乾式 DB ≤ ${th.switchpoint}°C ／ 噴霧後有效乾球 ≤ ${th.full}°C</strong></span>
                                    `;
                                }
                                if (basis === 'none') {
                                    return `
                                        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                                        <span>冷卻模式: <strong class="text-amber-300">無自然冷卻（全年機械製冷）</strong></span>
                                        <span class="text-amber-400 font-bold text-[10px] ml-1">⚠️ 建議改用閉式塔或加裝水側經濟器</span>
                                    `;
                                }
                                return `
                                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    <span>自然冷卻門檻: <strong class="text-emerald-300">≤${cduFcThresh}°C</strong></span>
                                `;
                            })()}
                        </div>
                    </div>

                    ${(model?.warnings && model.warnings.length > 0) ? `
                        <div class="mt-2.5 p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-center gap-2 text-xs text-amber-300">
                            <span class="text-base">⚠️</span>
                            <span>${model.warnings.join(' ｜ ')}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
