'use strict';
/**
 * schematic_common.js - Shared utilities for cooling schematic SVG views.
 * Provides unified 2-line status banner renderer across Trim, Fanwall, and single-loop topologies.
 */
(function (root) {
    const toneMap = {
        emerald: { bg: 'bg-emerald-950/40', border: 'border-emerald-800/60', text: 'text-emerald-300', dot: 'bg-emerald-400' },
        amber: { bg: 'bg-amber-950/40', border: 'border-amber-800/60', text: 'text-amber-300', dot: 'bg-amber-400' },
        red: { bg: 'bg-red-950/40', border: 'border-red-800/60', text: 'text-red-300', dot: 'bg-red-400' },
        indigo: { bg: 'bg-indigo-950/40', border: 'border-indigo-800/60', text: 'text-indigo-300', dot: 'bg-indigo-400' },
        teal: { bg: 'bg-teal-950/40', border: 'border-teal-800/60', text: 'text-teal-300', dot: 'bg-teal-400' },
        blue: { bg: 'bg-blue-950/40', border: 'border-blue-800/60', text: 'text-blue-300', dot: 'bg-blue-400' },
        slate: { bg: 'bg-slate-900', border: 'border-slate-700', text: 'text-slate-300', dot: 'bg-slate-400' }
    };

    const CoolingSchematicCommon = {
        renderBanners(banners) {
            if (!Array.isArray(banners) || banners.length === 0) return '';
            const cols = Math.min(banners.length, 3);
            return `
                <div class="grid grid-cols-1 md:grid-cols-${cols} gap-2 my-2.5 text-xs">
                    ${banners.map(b => {
                        const tone = toneMap[b.tone] || toneMap.emerald;
                        const line1 = b.title || b.label;
                        const line2 = b.sub || b.detail || '';
                        return `
                            <div class="p-2.5 rounded-lg ${tone.bg} border ${tone.border} flex flex-col gap-1">
                                <div class="flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full ${tone.dot} shrink-0"></span>
                                    <span class="${tone.text} font-bold text-xs">${line1}</span>
                                </div>
                                ${line2 ? `<div class="text-[11px] text-slate-300 pl-4.5 whitespace-nowrap overflow-hidden text-ellipsis">${line2}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    };

    root.CoolingSchematicCommon = CoolingSchematicCommon;
    if (root.CoolingSchematics) {
        root.CoolingSchematics.common = CoolingSchematicCommon;
        root.CoolingSchematics.renderBanners = CoolingSchematicCommon.renderBanners;
    }
})(typeof window !== 'undefined' ? window : this);
