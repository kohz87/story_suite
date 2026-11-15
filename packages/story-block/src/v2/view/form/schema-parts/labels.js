// Reads of a field as the form engine needs them: its options, a label for its key, and whether a search matches it.

import { normalizeField } from '../../../registry.js';

/** A choice's options as [{ value, label }] (strings). */
export const optionsOf = field => (normalizeField(field)?.options ?? []).map(option => (option && typeof option === 'object' ? { value: String(option.value), label: String(option.label ?? option.value) } : { value: String(option), label: String(option) }));

/** "partyMembers" → "Party members": a label for a key with none. */
export const humanize = key => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, char => char.toUpperCase());

/** A field's label: its own, else its key made readable. */
export const labelOf = (key, field) => String(normalizeField(field)?.label ?? humanize(key));

/**
 * Whether a field matches a search text: every word of it is in the label, the help, the group's name or the key
 * (case does not matter). An empty search matches everything.
 */
export function matchesSearch(key, field, group, text) {
    const words = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const f = normalizeField(field) ?? {};
    const hay = [key, f.label, f.help, group].map(part => String(part ?? '').toLowerCase()).join(' ');
    return words.every(word => hay.includes(word));
}
