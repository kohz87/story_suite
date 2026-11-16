// The presets the reader may use (built-in then packs) and the preset ids a settings value names.
import { clean, isObject } from './shared-text.js';
import { ID_MAX, MAX_PRESETS } from './shared-limits.js';
import { BUILT_IN_PRESETS } from './built-in.js';
import { normalizePreset } from './normalize.js';

/**
 * Every preset the reader may use: the built-in ones, then the packs' `meterPresets` records (as
 * `packs.content` gives them), at most twelve, one per id (the first one wins).
 */
export function presetCatalog(packRecords = []) {
    const out = [];
    const seen = new Set();
    const add = preset => {
        if (!preset || seen.has(preset.id) || out.length >= MAX_PRESETS) return;
        seen.add(preset.id);
        out.push(preset);
    };
    for (const preset of BUILT_IN_PRESETS) add(normalizePreset(preset, { builtIn: true }));
    for (const record of Array.isArray(packRecords) ? packRecords : []) add(normalizePreset(record));
    return out;
}

/** The preset ids a settings value names (`presets`: ids or { id } rows), cleaned, at most twelve. */
export function presetIds(value) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
        const id = clean(isObject(item) ? item.id ?? item.preset : item, ID_MAX);
        if (id && !out.includes(id) && out.length < MAX_PRESETS) out.push(id);
    }
    return out;
}
