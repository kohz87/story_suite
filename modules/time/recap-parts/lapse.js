// What the settle receipt tells about the threads time closed.

import { noteParts } from '../../../note.js';

// One item per key, in order.
function unique(entries) {
    const seen = new Set();
    return entries.filter(entry => (seen.has(entry.key) ? false : (seen.add(entry.key), true)));
}

// v1's "mention it only where it fits" for quests whose deadline passed.
function failedLine(failed, calendar, now) {
    const items = unique(failed).map(entry => {
        const due = calendar && entry.due ? calendar.withClock?.(entry.due, { reference: now }) ?? entry.due : entry.due;
        return `${entry.key}${due ? ` (by ${due})` : ''}`;
    });
    if (!items.length) return '';
    const one = items.length === 1;
    return `Failed: ${items.join(', ')} — the deadline passed and the time ran out on ${one ? 'it' : 'them'}; mention ${one ? 'it' : 'them'} only where ${one ? 'it fits' : 'they fit'}.`;
}

/**
 * What the settle receipt tells the next reply about the threads time closed: v1's Slipped
 * and Lapsed lines, and one for failed quests ('' when nothing closed). `closed` holds
 * `{ key, kind, reason, on, giver, due }` in tracker order; `reasons` names which is which.
 */
export function lapseSummary(closed, { calendar, now = null, reasons }) {
    const slipped = closed.filter(entry => entry.reason === reasons.slipped).map(entry => ({ key: entry.key, on: entry.on, giver: '' }));
    const lapsed = closed.filter(entry => entry.reason === reasons.lapsed).map(entry => ({ key: entry.key, on: '', giver: entry.giver }));
    const failed = closed.filter(entry => entry.reason === reasons.failed);
    const told = slipped.length || lapsed.length
        ? noteParts({ now: null, due: [], arriving: [], relevant: [], secrets: [] }, { calendar, instruction: '', slipped, lapsed })
            .filter(entry => entry.label === 'Slipped' || entry.label === 'Lapsed')
            .map(entry => entry.text)
        : [];
    return [...told, failedLine(failed, calendar, now)].filter(Boolean).join(' ');
}
