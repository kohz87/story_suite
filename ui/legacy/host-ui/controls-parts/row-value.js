// Whether a settings field is read-only now, and the value its row shows.

import { normalizeField } from '../../../../../../core/registry.js';
import { emptyValue } from './values.js';

/**
 * Whether a schema field is read-only now (SPEC §6): its `readOnly` is `true`, or a function of the
 * module's current values (`settings(id)`) that returns true. A function that throws counts as false.
 */
export function fieldReadOnly(field, values) {
    const flag = normalizeField(field)?.readOnly;
    if (typeof flag !== 'function') return flag === true;
    try { return Boolean(flag(values)); } catch { return false; }
}

/**
 * The value a settings row shows: the stored value (else the default, else the field's empty value); a
 * read-only field with `shows(values)` shows what that returns instead, for display only (the stored value
 * is kept, so it is back when the field is editable again). A `shows` that throws or returns undefined
 * shows the stored value.
 */
export function rowValue(key, field, values) {
    const stored = Object.hasOwn(values, key) ? values[key] : emptyValue(field);
    const shows = normalizeField(field)?.shows;
    if (typeof shows !== 'function' || !fieldReadOnly(field, values)) return stored;
    try {
        const value = shows(values);
        return value === undefined ? stored : value;
    } catch {
        return stored;
    }
}
