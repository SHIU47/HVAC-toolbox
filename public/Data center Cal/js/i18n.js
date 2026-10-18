'use strict';

/**
 * i18n.js - Lightweight Internationalization Engine
 */
(function(root) {
  const I18N = {
    lang: 'zh-TW',
    dict: { 'zh-TW': {}, en: {} },
    _listeners: [],
    _warnedKeys: {},

    init() {
      let saved = null;
      try {
        if (typeof localStorage !== 'undefined') {
          saved = localStorage.getItem('pue_lang');
        }
      } catch (_) {}

      if (saved === 'en' || saved === 'zh-TW') {
        this.lang = saved;
      } else if (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('en')) {
        this.lang = 'en';
      } else {
        this.lang = 'zh-TW';
      }

      this._syncHtmlLang();
    },

    _syncHtmlLang() {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = (this.lang === 'zh-TW') ? 'zh-Hant' : 'en';
      }
    },

    t(key, params) {
      if (!key) return '';
      const currentDict = this.dict[this.lang];
      let val = currentDict ? currentDict[key] : undefined;

      // Fallback to zh-TW if missing in current language
      if (val === undefined && this.lang !== 'zh-TW' && this.dict['zh-TW']) {
        val = this.dict['zh-TW'][key];
      }

      if (val === undefined) {
        if (!this._warnedKeys[key]) {
          this._warnedKeys[key] = true;
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[I18N] Missing key:', key);
          }
        }
        val = key;
      }

      if (params && typeof params === 'object') {
        val = String(val).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
          return params[k] !== undefined ? params[k] : m;
        });
      }

      return val;
    },

    setLang(lang) {
      const target = (lang === 'en') ? 'en' : 'zh-TW';
      if (this.lang === target) return;
      this.lang = target;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('pue_lang', target);
        }
      } catch (_) {}

      this._syncHtmlLang();
      this.applyStatic();

      for (let i = 0; i < this._listeners.length; i++) {
        try {
          this._listeners[i](target);
        } catch (e) {
          if (typeof console !== 'undefined' && console.error) console.error(e);
        }
      }
    },

    applyStatic(targetRoot) {
      const doc = targetRoot || (typeof document !== 'undefined' ? document : null);
      if (!doc || typeof doc.querySelectorAll !== 'function') return;

      const i18nEls = doc.querySelectorAll('[data-i18n]');
      for (let i = 0; i < i18nEls.length; i++) {
        const el = i18nEls[i];
        const k = el.getAttribute('data-i18n');
        if (k) el.textContent = this.t(k);
      }

      const titleEls = doc.querySelectorAll('[data-i18n-title]');
      for (let i = 0; i < titleEls.length; i++) {
        const el = titleEls[i];
        const k = el.getAttribute('data-i18n-title');
        if (k) el.title = this.t(k);
      }

      const phEls = doc.querySelectorAll('[data-i18n-placeholder]');
      for (let i = 0; i < phEls.length; i++) {
        const el = phEls[i];
        const k = el.getAttribute('data-i18n-placeholder');
        if (k) el.placeholder = this.t(k);
      }
    },

    onChange(fn) {
      if (typeof fn === 'function') {
        this._listeners.push(fn);
      }
      return () => {
        const idx = this._listeners.indexOf(fn);
        if (idx >= 0) this._listeners.splice(idx, 1);
      };
    }
  };

  I18N.init();

  if (typeof window !== 'undefined') {
    window.I18N = I18N;
  }
  if (typeof global !== 'undefined') {
    global.I18N = I18N;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18N;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
