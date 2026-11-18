// The built-in story fields of a person record: Level, Abilities and Keepsakes (pack format 4). Level is a whole number from 1 to 99 or absent;
// Abilities and Keepsakes are lists of { name, description }. The limits are cut, never refused: a person write that was over a limit still stores.
// Empty means absent (the record carries no key), so a person without these fields is stored exactly as before.
// "Only goes up" is the writers' rule (the narrator's line, the RPG), not the normalizer's: a reader's edit may lower a Level.
import { cleanText } from '../core-text.js';

export const BUILT_IN_LIMITS = Object.freeze({ levelMax: 99, abilities: 16, keepsakes: 12, name: 60, description: 200 });

const DASH = /\s+[—–-]\s+/;

/** The Level as a whole number from 1 to 99, or null (a number or a text of digits only). */
export function normalizeLevel(value) {
    const text = typeof value === 'number' ? String(value) : (typeof value === 'string' ? value.trim() : '');
    if (!/^\d{1,3}$/.test(text)) return null;
    const level = Number(text);
    return level >= 1 && level <= BUILT_IN_LIMITS.levelMax ? level : null;
}

/** A list of { name, description }: names cut to 60 and descriptions to 200 characters, names unique without regard to case (the first wins), at most `max`. A text entry reads as "Name — description". */
export function normalizeStoryList(value, max) {
    const seen = new Set();
    const out = [];
    for (const entry of Array.isArray(value) ? value : []) {
        let name = '';
        let description = '';
        if (typeof entry === 'string') {
            const [head, ...rest] = entry.split(DASH);
            name = head;
            description = rest.join(' — ');
        } else if (entry && typeof entry === 'object') {
            name = entry.name;
            description = entry.description;
        }
        name = cleanText(name, BUILT_IN_LIMITS.name);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        out.push({ name, description: cleanText(description, BUILT_IN_LIMITS.description) });
        if (out.length >= max) break;
    }
    return out;
}

/** The editor's lines ("Name — description", one per line) as entries, cut by normalizeStoryList. */
export function parsePairLines(text, max) {
    return normalizeStoryList(String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean), max);
}
