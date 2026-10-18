'use strict';

/**
 * i18n_en.js - English (en) Dictionary
 */
(function(root) {
  const dict = {
    // Header & App
    'app.title': 'PUE Calculation System',
    'app.version': 'v33',
    'app.subtitle': 'Global 8,760hr Annual PUE Estimation',
    'app.save': 'Save Project',
    'app.open': 'Open Project',
    'app.reset': 'Reset',
    'app.resetTitle': 'Reset to Default Project',

    // Sticky KPI Bar
    'kpi.designPue': 'Design PUE',
    'kpi.waterWue': 'Water WUE',
    'kpi.itCapacity': 'IT Capacity',
    'kpi.freeCooling': 'Free Cooling FC',
    'kpi.freeCoolingTitle': 'CDU Liquid Cooling Free Cooling Hours Ratio',

    // Steps Navigation
    'nav.step1': 'Site Weather',
    'nav.step2': 'Data Halls & Units',
    'nav.step3': 'Core POD',
    'nav.step4': 'Cooling System Design',
    'nav.step5': 'Energy Dashboard',

    // Sample interpolation
    'step4.deficitMsg': '{n} equipment item(s) below {redundancy} capacity requirement'
  };

  const target = (typeof window !== 'undefined' ? window.I18N : (typeof global !== 'undefined' ? global.I18N : null));
  if (target) {
    target.dict = target.dict || {};
    target.dict['en'] = Object.assign(target.dict['en'] || {}, dict);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = dict;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
