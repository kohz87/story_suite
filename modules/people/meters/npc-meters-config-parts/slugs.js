// Turning a name into its slug, npc key or word key.
import { METER_ID_MAX, KEY_MAX } from './key-limits.js';
import { FORBIDDEN_KEYS } from './record-words.js';

/** Lowercase words joined by "-": `Jean-Luc Picard` → `jean-luc-picard`. '' when nothing is left. */
export function slug(value, max = METER_ID_MAX) {
    return String(value ?? '').normalize('NFKC').toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

/** The slice key for an NPC's name, or null. Keys that name JavaScript internals get "-npc". */
export function npcKey(name) {
    const key = slug(name, KEY_MAX);
    if (!key) return null;
    return FORBIDDEN_KEYS.has(key) ? `${key}-npc` : key;
}

/** The key of a milestone or a rung: its words, lowercase, joined by "-" ('' when none). */
export function wordKey(value) {
    const key = slug(value, METER_ID_MAX);
    return FORBIDDEN_KEYS.has(key) ? `${key}-key` : key;
}
