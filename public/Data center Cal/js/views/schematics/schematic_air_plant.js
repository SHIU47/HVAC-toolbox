'use strict';
/**
 * schematic_air_plant.js - Air & Fanwall Heat Rejection System Topology SVG
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

    root.CoolingSchematics.register('air_plant', {
        render(ctx) {
            const t = ctx.t || {};
            const fwSys = ctx.fwSys || t.obj?.plantDesign?.fanwallSystem || {};
            const fwArch = ctx.fwArch || fwSys.architecture || 'air_cooled_chiller';
            const fwArchDesc = (typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(fwArch) : null;

            const designCond = (typeof AppStore !== 'undefined' && AppStore.designConditions) ? AppStore.designConditions() : { designDb: 35.0, designWb: 28.0 };
            const equip = (typeof AppStore !== 'undefined' && AppStore.resolveEquipment && fwArchDesc) ? AppStore.resolveEquipment(fwArchDesc, fwSys) : {};
            const op = fwArchDesc?.operatingPoint ? fwArchDesc.operatingPoint(fwSys, { db: designCond.designDb, wb: designCond.designWb }, equip) : null;
            const model = fwArchDesc?.topology ? fwArchDesc.topology(fwSys, op, designCond) : null;

            const nCrah = model?.nodes?.find(n => n.id === 'crah' || n.id === 'rdhx') || {};
            const nEvap = model?.nodes?.find(n => n.id === 'evaporator') || {};
            const nRej = model?.nodes?.find(n => n.id === 'heat_rejection') || {};
            const nPump = model?.nodes?.find(n => n.id === 'pump') || {};
            const nPumpCw = model?.nodes?.find(n => n.id === 'pump_cw') || null;

            const getPipe = (from, to, fallback = '') => model?.pipes?.find(p => p.from === from && p.to === to)?.label || fallback;

            const airLoadKw = (fwSys.designBasis?.air_load_kw || ((t.summ?.airHeatKw || 0) + (t.summ?.lossKw || 0)) || 0);
            const chwSupplyC = op?.temps?.chwSup ?? fwSys.chwSupplyC ?? 12.0;
            const chwReturnC = op?.temps?.chwRet ?? fwSys.chwReturnC ?? 18.0;
            const dtChw = Math.max(1.0, chwReturnC - chwSupplyC);
            const flowChwLpm = Math.round((airLoadKw * 60) / (4.184 * dtChw));

            const roomAir = t.obj?.roomAir || {};
            const coldAisleC = roomAir.coldAisleC ?? 24;
            const hotAisleC = roomAir.hotAisleC ?? 36;
            const deltaAirC = Math.max(1, hotAisleC - coldAisleC);

            const isRdhx = nCrah.kind === 'rdhx' || !!fwArchDesc?.flags?.isRdhx;
            const fwUnitItem = (fwSys.sizing || []).find(s => s.key === (isRdhx ? 'rdhx_unit' : 'crah_unit'));
            const fwUnitQty = fwUnitItem ? fwUnitItem.selectedQty : 4;

            const plantThemeMap = {
                chiller: {
                    evapHeaderFill: '#312e81',
                    evapStroke: '#6366f1',
                    evapIconStroke: '#a5b4fc',
                    rejFill: '#1e1b4b',
                    rejStroke: '#6366f1',
                    rejHeaderFill: '#0f172a',
                    loopColor: '#6366f1'
                },
                tower: {
                    evapHeaderFill: '#1e3a8a',
                    evapStroke: '#3b82f6',
                    evapIconStroke: '#93c5fd',
                    rejFill: '#082f49',
                    rejStroke: '#0284c7',
                    rejHeaderFill: '#0f172a',
                    loopColor: '#0284c7'
                },
                district: {
                    evapHeaderFill: '#134e4a',
                    evapStroke: '#0d9488',
                    evapIconStroke: '#5eead4',
                    rejFill: '#042f2e',
                    rejStroke: '#0d9488',
                    rejHeaderFill: '#0f172a',
                    loopColor: '#0d9488'
                },
                dry_cooler: {
                    evapHeaderFill: '#3b0764',
                    evapStroke: '#8b5cf6',
                    evapIconStroke: '#d8b4fe',
                    rejFill: '#2e1065',
                    rejStroke: '#8b5cf6',
                    rejHeaderFill: '#0f172a',
                    loopColor: '#8b5cf6'
                }
            };
            const theme = plantThemeMap[nRej.kind] || plantThemeMap.chiller;

            const crahId = nCrah.id || 'crah';
            const pipeCrahToEvap = getPipe(crahId, 'evaporator', `${chwReturnC}°C`);
            const pipeEvapToCrah = getPipe('evaporator', crahId, `${chwSupplyC}°C`);

            const fwPlantSvg = `
                <!-- 蒸發器換熱核心 (Evaporator / PHE) -->
                <rect x="510" y="70" width="200" height="175" rx="10" fill="#0f172a" stroke="${theme.evapStroke}" stroke-width="2" />
                <rect x="510" y="70" width="200" height="30" rx="10" fill="${theme.evapHeaderFill}" />
                <text x="610" y="90" fill="#e0e7ff" font-size="12" font-weight="bold" text-anchor="middle">${nEvap.title || '冰水蒸發器 (CHW Evaporator)'}</text>
                
                <rect x="525" y="118" width="26" height="100" rx="4" fill="#1e293b" stroke="${theme.evapStroke}" stroke-width="1.2" />
                <path d="M 531 128 L 542 143 L 531 158 M 538 128 L 549 143 L 538 158 M 531 158 L 542 173 L 531 188 M 538 158 L 549 173 L 538 188" stroke="${theme.evapIconStroke}" stroke-width="1.5" fill="none" stroke-linecap="round" />
                <text x="630" y="135" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">${nEvap.lines?.[0] || '機械壓縮製冷'}</text>
                <text x="630" y="162" fill="${theme.evapIconStroke}" font-size="11" font-weight="bold" text-anchor="middle">${nEvap.lines?.[1] || `供水 ${chwSupplyC}°C ⇄ 回水 ${chwReturnC}°C`}</text>
                <text x="630" y="188" fill="#cbd5e1" font-size="10" text-anchor="middle">${nEvap.lines?.[2] || '全時連續供冷・穩定控溫'}</text>
                <text x="630" y="212" fill="#94a3b8" font-size="9.5" text-anchor="middle">${nEvap.lines?.[3] || ''}</text>

                <!-- 室外排熱設備連結管路 -->
                ${nPumpCw ? `
                <line x1="710" y1="110" x2="745" y2="110" stroke="${theme.loopColor}" stroke-width="4" stroke-linecap="round" />
                <circle cx="760" cy="110" r="15" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
                <polygon points="755,104 767,110 755,116" fill="#ffffff" />
                <text x="760" y="138" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">${nPumpCw.title || 'CW Pump'}</text>
                <line x1="775" y1="110" x2="820" y2="110" stroke="${theme.loopColor}" stroke-width="4" stroke-linecap="round" />
                ` : `
                <line x1="710" y1="110" x2="820" y2="110" stroke="${theme.loopColor}" stroke-width="4" stroke-linecap="round" />
                `}
                <line x1="820" y1="200" x2="710" y2="200" stroke="${theme.loopColor}" stroke-width="4" stroke-linecap="round" />

                <!-- 室外排熱設備模組 -->
                <rect x="820" y="70" width="315" height="175" rx="10" fill="${theme.rejFill}" stroke="${theme.rejStroke}" stroke-width="2" />
                <rect x="820" y="70" width="315" height="30" rx="10" fill="${theme.rejHeaderFill}" />
                <text x="977" y="90" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">${nRej.title || '室外排熱機組'}</text>
                
                <text x="840" y="132" fill="#f1f5f9" font-size="12" font-weight="bold">${nRej.lines?.[0] || ''}</text>
                <text x="840" y="158" fill="${theme.evapIconStroke}" font-size="11">${nRej.lines?.[1] || ''}</text>
                <text x="840" y="185" fill="#cbd5e1" font-size="10.5">${nRej.lines?.[2] || ''}</text>
                <text x="840" y="210" fill="#94a3b8" font-size="9.5">${nRej.lines?.[3] || ''}</text>
            `;

            return `
                <div class="p-4 bg-slate-950 rounded-2xl text-white font-mono border border-slate-800 shadow-xl overflow-hidden">
                    <!-- 頂部標題 -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-xs pb-3 border-b border-slate-800/80 gap-2">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center justify-center px-3 py-1 rounded-md bg-indigo-950 text-indigo-300 font-black text-xs border border-indigo-700">Air Cooling Schematic</span>
                            <span class="font-bold text-slate-100 text-sm">${model?.title || '白區氣冷與輔助排熱拓樸 (Air & Fanwall Heat Rejection System)'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded-md bg-indigo-950/80 text-indigo-300 text-xs font-bold border border-indigo-800 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                                排熱架構: ${nRej.title || '氣冷系統'}
                            </span>
                        </div>
                    </div>

                    <!-- 運轉狀態橫幅 -->
                    <div class="grid grid-cols-1 md:grid-cols-${Math.min(model?.banners?.length || 1, 3)} gap-2 my-2.5 text-xs">
                        ${(model?.banners || []).map(b => {
                            const toneMap = {
                                emerald: { bg: 'bg-emerald-950/40', border: 'border-emerald-800/60', text: 'text-emerald-300', dot: 'bg-emerald-400' },
                                amber: { bg: 'bg-amber-950/40', border: 'border-amber-800/60', text: 'text-amber-300', dot: 'bg-amber-400' },
                                red: { bg: 'bg-red-950/40', border: 'border-red-800/60', text: 'text-red-300', dot: 'bg-red-400' },
                                indigo: { bg: 'bg-indigo-950/40', border: 'border-indigo-800/60', text: 'text-indigo-300', dot: 'bg-indigo-400' },
                                teal: { bg: 'bg-teal-950/40', border: 'border-teal-800/60', text: 'text-teal-300', dot: 'bg-teal-400' },
                                blue: { bg: 'bg-blue-950/40', border: 'border-blue-800/60', text: 'text-blue-300', dot: 'bg-blue-400' }
                            };
                            const tCls = toneMap[b.tone] || toneMap.indigo;
                            return `
                                <div class="p-2.5 rounded-lg ${tCls.bg} border ${tCls.border} flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${tCls.dot}"></span>
                                    <span class="${tCls.text} font-bold text-sm">${b.label}</span>
                                    <span class="text-slate-300 ml-auto">${b.detail || ''}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- SVG 畫布 (viewBox 0 0 1160 300) -->
                    <div class="w-full overflow-x-auto pt-1">
                        <svg viewBox="0 0 1160 300" class="w-full min-w-[1000px] h-auto select-none font-sans">
                            <!-- 1. 白區 IT 機櫃廢熱源 (Air Heat Load) -->
                            <rect x="20" y="25" width="150" height="250" rx="10" fill="#0f172a" stroke="#475569" stroke-width="2" />
                            <rect x="20" y="25" width="150" height="30" rx="10" fill="#1e293b" />
                            <text x="95" y="46" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">IT 白區氣流廢熱</text>

                            <rect x="30" y="70" width="130" height="65" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
                            <rect x="37" y="78" width="116" height="18" rx="4" fill="#334155" />
                            <circle cx="49" cy="87" r="3" fill="#6366f1" />
                            <circle cx="59" cy="87" r="3" fill="#38bdf8" />
                            <text x="100" y="91" fill="#f1f5f9" font-size="9.5" font-weight="bold" text-anchor="middle">網通 / 儲存 / 輔助廢熱</text>
                            <text x="95" y="123" fill="#818cf8" font-size="14" font-weight="900" text-anchor="middle">${airLoadKw.toFixed(0)} kW</text>

                            <text x="95" y="165" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">進風冷通道: ${coldAisleC}°C</text>
                            <text x="95" y="190" fill="#f43f5e" font-size="10.5" text-anchor="middle">排風熱通道: ${hotAisleC}°C</text>
                            <text x="95" y="215" fill="#94a3b8" font-size="9.5" text-anchor="middle">氣流溫升: ΔT ≈ ${deltaAirC}°C</text>

                            <!-- 2. 白區空調機組 (Fanwall / CRAH / RDHX) -->
                            <!-- 熱回風管路 -->
                            <line x1="170" y1="90" x2="210" y2="90" stroke="#f43f5e" stroke-width="4.5" stroke-linecap="round" />
                            <!-- 冷送風管路 -->
                            <line x1="210" y1="210" x2="170" y2="210" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />

                            <rect x="210" y="25" width="145" height="250" rx="10" fill="#1e1b4b" stroke="#6366f1" stroke-width="2" />
                            <rect x="210" y="25" width="145" height="30" rx="10" fill="#312e81" />
                            <text x="282" y="46" fill="#faf5ff" font-size="12" font-weight="bold" text-anchor="middle">${isRdhx ? 'RDHX 背板換熱器' : 'Fanwall / CRAH'}</text>

                            <rect x="222" y="70" width="121" height="100" rx="8" fill="#0f172a" stroke="#4f46e5" stroke-width="1.5" />
                            <!-- 空調盤管與風扇圖標 -->
                            <path d="M 245 80 L 245 160 M 255 80 L 255 160 M 265 80 L 265 160" stroke="#818cf8" stroke-width="2" stroke-linecap="round" />
                            <circle cx="295" cy="100" r="14" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.2" />
                            <text x="295" y="104" fill="#a5b4fc" font-size="9" font-weight="bold" text-anchor="middle">FAN</text>
                            <circle cx="295" cy="135" r="14" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.2" />
                            <text x="295" y="139" fill="#a5b4fc" font-size="9" font-weight="bold" text-anchor="middle">FAN</text>

                            <text x="282" y="195" fill="#e0e7ff" font-size="11" font-weight="bold" text-anchor="middle">${fwUnitQty} 台 (N+1)</text>
                            <text x="282" y="215" fill="#a5b4fc" font-size="9.5" text-anchor="middle">${isRdhx ? '背板無風扇/微風扇' : 'EC 變頻風機牆矩陣'}</text>
                            <text x="282" y="235" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle">冰水流量: ${flowChwLpm.toLocaleString()} LPM</text>

                            <!-- 3. 冰水管路 (CHW Piping & Secondary Pump) -->
                            <!-- CHW Return -->
                            <line x1="355" y1="110" x2="510" y2="110" stroke="#ea580c" stroke-width="4.5" stroke-linecap="round" />
                            <rect x="365" y="65" width="135" height="24" rx="5" fill="#881337" stroke="#f43f5e" stroke-width="1.5" />
                            <text x="432" y="81" fill="#ffe4e6" font-size="10" font-weight="bold" text-anchor="middle">回水: ${pipeCrahToEvap} (CHW Return)</text>

                            <!-- CHW Supply -->
                            <line x1="510" y1="200" x2="445" y2="200" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                            
                            <!-- CHW Secondary Pump -->
                            <circle cx="430" cy="200" r="15" fill="#0369a1" stroke="#38bdf8" stroke-width="2" />
                            <polygon points="436,194 424,200 436,206" fill="#ffffff" />
                            <text x="430" y="228" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">${nPump.title || 'CHW Pump'}</text>

                            <line x1="415" y1="200" x2="355" y2="200" stroke="#0284c7" stroke-width="4.5" stroke-linecap="round" />
                            <rect x="365" y="238" width="135" height="24" rx="5" fill="#0c4a6e" stroke="#0284c7" stroke-width="1.5" />
                            <text x="432" y="254" fill="#e0f2fe" font-size="10" font-weight="bold" text-anchor="middle">供水: ${pipeEvapToCrah} (CHW Supply)</text>

                            <!-- 4. 排熱與冰機拓樸 (Plant Schematic) -->
                            ${fwPlantSvg}
                        </svg>
                    </div>
                </div>
            `;
        }
    });
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
