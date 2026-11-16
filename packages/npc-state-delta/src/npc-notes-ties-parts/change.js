// The `~ tie` change: applying +tag and -tag words to a ties object without mutating it.
import { TIES_MAX_PEOPLE, ordered } from './shared-tags.js';
import { tiesText } from './record.js';
import { keyOf, readTiesObject, sortedCopy } from './shared-object.js';

const TAG_CHANGE = /^([+-])(ally|rival|owes)$/;

/**
 * The story's `~ tie` change, applied to a ties object (or null). `change` is { self, with, tags }, where tags are "+ally", "-rival",
 * "+owes" (this person owes `with`). Returns { ties, changed, ignored, refused }: `ties` is a new object (the input is never mutated),
 * `ignored` lists the tag words that were not `+`/`-` plus one of ally, rival, owes, and `refused` is 'self' (tying a person to
 * themself), 'name' (a name with no key), 'people' (a new person beyond the twelve) or null.
 */
export function applyTags(ties, change) {
    const base = readTiesObject(ties);
    const selfKey = keyOf(change?.self);
    const withKey = keyOf(change?.with);
    const ignored = [];
    const refuse = (refused) => ({ ties: base, changed: false, ignored, refused });
    if (!withKey) return refuse('name');
    if (selfKey === withKey) return refuse('self');
    const current = new Set(base[withKey] ?? []);
    for (const raw of Array.isArray(change?.tags) ? change.tags : []) {
        const match = TAG_CHANGE.exec(String(raw ?? '').trim());
        if (!match) { ignored.push(String(raw ?? '')); continue; }
        if (match[1] === '+') current.add(match[2]);
        else current.delete(match[2]);
    }
    if (!current.size && !(withKey in base)) return { ties: base, changed: false, ignored, refused: null };
    if (current.size && !(withKey in base) && Object.keys(base).length >= TIES_MAX_PEOPLE) return refuse('people');
    const next = { ...base };
    if (current.size) next[withKey] = ordered([...current]);
    else delete next[withKey];
    const changed = tiesText(next) !== tiesText(base);
    return { ties: sortedCopy(next), changed, ignored, refused: null };
}
