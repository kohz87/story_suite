// Features: what a preset sets, which preset the switches match, and picking a preset through the store.

import { isObject } from './shared-object.js';
import { PRESET_NAMES } from './shape.js';
import { inPresets, presetValue } from './presets-read.js';

// The features a preset speaks for: in presets and available. An unavailable feature (a module it needs is missing, or its
// module is held back) cannot be switched, so a preset neither sets nor compares it.
const members = list => (Array.isArray(list) ? list : []).filter(feature => isObject(feature) && inPresets(feature) && feature.available !== false);

/** What preset `name` sets: a Map of feature id → true | false for every feature it speaks for. */
export function presetSwitches(list, name) {
    return new Map(members(list).map(feature => [feature.id, presetValue(feature, name)]));
}

/**
 * The preset the switches match now: 'lean', 'standard' or 'full' when every feature a preset speaks for is in the state it
 * says (Standard first when more than one matches), else null (Custom). Derived on every read; nothing is stored. `list`: the
 * feature store's `list()`.
 */
export function selectedPreset(list) {
    const own = members(list);
    if (!own.length) return null;
    return PRESET_NAMES.find(name => own.every(feature => (feature.on === true) === presetValue(feature, name))) ?? null;
}

/**
 * Picks preset `name`: every feature it speaks for that is not in the state it says is set through `store.set` (the
 * ordinary setter: each change is told as any switch is, and stored choices of other features are left alone). A feature
 * already in the state it says is not written. → { name, changed: [id], prompt: boolean } (`prompt`: some changed feature
 * changes the fixed prompt, so the reader is told once about the one slower reply), or null for a name that is not a preset.
 */
export function applyPreset(store, name) {
    if (!PRESET_NAMES.includes(name) || typeof store?.list !== 'function' || typeof store?.set !== 'function') return null;
    const changed = [];
    let prompt = false;
    for (const feature of members(store.list())) {
        const want = presetValue(feature, name);
        if ((feature.on === true) === want) continue;
        if (store.set(feature.id, want) === undefined) continue;
        changed.push(feature.id);
        if (feature.prompt === true) prompt = true;
    }
    return { name, changed, prompt };
}
