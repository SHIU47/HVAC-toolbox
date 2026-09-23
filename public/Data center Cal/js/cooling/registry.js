'use strict';
/**
 * registry.js - Cooling Architecture and Stage Registry
 * Core registry for modular cooling stages (economizers, mechanical chillers, heat rejection)
 * and architecture descriptors.
 */
(function (root) {
    const _stages = new Map();
    const _archs = new Map();
    const _aliases = new Map();

    const CoolingStages = {
        register(id, stageDef) {
            if (!id || typeof id !== 'string') {
                throw new Error('CoolingStages.register: stage id must be a non-empty string');
            }
            if (!stageDef || typeof stageDef.simulate !== 'function') {
                throw new Error(`CoolingStages.register[${id}]: stageDef must implement simulate(ctx)`);
            }
            _stages.set(id, { id, ...stageDef });
            return this;
        },

        get(id) {
            const stage = _stages.get(id);
            if (!stage) {
                throw new Error(`CoolingStages: unknown cooling stage "${id}"`);
            }
            return stage;
        },

        has(id) {
            return _stages.has(id);
        },

        list() {
            return Array.from(_stages.values());
        }
    };

    const CoolingArchRegistry = {
        register(archDef) {
            if (!archDef || !archDef.id) {
                throw new Error('CoolingArchRegistry.register: arch definition must have an id');
            }
            _archs.set(archDef.id, archDef);
            if (Array.isArray(archDef.aliases)) {
                archDef.aliases.forEach(alias => {
                    _aliases.set(alias, archDef.id);
                });
            }
            return this;
        },

        get(id) {
            if (!id) return null;
            const canonicalId = _aliases.get(id) || id;
            return _archs.get(canonicalId) || null;
        },

        has(id) {
            if (!id) return false;
            const canonicalId = _aliases.get(id) || id;
            return _archs.has(canonicalId);
        },

        resolveAlias(id) {
            if (!id) return id;
            return _aliases.get(id) || id;
        },

        list(loop) {
            const all = Array.from(_archs.values());
            if (!loop) return all;
            return all.filter(a => a.loop === loop);
        }
    };

    root.CoolingStages = CoolingStages;
    root.CoolingArchRegistry = CoolingArchRegistry;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
