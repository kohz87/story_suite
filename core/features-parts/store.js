// Features: the reader's feature choices store and the Settings window's view of it with some features hidden.

import { isObject } from './shared-object.js';
import { CORE_LEGACY } from './names.js';
import { applyPreset } from './presets-apply.js';

/**
 * The reader's feature choices under `root().storySuite.features` (`root`: () => extension_settings).
 * `registry` (createRegistry) knows the declared features; `legacy` ({ [id]: storySuite → bool |
 * undefined }) reads an older switch for a feature with no choice yet; `onChange({ id, on, prompt })`
 * runs after each change; `save` is saveSettingsDebounced.
 * → { stored(id) → bool | undefined, on(id), set(id, on) → bool | undefined, list() }.
 * A choice stored for an id no module declares (a module not installed now) is kept as it is.
 */
export function createFeatureStore({ root, registry, save = () => {}, legacy = CORE_LEGACY, onChange = null }) {
    const suite = () => {
        const es = root?.();
        if (!isObject(es)) return null;
        if (!isObject(es.storySuite)) es.storySuite = {};
        return es.storySuite;
    };
    const choices = () => {
        const all = suite();
        if (!all) return {};
        if (!isObject(all.features)) all.features = {};
        return all.features;
    };
    function stored(id) {
        const value = choices()[id];
        if (typeof value === 'boolean') return value;
        const old = typeof legacy?.[id] === 'function' ? legacy[id](suite()) : undefined;
        return typeof old === 'boolean' ? old : undefined;
    }
    function tell(id) {
        const on = registry.featureOn(id);
        try { onChange?.({ id, on, prompt: registry.feature(id)?.prompt === true }); } catch (error) { console.warn('[Story Suite] a feature listener failed', error); }
        return on;
    }
    const api = {
        stored,
        on: id => registry.featureOn(id),
        /**
         * Stores the reader's choice; undefined (nothing stored) for an id no module declares. A choice that is the feature's own
         * default is not kept (the stored choice is cleared), so a later change of the default still reaches the reader; the exception
         * is a feature an older setting still speaks for (`legacy`), which keeps the explicit value.
         */
        set(id, on) {
            const decl = registry.feature(id);
            if (!decl) return undefined;
            const before = registry.featureOn(id);
            const old = typeof legacy?.[id] === 'function' ? legacy[id](suite()) : undefined;
            if (Boolean(on) === (decl.default !== false) && typeof old !== 'boolean') delete choices()[id];
            else choices()[id] = Boolean(on);
            save();
            // Told only when it is on or off now as it was not before: a feature of a module held back stays off.
            if (before !== Boolean(on) && before !== registry.featureOn(id)) tell(id);
            return Boolean(on);
        },
        /** Picks a preset ("How much to track"): see applyPreset. */
        applyPreset: name => applyPreset(api, name),
        /** Every declared feature with its state: [{ id, moduleId, moduleName, label, describe, default, prompt, presets, needs, available, why, on }]. */
        list: () => registry.features().map(feature => ({ ...feature, on: registry.featureOn(feature.id) })),
    };
    return api;
}

/**
 * The feature store as the Settings window sees it: `list()` leaves out the features `hidden(feature)` says to hide. Nothing is
 * changed: a hidden feature keeps its stored choice and its effect, and `on`, `set` and `stored` are the store's own.
 */
export function withHiddenFeatures(store, hidden) {
    if (!store || typeof store.list !== 'function' || typeof hidden !== 'function') return store ?? null;
    return Object.freeze({
        ...store,
        list: () => store.list().filter(feature => { try { return !hidden(feature); } catch { return false; } }),
    });
}
