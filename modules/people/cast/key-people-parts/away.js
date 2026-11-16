// Who is away now and the words about an absence: the away dossier ids, the date range and the return note.

import { RETURN_NOTE_CHARS } from './constants.js';
import { findKeyEntry, isAway } from './entries.js';

/** The ids of the dossiers that are key people away now. */
export function awayNpcIds(list, npcs) {
    const ids = new Set();
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        if (npc?.id && isAway(findKeyEntry(list, npc))) ids.add(String(npc.id));
    }
    return ids;
}

// ---- the dates and the words ----

/** "Gw 12 – Gw 18" for an absence ('' when neither date is known). */
export function awayRange(away) {
    if (!away) return '';
    if (away.since && away.back) return `${away.since} – ${away.back}`;
    if (away.since) return `since ${away.since}`;
    if (away.back) return `until ${away.back}`;
    return '';
}

/**
 * What the narrator is told once, with the returned person's dossier: where they went, the steps, and the
 * dates, in one short line (at most `max` characters, cut at a step, never mid-word).
 */
export function returnNote(away, max = RETURN_NOTE_CHARS) {
    if (!away) return '';
    const range = awayRange(away);
    const head = `WHILE AWAY, NOW BACK${range ? ` (${range})` : ''}: ${away.doing || 'away'}`;
    const steps = (away.steps ?? []).map(step => (step.date ? `${step.date}: ${step.text}` : step.text));
    let text = head;
    // The newest steps matter most; keep as many as fit, oldest dropped first.
    for (let from = Math.max(0, steps.length - 4); from < steps.length; from += 1) {
        const tail = steps.slice(from).join('; ');
        const candidate = `${head}; ${tail}`;
        if (candidate.length <= max) { text = candidate; break; }
    }
    if (text.length > max) text = `${text.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '').trimEnd()}…`;
    return text;
}
