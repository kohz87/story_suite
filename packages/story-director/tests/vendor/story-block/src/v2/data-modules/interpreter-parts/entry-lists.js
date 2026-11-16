// Decides whether an entry can be added to a list, and carries a list over to a changed definition.
import { DM_LIMITS as L, dmOwn } from '../schema.js';
import { STRINGS } from '../../strings.js';
import { scalarHolds } from './scalars.js';
import { titlePart, sameTitle } from './entry-names.js';

// Why an entry cannot be added to the list as it stands (null when it can): the list is full, or an entry already has that title.
export function entryAddProblem(definition, field, list, parts) {
    const schema = definition.state[field], title = titlePart(definition, field);
    if (list.length >= (schema.max ?? L.entriesDefault)) return { code: 'DM_BUDGET', path: field, message: STRINGS.blocks.entriesFull };
    if (title && typeof parts?.[title] === 'string' && list.some(entry => sameTitle(entry[title], parts[title]))) return { code: 'DM_BOUNDS', path: title, message: STRINGS.blocks.entryDuplicate };
    return null;
}

/**
 * A List of entries carried over to a changed definition, part by part: a part that is still there keeps its value (a text longer than the new limit is cut to it;
 * a number or choice that no longer holds goes back to the part's default), a new part starts at its default, a removed part is dropped. Never empties the list.
 * → the new list, or null when the new `max` is lower than the number of entries (the caller refuses with a sentence).
 */
export function carryEntries(schema, list) {
    if (!Array.isArray(list)) return [];
    if (list.length > (schema.max ?? L.entriesDefault)) return null;
    return list.map(entry => Object.fromEntries(Object.entries(schema.of).map(([key, sub]) => {
        const value = dmOwn(entry, key) ? entry[key] : undefined;
        if (sub.type === 'text' && typeof value === 'string') return [key, [...value].slice(0, sub.max).join('')];
        return [key, value !== undefined && scalarHolds(sub, value) ? value : sub.default];
    })));
}
