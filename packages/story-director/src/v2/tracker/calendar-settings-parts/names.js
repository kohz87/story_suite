// Story Director v2, tracker part: the rule line and the check for real-world day and month names in a custom calendar's story.

// ---- The real world's names in a custom calendar's story (13 Nov: "the ditch boy from Tuesday", January..December) ----
//
// `calendarRule(calendar)`: one static line, only for a custom calendar without weekdays (a pack's): its months, in order, and
// that the real names are not used. Same text every reply of the story, so it stays cached; a Gregorian calendar, or a custom
// one with its own week, gets none. `foreignNames(text, calendar)`: the Monday-Sunday and January-December names the prose
// uses (the cheap, quiet check behind the `director.calendarNames` Problem).

/** Whether the calendar is a custom one with months and no weekdays (the pack's, or the reader's own with the week empty). */
export const hasNoWeek = calendar => calendar?.config?.preset === 'custom' && !(calendar.config.week ?? []).length && (calendar.config.months ?? []).length > 0;

export function calendarRule(calendar) {
    if (!hasNoWeek(calendar)) return '';
    const months = calendar.config.months;
    const example = `${months[0].name} ${Math.min(14, Number(months[0].days) || 1)}`;
    return `Dates use this world's calendar only: months ${months.map(month => month.name).join(', ')}; no weekdays. Never use Monday–Sunday or January–December, in narration or speech; say 'three days ago', 'yesterday' or the date (${example}).`;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PLAIN_MONTHS = ['January', 'February', 'April', 'June', 'July', 'September', 'October', 'November', 'December'];
// Also ordinary words ("May I", "March on", "an August hall"): a date only after "in"/"of" or before a number.
const WORDY_MONTHS = ['May', 'March', 'August'];
const SURE = new RegExp(`\\b(?:${[...WEEKDAYS, ...PLAIN_MONTHS].join('|')})\\b`, 'g');
const WORDY = new RegExp(`(?:\\b(?:in|of) (${WORDY_MONTHS.join('|')})\\b)|(?:\\b(${WORDY_MONTHS.join('|')}) \\d)`, 'g');

/** The real-world day and month names `text` uses (each once, in order of appearance), minus the calendar's own month names. */
export function foreignNames(text, calendar) {
    const own = new Set((calendar?.config?.months ?? []).map(month => month.name));
    const source = String(text ?? '');
    const found = [];
    for (const match of source.matchAll(SURE)) found.push([match.index, match[0]]);
    for (const match of source.matchAll(WORDY)) found.push([match.index, match[1] ?? match[2]]);
    return [...new Set(found.sort((a, b) => a[0] - b[0]).map(entry => entry[1]))].filter(name => !own.has(name));
}
