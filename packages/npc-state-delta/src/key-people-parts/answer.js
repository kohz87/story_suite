// Story Director's `director.keyPeople` answer cleaned to a list of key people with their absences.

import { clip, isObject, labelKey } from './shared-text.js';

const NAME_MAX = 80;
const ALIASES_MAX = 8;
const PEOPLE_MAX = 50;
const STEPS_MAX = 12;
const TEXT_MAX = 200;
const DATE_MAX = 40;

// A date as text: Story Director sends story minutes (null when not known), which `dateText` writes on the chat's
// calendar ('' without one); a date already given as words is kept.
const dateOf = (value, dateText) => {
    if (Number.isSafeInteger(value)) {
        let text = '';
        try { text = typeof dateText === 'function' ? clip(dateText(value), DATE_MAX) : ''; } catch { text = ''; }
        return text;
    }
    return typeof value === 'string' ? clip(value, DATE_MAX) : '';
};

function normalizeAway(raw, dateText) {
    if (!isObject(raw)) return null;
    const steps = (Array.isArray(raw.steps) ? raw.steps : [])
        .filter(isObject)
        .map(step => ({ date: dateOf(step.date, dateText), text: clip(step.text, TEXT_MAX) }))
        .filter(step => step.text)
        .slice(-STEPS_MAX);
    return { doing: clip(raw.doing, TEXT_MAX), since: dateOf(raw.since, dateText), back: dateOf(raw.back, dateText), steps };
}

/**
 * Story Director's answer as a clean list: [{ name, aliases, here, away: { doing, since, back, steps } | null,
 * removed: { reason, on } | null }], texts cut and cleaned, at most 50 people. Its dates are story minutes: `dateText`
 * (minutes → "Goldwane 18") writes them; without it a minute has no text. A removed person never has an away record
 * here. Anything that is not an array gives [] (the adapter tells "no answer" apart: null).
 */
export function normalizeKeyPeople(answer, dateText = null) {
    if (!Array.isArray(answer)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of answer.slice(0, PEOPLE_MAX)) {
        if (!isObject(raw)) continue;
        const name = clip(raw.name, NAME_MAX);
        const key = labelKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const removed = isObject(raw.removed) ? { reason: clip(raw.removed.reason, NAME_MAX), on: dateOf(raw.removed.on, dateText) } : null;
        out.push(Object.freeze({
            name,
            aliases: (Array.isArray(raw.aliases) ? raw.aliases : []).map(alias => clip(alias, NAME_MAX)).filter(Boolean).slice(0, ALIASES_MAX),
            here: raw.here === true,
            away: removed ? null : normalizeAway(raw.away, dateText),
            removed,
        }));
    }
    return out;
}
