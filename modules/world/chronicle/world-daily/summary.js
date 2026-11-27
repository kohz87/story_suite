// World events, the daily step on the host: the one line its changes card shows (reader-facing, not sent to the narrator).
// What happened (fired, ended, lapsed, replaced, minor happenings, people moved or lost, conditions that faded), the long-skip note,
// then the warnings. Pure.

import { refLabel } from '../../daily/region-label.js';

const MAX_ITEMS = 8;
const MAX_CHARS = 1200;
const bare = text => text.replace(/[.!?…]+$/, '');

// A line's words for comparing two tellings of one thing: no case, punctuation or word order, and no tense or plural endings ("stopped" = "stops").
const wordSet = text => new Set((String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map(word => word.replace(/(?<=.{3})(ing|ed|es|s)$/, '').replace(/(?<=.{2})(.)\1$/, '$1')));
const SAME_WORDS = 0.8;
/** Whether two lines say the same: they share at least 80% of the longer one's words. */
function sameWords(a, b) {
    const [one, two] = [wordSet(a), wordSet(b)];
    return [...one].filter(word => two.has(word)).length >= SAME_WORDS * Math.max(one.size, two.size, 1);
}

/** `faded(name, ref, geo)` → a condition that ended, in words ("tolls raised on The March"); `geo` names the ref as the Conditions card does. */
export const fadedWords = (name, ref, geo = null) => `${String(name).replace(/[-_]+/g, ' ')} on ${geo ? refLabel(geo, ref) : ref}`;

/** `dailySummary(report, geo?)` → '' when nothing happened, else "World: …". */
export function dailySummary(report, geo = null) {
    const shownToday = report.journal.filter(entry => !entry.rumour && entry.text);
    // An event that fired and ended on one day is said once: its end line, when it only repeats the fired line, is left off.
    const repeats = end => end.ended && shownToday.some(entry => entry.fired && entry.by === end.by && entry.day === end.day && entry.text.startsWith(end.text.replace(/^Ended: /, '')));
    // A fact the happening set, in words that only repeat its fired line of that day, is left off too.
    const retold = fact => !fact.fired && !fact.ended && shownToday.some(entry => entry.fired && entry.by === fact.by && entry.day === fact.day && sameWords(entry.text, fact.text));
    const items = shownToday.filter(entry => !repeats(entry) && !retold(entry)).map(entry => entry.text);
    for (const entry of report.log) {
        // An event is named by its words, never its id: one with none is left out, and so is a lapse whose branch never opened.
        if (entry.kind === 'lapsed' && entry.text && !entry.unopened) items.push(`Lapsed: ${bare(entry.text)}.`);
        if (entry.kind === 'replaced' && entry.text) items.push(`Replaced: ${bare(entry.text)}.`);
        if (entry.kind === 'faded' || entry.kind === 'released') {
            const cut = entry.key.indexOf('@');
            items.push(`Faded: ${fadedWords(entry.key.slice(0, cut), entry.key.slice(cut + 1), geo)}.`);
        }
    }
    const shown = items.slice(0, MAX_ITEMS);
    if (items.length > MAX_ITEMS) shown.push(`and ${items.length - MAX_ITEMS} more.`);
    const parts = [];
    if (report.note) parts.push(`${report.note}.`);
    if (shown.length) parts.push(shown.join(' '));
    // `report.card`: what the card says for a warning instead of its Problems text; '' leaves it off.
    const said = report.warnings.map(warning => (Object.hasOwn(report.card ?? {}, warning) ? report.card[warning] : warning)).filter(Boolean);
    for (const warning of said.slice(0, 4)) parts.push(`Warning: ${warning}`);
    if (!parts.length) return '';
    const text = `World: ${parts.join(' ')}`;
    return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text;
}
