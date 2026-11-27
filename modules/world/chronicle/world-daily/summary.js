// World events, the daily step on the host: the one line its changes card shows (reader-facing, not sent to the narrator).
// What happened (fired, ended, lapsed, replaced, minor happenings, people moved or lost, conditions that faded), the long-skip note,
// then the warnings. Pure.

import { refLabel } from '../../daily/region-label.js';

const MAX_ITEMS = 8;
const MAX_CHARS = 1200;
const bare = text => text.replace(/[.!?…]+$/, '');

// A line's words for comparing two tellings of one thing: no case, punctuation or word order, and no tense or plural endings ("stopped" = "stops").
const IRREGULAR = { goes: 'go', going: 'go', went: 'go', gone: 'go', fell: 'fall', fallen: 'fall' };
const stem = word => (IRREGULAR[word] ?? word).replace(/(?<=.{3})(ing|ed|es|s)$/, '').replace(/(?<=.{3})e$/, '').replace(/(?<=.{2})(.)\1$/, '$1');
const words = text => String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const SMALL = new Set(['a', 'an', 'the', 'and', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'that', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const NEGATIONS = ['not', 'never', 'no', 'nor', 'without'];
/** Whether `line` already says `fact`: it has every content word of the fact (it may well say more), and every "not" of it. */
function says(line, fact) {
    const [said, asked] = [words(line), words(fact)];
    const has = new Set(said.map(stem));
    const content = asked.filter(word => !SMALL.has(word) && !NEGATIONS.includes(word));
    return content.length > 0 && content.every(word => has.has(stem(word))) && NEGATIONS.every(word => !asked.includes(word) || said.includes(word));
}

/** `faded(name, ref, geo)` → a condition that ended, in words ("tolls raised on The March"); `geo` names the ref as the Conditions card does. */
export const fadedWords = (name, ref, geo = null) => `${String(name).replace(/[-_]+/g, ' ')} on ${geo ? refLabel(geo, ref) : ref}`;

/** `dailySummary(report, geo?)` → '' when nothing happened, else "World: …". */
export function dailySummary(report, geo = null) {
    const shownToday = report.journal.filter(entry => !entry.rumour && entry.text);
    // An event that fired and ended on one day is said once: its end line, when it only repeats the fired line, is left off.
    const repeats = end => end.ended && shownToday.some(entry => entry.fired && entry.by === end.by && entry.day === end.day && entry.text.startsWith(end.text.replace(/^Ended: /, '')));
    // A fact the happening set, in words that only repeat its fired line of that day, is left off too.
    const retold = fact => !fact.fired && !fact.ended && shownToday.some(entry => entry.fired && entry.by === fact.by && entry.day === fact.day && says(entry.text, fact.text));
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
