// Names an entry of a List of entries: its title part, the `at` a story line writes, and title equality.
import { dmOwn } from '../schema.js';
import { oneLine } from '../../../text.js';

/**
 * The part of a List of entries that names an entry (its title): the one the block's roles call the title, else the first text part. null when the entry has no
 * text part. One answer for the add line's required label, the `at` matcher and the prompt's tail.
 */
export function titlePart(definition, field) {
    const schema = definition?.state?.[field];
    if (schema?.type !== 'entries') return null;
    const { roles } = definition;
    if (roles?.field === field && dmOwn(schema.of, roles.title) && schema.of[roles.title].type === 'text') return roles.title;
    return Object.keys(schema.of).find(key => schema.of[key].type === 'text') ?? null;
}

// What a story line writes in `at`: the entry's number ("2", "#2", "2.") or its title, with one pair of surrounding quotes (the tail writes titles in quotes) removed.
const QUOTES = [['"', '"'], ["'", "'"], ['\u201c', '\u201d'], ['\u2018', '\u2019']];
export function entryAt(value) {
    let at = oneLine(String(value ?? ''));
    for (const [open, close] of QUOTES) if (at.length >= 2 && at.startsWith(open) && at.endsWith(close)) { at = at.slice(1, -1).trim(); break; }
    return at;
}
export const sameTitle = (a, b) => oneLine(a).toLowerCase() === oneLine(b).toLowerCase();
