// A person's Level as stored: the built-in `level`, or, while that is absent, a whole number in the custom field "Level" (any case), where a chat
// from before the built-in field (pack format 4) kept it. Read only: the custom field stays as it is. Used wherever "only up" is checked.
import { normalizeLevel } from './built-in-fields.js';

/** The record's Level (1 to 99), or null when it has none. */
export function storedLevel(record) {
    const own = normalizeLevel(record?.level);
    if (own !== null || (record?.level !== undefined && record?.level !== null)) return own;
    const fields = record?.customFields && typeof record.customFields === 'object' && !Array.isArray(record.customFields) ? record.customFields : {};
    const name = Object.keys(fields).find(key => key.trim().toLowerCase() === 'level');
    return name ? normalizeLevel(fields[name]) : null;
}
