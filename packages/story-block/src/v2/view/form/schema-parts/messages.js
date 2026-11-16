// What the form says to the reader: its plain-words messages and the note for a value the store did not keep as typed.

import { normalizeField } from '../../../../../../../core/registry.js';
import { fill } from '../../../../../../../core/strings.js';
import { humanize } from './labels.js';

/** What the form says to the reader (plain words). */
export const FORM_TEXT = Object.freeze({
    readOnly: 'Read only',
    notWhole: 'Enter a whole number. The setting stays {value}.',
    least: 'Set to {value}, the least this allows.',
    most: 'Set to {value}, the most this allows.',
    cut: 'Cut to {max} characters, the most this allows.',
    refused: 'That could not be saved. The setting stays {value}.',
    count: '{n} of {max} characters',
    clear: 'Clear the search',
    searchLabel: 'Search settings',
    searchPlaceholder: 'Search settings…',
    shown: '{n} settings shown',
    shownOne: '1 setting shown',
    none: 'No settings match "{text}".',
    noRows: 'Nothing here yet.',
    sliderValue: '{value}',
    rowNote: 'Row {n}, {field}: {note}',
    rowsCut: 'Only {kept} of the {typed} rows could be kept.',
});

/**
 * The words for a value the store did not keep as typed: a whole number moved into its range, a text cut at its
 * maximum. '' when `typed` and `stored` agree (or the field is neither).
 */
export function changeNote(field, typed, stored) {
    const f = normalizeField(field);
    if (f?.type === 'int' && typeof typed === 'number' && typeof stored === 'number' && typed !== stored) {
        return fill(typed < stored ? FORM_TEXT.least : FORM_TEXT.most, { value: stored });
    }
    if (f?.type === 'text' && typeof typed === 'string' && typeof stored === 'string' && typed !== stored && Number.isInteger(f.max)) {
        return fill(FORM_TEXT.cut, { max: f.max });
    }
    // A list: rows the store left out, else the first field of a row it moved (a number into its range, a text cut), by row.
    if (f?.type === 'list' && Array.isArray(typed) && Array.isArray(stored)) {
        if (stored.length < typed.length) return fill(FORM_TEXT.rowsCut, { kept: stored.length, typed: typed.length });
        for (let at = 0; at < stored.length; at += 1) {
            for (const [key, sub] of Object.entries(f.of ?? {})) {
                const note = changeNote(sub, typed[at]?.[key], stored[at]?.[key]);
                if (note) return fill(FORM_TEXT.rowNote, { n: at + 1, field: normalizeField(sub)?.label ?? humanize(key), note });
            }
        }
    }
    return '';
}
