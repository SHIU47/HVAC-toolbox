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
    'app.importSuccess': '✅ Project file loaded successfully!',
    'app.importError': '❌ Invalid project file format, failed to load.',
    'app.resetConfirm': 'Are you sure you want to clear all configurations and reset to the default sample project?',
    'app.step5Blocked': '⚠️ Some cooling equipment capacities do not meet N+1 requirements. Please resolve before viewing Dashboard!',
    'app.viewLoadError': '⚠️ View module (Step {step}) failed to load. Please check if related JS files are correctly loaded.',

    // Sticky KPI Bar
    'kpi.designPue': 'Design PUE',
    'kpi.waterWue': 'Water WUE',
    'kpi.itCapacity': 'IT Capacity',
    'kpi.freeCooling': 'Free Cooling FC',
    'kpi.freeCoolingTitle': 'CDU Liquid Cooling Free Cooling Hours Ratio',

    // Steps Navigation
    'nav.step1': 'Site 8760h Weather',
    'nav.step2': 'Hall → DU → SU Modules',
    'nav.step3': 'Core POD Data Center',
    'nav.step4': 'Per-DU Dual Cooling Systems',
    'nav.step5': '8,760h Results Dashboard',

    // Footer
    'footer.desc': 'PUE Calculation System · Professional AI Data Center Lifecycle Energy & Water Dynamics Tool',

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
