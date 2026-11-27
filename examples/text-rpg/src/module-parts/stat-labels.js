// The stat names a reader sees on gear while Text RPG is on: the "Stat names, in order" setting, by position (the gear's sixth stat, LUK, is Text RPG's wis).
import { STAT_KEYS } from '../words/stats.js';
import { ownSettings } from './settings.js';

/** Seven labels in the gear's order from the setting `source` holds; a missing or blank name falls back to the stat's own key, uppercased. */
export function statLabelsOf(source) {
    const given = String(ownSettings(source).statNames ?? '').split(',').map(name => name.trim());
    return STAT_KEYS.map((key, at) => given[at] || key.toUpperCase());
}
