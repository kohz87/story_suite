// Story Director v2, tracker part (scene): matches names in text as whole words and tells whether a record names a person.

import { MIN_NAME } from './shared-limits.js';
import { flat, isRecord, normalize } from './shared-text.js';

// Word boundaries that work for accented names too (\b is ASCII-only), as v1's relevance.js.
// One compiled pattern per name (no g or y flag, so it holds no state); bounded, cleared whole when full.
const PATTERNS = new Map();
const PATTERNS_MAX = 2048;
function wordPattern(name) {
    let pattern = PATTERNS.get(name);
    if (!pattern) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
        if (PATTERNS.size >= PATTERNS_MAX) PATTERNS.clear();
        PATTERNS.set(name, pattern);
    }
    return pattern;
}
const names = (value, name) => name.length >= MIN_NAME && wordPattern(name).test(value);
/** Whether `value` holds `name` as whole words (and `name` is at least MIN_NAME long): "Vorn" is in "Vorn's Return", "Ann" is not in "Annual Fair". */
export const wholeWord = names;

/** The text a thread names people in: its key, giver, people, now and summary. */
const peopleText = record => [record.key, record.fields?.giver, record.fields?.people, record.fields?.now, record.fields?.desc].map(flat).join('\n');

// Plurals folded ("wardens" -> "warden") so "South Gate wardens" and a role "Gate warden" meet by the same whole-word rule.
const foldPlural = value => normalize(value).split(' ').map(word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)).join(' ');

/** The group words of a person: their dossier's role and faction / group / affiliation (also as a custom field). */
function groupTags(person) {
    const dossier = person.dossier ?? {};
    const custom = isRecord(dossier.customFields) ? dossier.customFields : {};
    const tags = [dossier.role, ...['faction', 'group', 'affiliation'].flatMap(name => [dossier[name], custom[name]])];
    return tags.flatMap(tag => flat(tag).split(',')).map(foldPlural).filter(word => word.length >= MIN_NAME);
}

/**
 * Whether `record` names `person` (any name they go by), or a name it gives (key, giver, people) names them.
 * `group`: a group the record's giver or people name ("South Gate wardens") also names a member of it, a person whose
 * role or faction tag holds the group's words, or the other way round (the same whole-word rule, plurals folded).
 */
export function namesPerson(record, person, { strict = false, group = false } = {}) {
    const fields = record.fields ?? {};
    const own = [record.key, ...String(fields.giver ?? '').split(','), ...String(fields.people ?? '').split(',')].map(flat).filter(word => word.length >= MIN_NAME);
    const text = strict ? own.join('\n') : peopleText(record);
    if (person.names.some(name => names(text, name))) return true;
    // "Geva" written for "Senior Listener Geva" present, and the other way round.
    if (own.some(word => person.names.some(name => names(name, word)))) return true;
    if (!group) return false;
    const tags = groupTags(person);
    // Only a giver or the people named, not the thread's own key: a key such as "Merchant's ring" names no group.
    const named = [...String(fields.giver ?? '').split(','), ...String(fields.people ?? '').split(',')].map(foldPlural).filter(word => word.length >= MIN_NAME);
    return named.some(word => tags.some(tag => names(word, tag) || names(tag, word)));
}
