// Whether a value fits its declared field schema (number, choice, text, entries or map).
import { DM_LIMITS as L, dmInt, dmObject, dmOwn } from '../schema.js';

export function scalarHolds(schema, value) {
    if (!schema) return false;
    if (schema.type === 'int') return dmInt(value, schema.min, schema.max);
    if (schema.type === 'bool') return typeof value === 'boolean';
    if (schema.type === 'enum') return schema.values.includes(value);
    if (schema.type === 'text') return typeof value === 'string' && [...value].length <= schema.max
        && (schema.list !== true || !value || value.split(';').length <= 12);
    if (schema.type === 'entries') return entriesHold(schema, value);
    return schema.type === 'map' && dmObject(value) && Object.keys(value).length === schema.keys.length
        && schema.keys.every(key => dmOwn(value, key) && scalarHolds(schema.values, value[key]));
}

// A List of entries holds when it is a list of at most `max` entries, each one an object with exactly the parts of `of`, every part holding its own type.
// (text parts are kept short and on one line; an empty text is allowed, for a part the story has not filled in)
const entriesHold = (schema, value) => Array.isArray(value) && value.length <= (schema.max ?? L.entriesDefault) && value.every(entry => dmObject(entry)
    && Object.keys(entry).length === Object.keys(schema.of).length
    && Object.entries(schema.of).every(([key, sub]) => dmOwn(entry, key) && (sub.type === 'text' ? typeof entry[key] === 'string' && [...entry[key]].length <= sub.max : scalarHolds(sub, entry[key]))));
