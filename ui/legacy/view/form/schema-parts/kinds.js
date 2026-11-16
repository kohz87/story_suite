// Which kind of control a field gets: the kinds the engine draws and the rule that picks one.

import { normalizeField } from '../../../../../core/registry.js';
import { optionsOf } from './labels.js';

/** The kinds of control the engine draws (a field's `kind`, `fieldKind`). */
export const FIELD_KINDS = Object.freeze(['switch', 'text', 'number', 'slider', 'select', 'chips', 'chipset', 'segmented', 'profile', 'lines']);

/**
 * The kind of control a field gets, or null for a type the engine does not know (a newer module's: it is not
 * drawn and its value is kept). bool: a switch. int: a number box, or a slider with `form: 'slider'` and whole-
 * number min and max. choice: a select, chips (one of them) with `form: 'chips'`, or one joined row of buttons with `form: 'segmented'` (a few short options, such as Normal / 110% / 120%). text: a text box (a text area
 * with `multiline`; with `form: 'chips'` and `options`, chips that fill the text, several at once). profile: the Connection Manager profile select. list: rows with Add and Remove, or one line per
 * item (`form: 'lines'` starts there).
 */
export function fieldKind(field) {
    const f = normalizeField(field);
    switch (f?.type) {
        case 'bool': return 'switch';
        case 'int': return f.form === 'slider' && Number.isInteger(f.min) && Number.isInteger(f.max) && f.max > f.min ? 'slider' : 'number';
        case 'choice': return f.form === 'chips' ? 'chips' : f.form === 'segmented' ? 'segmented' : 'select';
        // Text that holds a list of words the reader picks from ("~ time, ~ place"): chips, several at once (`chipsetField`).
        case 'text': return f.form === 'chips' && optionsOf(f).length ? 'chipset' : 'text';
        case 'profile': return 'profile';
        case 'list': return 'lines';
        default: return null;
    }
}
