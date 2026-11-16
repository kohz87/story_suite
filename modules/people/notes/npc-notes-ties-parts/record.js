// The stored ties record: reading a JSON text into a valid ties object and writing it back as canonical text.
import { npcKey } from '../npc-meters-config.js';
import { TIE_TAGS, TIES_MAX_PEOPLE, ordered, isPlainObject } from './shared-tags.js';

export const TIES_TEXT_MAX = 1600;

function validTags(value) {
    return Array.isArray(value) && value.length > 0 && value.length <= TIE_TAGS.length
        && new Set(value).size === value.length && value.every(tag => TIE_TAGS.includes(tag))
        && ordered(value).join() === value.join();
}

/** The parsed ties of stored text, or null when the text is absent, too long, or not valid in every part. `{}` is a valid empty record. */
export function readTies(stored) {
    if (typeof stored !== 'string' || !stored || stored.length > TIES_TEXT_MAX) return null;
    let value;
    try { value = JSON.parse(stored); } catch { return null; }
    if (!isPlainObject(value)) return null;
    const keys = Object.keys(value);
    if (keys.length > TIES_MAX_PEOPLE) return null;
    if (!keys.every(key => npcKey(key) === key && validTags(value[key]))) return null;
    return value;
}

/** The canonical stored text of a ties object (keys sorted, tags in TIE_TAGS order), or null when no one is tied (the host drops the leaf). */
export function tiesText(ties) {
    const keys = Object.keys(ties ?? {}).filter(key => Array.isArray(ties[key]) && ties[key].length).sort();
    if (!keys.length) return null;
    const out = {};
    for (const key of keys) out[key] = ordered(ties[key]);
    return JSON.stringify(out);
}
