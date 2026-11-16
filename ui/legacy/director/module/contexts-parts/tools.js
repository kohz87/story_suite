// Story Director v2: the tools handed to a part's query, and the setting-filled query args.

import { settingsFor } from '../settings.js';
import { isObject } from '../shared.js';

// The tools a part's query sees: the host's (`query`, `receipts`, …) plus settings(), substitute() and feature(id).
export function partTools(ns, tools, shared, host) {
    const base = typeof tools === 'function' ? { query: tools } : isObject(tools) ? tools : {};
    const settings = typeof base.settings === 'function' ? id => base.settings(id) : id => host.settings(id);
    const substitute = typeof base.substitute === 'function' ? base.substitute : host.substitute;
    const feature = typeof base.feature === 'function' ? base.feature : host.feature;
    return Object.freeze({
        ...base,
        ...(typeof feature === 'function' ? { feature: id => feature(id) } : {}),
        settings: settingsFor(ns, settings, { ...shared(ns), query: base.query ?? null }),
        substitute: text => {
            let out;
            try { out = substitute?.(text); } catch { out = undefined; }
            return typeof out === 'string' ? out : String(text ?? '');
        },
    });
}

// Queries whose args take a part setting when the caller leaves it out: { query: { arg: setting } }.
const SETTING_ARGS = {
    'atlas.routes': { map: 'map' },
    'atlas.travel': { map: 'map' },
};

export function withSettingArgs(name, args, tools) {
    const fill = SETTING_ARGS[name];
    if (!fill) return args;
    const out = isObject(args) ? { ...args } : {};
    let settings = null;
    for (const [arg, key] of Object.entries(fill)) {
        if (out[arg] !== undefined && out[arg] !== null) continue;
        settings ??= tools.settings();
        if (settings[key] !== undefined) out[arg] = settings[key];
    }
    return out;
}
