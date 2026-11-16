// Story Director's `director.cast` answer cleaned to a list of people, plus the two list readers.

import { CAST_KEY, CAST_MAX, KEY_MAX, NAME_MAX } from './limits-cast.js';
import { ALIASES_MAX, DATE_MAX } from './limits-text.js';
import { normalizeEntry } from './entry-normalize.js';
import { clip, isObject } from './shared-text.js';

const dateOf = (value, dateText) => {
    if (Number.isSafeInteger(value)) {
        let text = '';
        try { text = typeof dateText === 'function' ? clip(dateText(value), DATE_MAX) : ''; } catch { text = ''; }
        return text;
    }
    return typeof value === 'string' ? clip(value, DATE_MAX) : '';
};


// ---- Story Director's answer, cleaned ----

function normalizeLastHeard(raw, dateText) {
    if (typeof raw === 'string') {
        const text = clip(raw, 300);
        return text ? { text, on: '' } : null;
    }
    if (!isObject(raw)) return null;
    const text = clip(raw.text ?? raw.doing ?? raw.line, 300);
    return text ? { text, on: dateOf(raw.on ?? raw.date, dateText) } : null;
}

/**
 * Story Director's answer as a clean list: [{ key, pack, id, name, aliases, met: { on, where } | null, where, doing,
 * lastHeard: { text, on } | null, alive, entry: <normalizeEntry> | null }], at most 200 people, one per key. The entry is kept only
 * for a met person. Anything that is not an array gives [] (the adapter tells "no answer" apart: null).
 */
export function normalizeCast(answer, dateText = null) {
    if (!Array.isArray(answer)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of answer.slice(0, CAST_MAX)) {
        if (!isObject(raw)) continue;
        const pack = clip(raw.pack, 80);
        const id = clip(raw.id, 80);
        const key = clip(raw.key || (pack && id ? `${pack}:${id}` : ''), KEY_MAX);
        const name = clip(raw.name, NAME_MAX);
        if (!CAST_KEY.test(key) || !name || seen.has(key)) continue;
        seen.add(key);
        const met = isObject(raw.met) ? { on: dateOf(raw.met.on, dateText), where: clip(raw.met.where, 200), at: Number.isSafeInteger(raw.met.on) ? raw.met.on : null } : null;
        const entry = met && isObject(raw.entry) ? normalizeEntry({ ...raw.entry, packVersion: raw.entry.packVersion ?? raw.packVersion }) : null;
        out.push(Object.freeze({
            key, pack, id, name,
            aliases: (Array.isArray(raw.aliases) ? raw.aliases : []).map(alias => clip(alias, NAME_MAX)).filter(Boolean).slice(0, ALIASES_MAX),
            met,
            where: clip(raw.where, 200),
            doing: clip(raw.doing, 300),
            lastHeard: met ? normalizeLastHeard(raw.lastHeard, dateText) : null,
            alive: raw.alive !== false,
            entry,
        }));
    }
    return out;
}

/** The met people whose entry came with the answer (the only ones a dossier can be made from). */
export const metWithEntry = list => (Array.isArray(list) ? list : []).filter(person => person?.met && person.entry);

/** The person of `list` with this cast key, or null. */
export const findCastPerson = (list, key) => (Array.isArray(list) ? list : []).find(person => person?.key === key) ?? null;
