'use strict';

/**
 * i18n_zh.js - Traditional Chinese (zh-TW) Dictionary
 */
(function(root) {
  const dict = {
    // Header & App
    'app.title': 'PUE 計算系統',
    'app.version': 'v33',
    'app.subtitle': '全球 8,760hr 年度PUE估算',
    'app.save': '儲存專案',
    'app.open': '開啟專案',
    'app.reset': '重置',
    'app.resetTitle': '重置為初始範例專案',

    // Sticky KPI Bar
    'kpi.designPue': '設計 PUE',
    'kpi.waterWue': '耗水 WUE',
    'kpi.itCapacity': 'IT 容量',
    'kpi.freeCooling': '自然冷卻 FC',
    'kpi.freeCoolingTitle': 'CDU 液冷自然冷卻時數佔比 (Free Cooling Ratio)',

    // Steps Navigation
    'nav.step1': '案場氣象',
    'nav.step2': '機房與單元',
    'nav.step3': 'CorePOD',
    'nav.step4': '冷卻系統設計',
    'nav.step5': '能耗儀表板',

    // Sample interpolation
    'step4.deficitMsg': '尚有 {n} 項設備容量未達 {redundancy} 規範'
  };

  const target = (typeof window !== 'undefined' ? window.I18N : (typeof global !== 'undefined' ? global.I18N : null));
  if (target) {
    target.dict = target.dict || {};
    target.dict['zh-TW'] = Object.assign(target.dict['zh-TW'] || {}, dict);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = dict;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
