// Story Director v2, names: a minor person's one-line profile, its stored text and the cap on stored people.

import { PROFILE_FIELDS, MAX_FIELD, MAX_PROFILE, MAX_MINOR } from './profile-limits.js';
import { flat, cutPoints } from './text.js';

/**
 * A minor person's one-line profile from the text after the name: `look: … | flaw: … | voice: … | temper: …`, the labels
 * in any order; a segment with no label fills the first empty field in turn. Each field is flat and cut to MAX_FIELD
 * code points; segments beyond the four are counted in `extra`. Returns `{ profile, text, ok, extra }`, `ok` when any
 * field has text, `text` the stored line (profileText).
 */
export function parseProfile(value) {
    const profile = Object.fromEntries(PROFILE_FIELDS.map(field => [field, '']));
    const plain = [];
    for (const segment of flat(value).split('|').map(part => part.trim()).filter(Boolean)) {
        const match = /^(look|flaw|voice|temper)\s*:(.*)$/i.exec(segment);
        const field = match ? match[1].toLowerCase() : '';
        if (field && !profile[field]) profile[field] = cutPoints(match[2], MAX_FIELD);
        else if (!field) plain.push(segment);
    }
    for (const field of PROFILE_FIELDS) {
        if (!profile[field] && plain.length) profile[field] = cutPoints(plain.shift(), MAX_FIELD);
    }
    return { profile, text: profileText(profile), ok: PROFILE_FIELDS.some(field => profile[field] !== ''), extra: plain.length };
}

/**
 * The stored one-line profile: the four labelled fields joined by ` | ` (the grammar's own separator, so the line reads
 * back through parseProfile), each cut to MAX_FIELD code points, the whole cut to MAX_PROFILE. A field's `|` becomes `/`.
 */
export function profileText(profile) {
    const parts = PROFILE_FIELDS
        .map(field => [field, cutPoints(String(profile?.[field] ?? '').replace(/\|/g, '/'), MAX_FIELD)])
        .filter(([, text]) => text !== '')
        .map(([field, text]) => `${field}: ${text}`);
    return cutPoints(parts.join(' | '), MAX_PROFILE);
}

/**
 * The minor people kept under the cap: `people` is `{ key: { first, ... } }` where `first` is the reply the person first
 * appeared in. Over `max`, the oldest (lowest `first`, then key) are evicted. Returns `{ people, evicted }` with the
 * kept entries (a new object) and the evicted keys in eviction order. Pure.
 */
export function capMinor(people = {}, max = MAX_MINOR) {
    const keys = Object.keys(people ?? {});
    const over = keys.length - Math.max(0, Math.floor(Number(max)) || 0);
    const order = keys.slice().sort((a, b) => (Number(people[a]?.first) || 0) - (Number(people[b]?.first) || 0) || (a < b ? -1 : a > b ? 1 : 0));
    const evicted = over > 0 ? order.slice(0, over) : [];
    const gone = new Set(evicted);
    const kept = {};
    for (const key of keys) if (!gone.has(key)) kept[key] = people[key];
    return { people: kept, evicted };
}
