// The job: the shape checks of a world-pack cast entry's list fields (ties, key relationships, stages, tastes, abilities, secrets, behaviour). Pure.
// Each returns the kept list; `say(field, message)` collects a Problem for the entry.

import { SLUG, TIE_TAGS, WORLD_CAST_LIMITS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { isObject } from '../core.js';

const PLAIN = /[<>{}]/;
export const plain = (value, max) => typeof value === 'string' && value.trim().length > 0 && [...value].length <= max && !PLAIN.test(value);
const only = (record, fields, at, say) => { for (const key of Object.keys(record)) if (!fields.includes(key)) say(`${at}.${key}`, `"${key}" is not a field here (expected ${fields.join(', ')}).`, 'UNKNOWN_FIELD'); };

function listOf(value, field, max, say) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > max) return say(field, `${field} must be a list of at most ${max} entries.`), [];
    return value;
}

export function ties(value, say) {
    return listOf(value, 'ties', WORLD_CAST_LIMITS.ties, say).flatMap((tie, n) => {
        const at = `ties[${n}]`;
        if (!isObject(tie)) return say(at, `${at} must be { "with": "<cast id>", "tag": "ally" }.`), [];
        only(tie, ['with', 'tag'], at, say);
        if (typeof tie.with !== 'string' || !SLUG.test(tie.with)) return say(`${at}.with`, `${at}.with must be a cast id.`), [];
        if (!TIE_TAGS.includes(tie.tag)) return say(`${at}.tag`, `${at}.tag must be one of ${TIE_TAGS.join(', ')}.`), [];
        return [{ with: tie.with, tag: tie.tag }];
    });
}

export function relationships(value, say) {
    return listOf(value, 'keyRelationships', WORLD_CAST_LIMITS.keyRelationships, say).flatMap((entry, n) => {
        const at = `keyRelationships[${n}]`;
        if (!isObject(entry)) return say(at, `${at} must be { "id": "<cast id>", "text": "…" }.`), [];
        only(entry, ['id', 'text'], at, say);
        if (typeof entry.id !== 'string' || !SLUG.test(entry.id)) return say(`${at}.id`, `${at}.id must be a cast id.`), [];
        if (!plain(entry.text, WORLD_CAST_LIMITS.line * 2)) return say(`${at}.text`, `${at}.text must be plain text of 1 to ${WORLD_CAST_LIMITS.line * 2} characters.`), [];
        return [{ id: entry.id, text: oneLine(entry.text) }];
    });
}

/** Name + description pairs (abilities, keepsakes) and tastes. */
export function pairs(value, field, keys, max, say) {
    return listOf(value, field, max, say).flatMap((entry, n) => {
        const at = `${field}[${n}]`;
        if (!isObject(entry)) return say(at, `${at} must be an object of ${keys.join(', ')}.`), [];
        only(entry, keys, at, say);
        const bad = keys.find(key => (key === 'like' ? typeof entry.like !== 'boolean' : !plain(entry[key], WORLD_CAST_LIMITS.line)));
        if (bad) return say(`${at}.${bad}`, `${at}.${bad} ${bad === 'like' ? 'must be true or false' : `must be plain text of 1 to ${WORLD_CAST_LIMITS.line} characters`}.`), [];
        return [Object.fromEntries(keys.map(key => [key, typeof entry[key] === 'string' ? oneLine(entry[key]) : entry[key]]))];
    });
}
