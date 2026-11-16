// Features: a feature's presets as kept, and what a preset says for one feature.

import { isObject } from './shared-object.js';
import { PRESET_KEYS } from './shape.js';

/**
 * A feature's `presets` as the registry keeps it: false (outside presets) or { lean?, full? } with only the booleans.
 * Anything else (a newer module's shape) is read as no keys: the feature follows its default.
 */
export function presetsOf(feature) {
    if (feature?.presets === false) return false;
    const given = isObject(feature?.presets) ? feature.presets : {};
    return Object.freeze(Object.fromEntries(PRESET_KEYS.filter(key => typeof given[key] === 'boolean').map(key => [key, given[key]])));
}

// ---- "How much to track": the presets, derived from the switches, never stored -------------------------

/** Is this feature (a `list()` row or a declaration) part of the presets? Only `presets: false` leaves it out. */
export const inPresets = feature => feature?.presets !== false;

/**
 * What preset `name` says for a feature: true or false, or null for a feature outside presets. Standard is the feature's
 * `default`; lean and full are the feature's own key, else its `default`.
 */
export function presetValue(feature, name) {
    if (!inPresets(feature)) return null;
    const fallback = feature?.default !== false;
    if (name === 'standard') return fallback;
    const own = isObject(feature?.presets) ? feature.presets[name] : undefined;
    return typeof own === 'boolean' ? own : fallback;
}
