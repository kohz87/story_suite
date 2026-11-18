// NPC State's reading of Story Director's `director.away` (read only): the answer cleaned to a list, which entry names a dossier, who is away.

import { labelKey } from '../dossier/cast-dossier-parts/shared-text.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clip = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();

// A date as text: the answer's story minutes, written by `dateText` ('' without one); a date given as words is kept.
const dateOf = (value, dateText) => {
    if (Number.isSafeInteger(value)) {
        try { return typeof dateText === 'function' ? clip(dateText(value), 40) : ''; } catch { return ''; }
    }
    return typeof value === 'string' ? clip(value, 40) : '';
};

function absenceOf(raw, dateText) {
    if (!isObject(raw)) return null;
    const steps = (Array.isArray(raw.steps) ? raw.steps : []).filter(isObject).map(step => ({ date: dateOf(step.date, dateText), text: clip(step.text, 200) })).filter(step => step.text).slice(-12);
    return { doing: clip(raw.doing, 200), since: dateOf(raw.since, dateText), back: dateOf(raw.back, dateText), steps };
}

/**
 * The answer as a clean list: [{ name, aliases, here, followed, away: { doing, since, back, steps } | null, removed: { reason } | null }], at most 50.
 * Its dates are story minutes: `dateText` (minutes → "Goldwane 18") writes them. Anything that is not an array gives [].
 */
export function normalizeAwayAnswer(answer, dateText = null) {
    if (!Array.isArray(answer)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of answer.slice(0, 50)) {
        if (!isObject(raw)) continue;
        const name = clip(raw.name, 80);
        const key = labelKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const removed = isObject(raw.removed) ? { reason: clip(raw.removed.reason, 80) } : null;
        out.push(Object.freeze({
            name, aliases: (Array.isArray(raw.aliases) ? raw.aliases : []).map(alias => clip(alias, 80)).filter(Boolean).slice(0, 8),
            here: raw.here === true, followed: raw.followed === true, away: removed ? null : absenceOf(raw.away, dateText), removed,
        }));
    }
    return out;
}

/** The comparison keys of an entry's name and aliases. */
export const entryLabels = entry => [entry?.name, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])].map(labelKey).filter(Boolean);

/** The entry of `list` that names the dossier (by its name or an alias, either side), or null. */
export function findAwayEntry(list, npc) {
    if (!Array.isArray(list) || !list.length || !npc) return null;
    const mine = [npc.name, ...(Array.isArray(npc.aliases) ? npc.aliases : [])].map(labelKey).filter(Boolean);
    return mine.length ? list.find(entry => entryLabels(entry).some(label => mine.includes(label))) ?? null : null;
}

/** Whether the entry is someone away now (not dead). */
export const isAwayEntry = entry => Boolean(entry) && !entry.removed && Boolean(entry.away);
