/**
 * equipment_designer.js - Reusable Equipment Designer Component (V10)
 */
(function(window) {
    'use strict';

    const QUICK_ADD_CATALOG = {
        GPU: [
            { model: 'NVIDIA Vera Rubin VR200 NVL72', itLoadKw: 227, liquidPct: 95, airPct: 5, category: 'GPU' },
            { model: 'NVIDIA Blackwell GB300 NVL72', itLoadKw: 144, liquidPct: 90, airPct: 10, category: 'GPU' },
            { model: 'NVIDIA Blackwell GB200 NVL72', itLoadKw: 120, liquidPct: 90, airPct: 10, category: 'GPU' },
            { model: 'NVIDIA DGX H200 (8-GPU HGX)', itLoadKw: 13, liquidPct: 63, airPct: 37, category: 'GPU' }
        ],
        IB: [
            { model: 'NDR Leaf Switch (64p)', itLoadKw: 6, liquidPct: 0, airPct: 100, category: 'IB' },
            { model: 'NDR Spine Switch (Modular)', itLoadKw: 15, liquidPct: 0, airPct: 100, category: 'IB' },
            { model: 'XDR Spine Switch 800G', itLoadKw: 20, liquidPct: 0, airPct: 100, category: 'IB' }
        ],
        CIN: [
            { model: '400G Spine Chassis', itLoadKw: 12, liquidPct: 0, airPct: 100, category: 'CIN' },
            { model: '100G Leaf Switch (ToR)', itLoadKw: 8, liquidPct: 0, airPct: 100, category: 'CIN' }
        ],
        'N/S': [
            { model: 'Border Core Router', itLoadKw: 12, liquidPct: 0, airPct: 100, category: 'N/S' },
            { model: 'NGFW & SLB Firewall', itLoadKw: 10, liquidPct: 0, airPct: 100, category: 'N/S' }
        ],
        STG: [
            { model: 'NVMe Flash Storage JBOF', itLoadKw: 18, liquidPct: 0, airPct: 100, category: 'STG' },
            { model: 'Lustre / GPFS Storage', itLoadKw: 22, liquidPct: 0, airPct: 100, category: 'STG' }
        ],
        MGMT: [
            { model: 'SMN / K8s Cluster Rack', itLoadKw: 10, liquidPct: 0, airPct: 100, category: 'MGMT' }
        ]
    };

    const EquipmentDesigner = {
        render(containerId, options) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const eqList = options.equipment || [];
            const lossPct = options.electricalLossFactorPct || 8.0;
            const allowGpu = options.allowGpu !== false;

            let totalItKw = 0;
            let liquidHeatKw = 0;
            let airHeatKw = 0;

            eqList.forEach(item => {
                const qty = item.qty || 1;
                const it = (item.itLoadKw || 0) * qty;
                const liq = it * ((item.liquidPct || 0) / 100);
                const air = it - liq;
                totalItKw += it;
                liquidHeatKw += liq;
                airHeatKw += air;
            });
            const dlcPct = totalItKw > 0 ? (liquidHeatKw / totalItKw) * 100 : 0;

            let chipsHtml = '';
            const categories = allowGpu ? ['GPU', 'IB', 'CIN', 'N/S', 'STG', 'MGMT'] : ['IB', 'CIN', 'N/S', 'STG', 'MGMT'];
            categories.forEach(cat => {
                chipsHtml += '<div class="flex items-center gap-1.5 flex-wrap"><span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">' + cat + ':</span>';
                (QUICK_ADD_CATALOG[cat] || []).forEach(item => {
                    chipsHtml += '<button onclick="EquipmentDesigner.handleQuickAdd(\'' + containerId + '\', \'' + cat + '\', \'' + item.model + '\')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition border border-slate-200/80">+ ' + item.model + ' (' + item.itLoadKw + 'kW)</button>';
                });
                chipsHtml += '</div>';
            });

            let tableRows = '';
            eqList.forEach((item, idx) => {
                const qty = item.qty || 1;
                const rowTotalKw = (item.itLoadKw * qty).toFixed(1);
                const rowLiqKw = (item.itLoadKw * qty * (item.liquidPct / 100)).toFixed(1);

                tableRows += '<tr class="border-b border-slate-100 hover:bg-slate-50/60 text-xs">'
                    + '<td class="py-2.5 px-3"><span class="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ' + (item.category === 'GPU' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800') + '">' + window.UIKit.escapeHTML(item.category || 'CUSTOM') + '</span></td>'
                    + '<td class="py-2.5 px-3"><input type="text" value="' + window.UIKit.escapeHTML(item.model) + '" onchange="EquipmentDesigner.updateItem(\'' + containerId + '\', ' + idx + ', \'model\', this.value)" class="w-full font-bold text-slate-800 border border-transparent hover:border-slate-300 focus:border-purple-500 rounded p-1 bg-transparent"></td>'
                    + '<td class="py-2.5 px-3 text-center"><input type="number" value="' + item.qty + '" min="1" max="128" step="1" oninput="EquipmentDesigner.updateItem(\'' + containerId + '\', ' + idx + ', \'qty\', parseInt(this.value,10)||1)" class="w-14 text-center font-bold text-slate-900 border rounded p-1 bg-white"></td>'
                    + '<td class="py-2.5 px-3 text-right"><input type="number" value="' + item.itLoadKw + '" min="0" max="500" step="0.5" oninput="EquipmentDesigner.updateItem(\'' + containerId + '\', ' + idx + ', \'itLoadKw\', parseFloat(this.value)||0)" class="w-16 text-right font-bold text-slate-900 border rounded p-1 bg-white"> kW</td>'
                    + '<td class="py-2.5 px-3 text-center"><div class="flex items-center justify-center gap-1"><input type="number" value="' + item.liquidPct + '" min="0" max="100" step="1" oninput="EquipmentDesigner.updateItemLiquid(\'' + containerId + '\', ' + idx + ', parseFloat(this.value)||0)" class="w-12 text-center font-bold text-emerald-700 border rounded p-1 bg-white"> %</div></td>'
                    + '<td class="py-2.5 px-3 text-right font-extrabold text-purple-900">' + rowTotalKw + ' kW<div class="text-[10px] text-emerald-700 font-normal">💧 ' + rowLiqKw + ' kW</div></td>'
                    + '<td class="py-2.5 px-3 text-center"><button onclick="EquipmentDesigner.deleteItem(\'' + containerId + '\', ' + idx + ')" class="text-slate-400 hover:text-red-500 font-bold p-1">✕</button></td>'
                    + '</tr>';
            });

            container.innerHTML = '<div class="space-y-4 bg-white p-5 rounded-2xl border border-slate-200">'
                + '<div class="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">'
                + '<div class="flex justify-between items-center mb-1"><span class="text-xs font-extrabold text-slate-700">⚡ 快速加入標準型號 (Quick Add)</span><button onclick="EquipmentDesigner.addCustomItem(\'' + containerId + '\')" class="text-xs font-bold text-purple-700 hover:underline">➕ 自訂設備</button></div>'
                + chipsHtml
                + '</div>'
                + '<div class="overflow-x-auto"><table class="w-full text-left border-collapse">'
                + '<thead><tr class="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b"><th class="py-2 px-3">類別</th><th class="py-2 px-3">設備型號名稱</th><th class="py-2 px-3 text-center">台數</th><th class="py-2 px-3 text-right">單台功耗</th><th class="py-2 px-3 text-center">液冷比</th><th class="py-2 px-3 text-right">小計 IT (液冷)</th><th class="py-2 px-3 text-center">操作</th></tr></thead>'
                + '<tbody>' + (tableRows || '<tr><td colspan="7" class="py-6 text-center text-xs text-slate-400">目前清單為空，請點選上方按鈕快速加入設備</td></tr>') + '</tbody>'
                + '</table></div>'
                + '<div class="pt-4 border-t">'
                + '<div class="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200"><div><span class="text-[10px] font-bold text-slate-400 uppercase">總 IT 負載</span><div class="text-base font-black text-slate-900 mt-0.5">' + totalItKw.toFixed(1) + ' kW</div></div><div><span class="text-[10px] font-bold text-emerald-800 uppercase">💧 液冷散熱量</span><div class="text-base font-black text-emerald-950 mt-0.5">' + liquidHeatKw.toFixed(1) + ' kW <span class="text-[10px] font-semibold">(' + dlcPct.toFixed(1) + '%)</span></div></div><div><span class="text-[10px] font-bold text-amber-800 uppercase">💨 氣冷散熱量</span><div class="text-base font-black text-amber-950 mt-0.5">' + airHeatKw.toFixed(1) + ' kW</div></div></div>'
                + '</div></div>';

            container._designerOptions = options;
        },

        handleQuickAdd(containerId, category, model) {
            const container = document.getElementById(containerId);
            if (!container || !container._designerOptions) return;
            const itemDef = (QUICK_ADD_CATALOG[category] || []).find(m => m.model === model);
            if (!itemDef) return;

            const options = container._designerOptions;
            const newItem = {
                id: 'eq_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                category: itemDef.category,
                model: itemDef.model,
                qty: 1,
                itLoadKw: itemDef.itLoadKw,
                liquidPct: itemDef.liquidPct,
                airPct: itemDef.airPct
            };

            options.equipment.push(newItem);
            if (options.onChange) options.onChange(options.equipment, options.electricalLossFactorPct);
            this.render(containerId, options);
        },

        addCustomItem(containerId) {
            const container = document.getElementById(containerId);
            if (!container || !container._designerOptions) return;
            const options = container._designerOptions;

            const newItem = {
                id: 'eq_' + Date.now(),
                category: 'CUSTOM',
                model: '自訂設備單元',
                qty: 1,
                itLoadKw: 10.0,
                liquidPct: 0,
                airPct: 100
            };

            options.equipment.push(newItem);
            if (options.onChange) options.onChange(options.equipment, options.electricalLossFactorPct);
            this.render(containerId, options);
        },

        deleteItem(containerId, idx) {
            const container = document.getElementById(containerId);
            if (!container || !container._designerOptions) return;
            const options = container._designerOptions;
            options.equipment.splice(idx, 1);
            if (options.onChange) options.onChange(options.equipment, options.electricalLossFactorPct);
            this.render(containerId, options);
        },

        updateItem(containerId, idx, field, val) {
            const container = document.getElementById(containerId);
            if (!container || !container._designerOptions) return;
            const options = container._designerOptions;
            if (options.equipment[idx]) {
                options.equipment[idx][field] = val;
                if (options.onChange) options.onChange(options.equipment, options.electricalLossFactorPct);
                this.render(containerId, options);
            }
        },

        updateItemLiquid(containerId, idx, liqPct) {
            const container = document.getElementById(containerId);
            if (!container || !container._designerOptions) return;
            const options = container._designerOptions;
            if (options.equipment[idx]) {
                options.equipment[idx].liquidPct = liqPct;
                options.equipment[idx].airPct = 100 - liqPct;
                if (options.onChange) options.onChange(options.equipment, options.electricalLossFactorPct);
                this.render(containerId, options);
            }
        },

        updateLossPct(containerId, lossPct) {
            const container = document.getElementById(containerId);
            if (!container || !container._designerOptions) return;
            const options = container._designerOptions;
            options.electricalLossFactorPct = lossPct;
            if (options.onChange) options.onChange(options.equipment, options.electricalLossFactorPct);
            this.render(containerId, options);
        }
    };

    window.EquipmentDesigner = EquipmentDesigner;
})(window);
