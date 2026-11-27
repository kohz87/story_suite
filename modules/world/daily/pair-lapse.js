// World events, the daily step: events the pairing switches off (pack format 4, §4.2). An event whose fixed date is not on the chat's calendar (no such
// month, or a day past it) or whose season the calendar does not have can never fire in this pairing: on the chat's first step it is Lapsed (it never
// fires, and events that wait on it follow the usual cascade) and a warning says which, so Problems shows it once. A template with such an anchor is left out. Pure (on `ws`).

import { anchorString } from './grammar.js';
import { closeEvent } from './fire.js';

const list = value => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);

/** Every anchor text an event or template def reads. */
function anchorTexts(def) {
    return [def.window?.after, ...list(def.requires), ...list(def.requiresAny), ...list(def.preEmptedBy), ...list(def.needs), ...list(def.ends?.anyOf), ...list(def.likelier).map(row => row?.key)]
        .filter(text => typeof text === 'string');
}

/** Why the calendar has no place for one of the def's date or season anchors, or '' when every one fits. */
function problemOf(ws, def) {
    for (const text of anchorTexts(def)) {
        const anchor = anchorString(text);
        if (anchor?.kind === 'date') {
            const why = ws.cal.dateProblem(anchor.id);
            if (why) return `"${text}": ${why}`;
        } else if (anchor?.kind === 'season' && !ws.cal.hasSeason(anchor.id)) return `"${text}": the calendar has no season "${anchor.id}"`;
    }
    return '';
}

// A note about the pack and the calendar quotes the pack's ids: Problems only.
function unfit(ws, text) {
    ws.warnings.push(text);
    ws.card[text] = '';
}

/**
 * On a chat's first step: Lapse every event that does not fit the calendar and return the templates that do. `day` is the first day stepped.
 * A later step finds the lapsed events already finished and leaves them (the warning is not repeated); `first` says the chat has no stored state yet, when a left-out template is said too.
 */
export function lapseUnpaired(ws, defs, day, first) {
    for (const def of defs.events) {
        const why = problemOf(ws, def);
        if (!why || ws.events[def.id]) continue;
        ws.events[def.id] = { state: 'dormant' };
        closeEvent(ws, def, day, 'lapsed', 'its date or season is not on this calendar');
        unfit(ws, `The event "${def.id}" never fires with this calendar: ${why}.`);
    }
    return defs.templates.filter(def => {
        const why = problemOf(ws, def);
        if (why && first) unfit(ws, `The template "${def.id}" is not run with this calendar: ${why}.`);
        return !why;
    });
}
