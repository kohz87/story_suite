// What the narrator is told about the holding in the prompt's tail: its one state line, and the reminder when a new story month begins.
import { PRESETS, makeCalendar } from '../../time/calendar.js';
import { oneLine } from '../../../core/text.js';
import { holdingOf } from './read.js';
import { postsPart } from './post-tail.js';

export const MONTH_CUE = "A new month: write the holding's upkeep line (! dm holding | kind: month), its income and anything that changed.";
/** Tail room the reminder takes, in tokens. */
export const MONTH_CUE_TOKENS = 40;

/** The holding's tail line; a field the definition lacks is left out. */
export function holdingLine(definition, fields) {
    if (fields.founded !== true) return `${definition.name} — not founded yet.`;
    const has = key => fields[key] !== undefined;
    const seat = fields.seat ? `seat ${oneLine(fields.seat)}${fields.region ? ` (${oneLine(fields.region)})` : ''}` : 'no seat yet';
    const parts = [
        [oneLine(fields.name), fields.type, has('rank') ? `${fields.rank} (tier ${fields.tier})` : ''].filter(Boolean).join(', '),
        seat,
        ...['retainers', 'treasury', 'renown', 'loyalty'].filter(has).map(key => `${key} ${fields[key]}${key === 'treasury' ? ' gold' : ''}${key === 'retainers' && has('cap') ? ` of ${fields.cap}` : ''}`),
        has('upkeep') ? `upkeep ${fields.upkeep} gold a month` : '',
        has('need-retainers') && fields.tier < 5 ? `next tier needs retainers ${fields['need-retainers']}, treasury ${fields['need-treasury']}, renown ${fields['need-renown']}` : '',
        postsPart(fields),
    ];
    return `${definition.name} — ${parts.filter(Boolean).join('; ')}.`;
}

const minutesOf = state => {
    const minutes = state?.domains?.director?.time?.minutes;
    return Number.isSafeInteger(minutes) ? minutes : null;
};

/**
 * The reminder, or null: the latest reply moved the clock into a later calendar month and the holding stood before it (`view.beforeLatestReply()`,
 * read from what is stored, so a swipe, a Re-read and a reload read the same). None without a clock on either side, when the clock went back, or when that reply paid a month.
 */
export function monthCue(view) {
    const holding = holdingOf(view?.state);
    if (!holding) return null;
    const before = view.beforeLatestReply?.();
    const now = minutesOf(view.state), then = minutesOf(before), stood = holdingOf(before);
    // (a latest reply that wrote the month's line itself is not asked again: the upkeep would be paid twice)
    if (now === null || then === null || now <= then || !stood || stood.months !== holding.months) return null;
    let calendar;
    try { calendar = makeCalendar(view.query?.('director.calendar', {}) || PRESETS.gregorian); } catch { calendar = makeCalendar(PRESETS.gregorian); }
    const monthOf = minutes => { const at = calendar.fromAbs(minutes); return `${at.year}/${at.month}`; };
    return monthOf(now) !== monthOf(then) ? MONTH_CUE : null;
}
