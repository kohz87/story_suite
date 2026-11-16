// Reading a pack's `People` field as species, gender and ages.

import { normalizeAge, normalizeApparentAge, normalizeGender } from '../../core-identity.js';
import { FIELD_VALUE_MAX } from './limits-fields.js';
import { clip } from './shared-text.js';

const PEOPLE_LOOKS = /\s*\(?\blooks?\s+(?:(?:about|around|approx\.?|approximately)\s+)?(\d{1,3})\)?\s*$/i;
const PEOPLE_AGE = /^(?:formed\s+)?(?:(about|around|approx\.?|approximately)\s+)?(\d{1,3})(?:\s*(?:years?|yrs?)(?:\s+(?:old|ago))?)?$/i;
const PEOPLE_HEAD = /^(\p{L}[\p{L}'-]*(?:\s+\p{L}[\p{L}'-]*){0,2}?)(?:\s+(woman|man|female|male))?$/iu;

/**
 * A pack's `People` field ("Dogfolk woman, 21", "Dwelf, 58 (looks about 25)", "Elf, about 240 (looks about 35)", "Fairy, about 160",
 * "Spiritfolk, formed about 300 years ago (looks about 30)") read as { species, gender, age, apparentAge } (each '' when absent), in the
 * shapes the dossier stores them (core-identity: gender male|female, age "21" or "about 240", apparent age "~25"). Gender only from
 * woman/man/female/male, never inferred. Text that does not fit whole gives all empty: nothing is guessed.
 */
export function parsePeople(raw) {
    const none = { species: '', gender: '', age: '', apparentAge: '' };
    let text = clip(raw, FIELD_VALUE_MAX);
    let looks = '';
    const seen = PEOPLE_LOOKS.exec(text);
    if (seen) { looks = seen[1]; text = text.slice(0, seen.index).trim(); }
    const [headText, ...rest] = text.split(',');
    const head = PEOPLE_HEAD.exec(headText.trim());
    if (!head) return none;
    let age = '';
    if (rest.length) {
        const match = PEOPLE_AGE.exec(rest.join(',').trim());
        if (!match) return none;
        age = normalizeAge(`${match[1] ? 'about ' : ''}${match[2]}`);
    }
    const species = clip(head[1], 160);
    if (!species || (!age && !looks && !head[2])) return none;
    return { species, gender: normalizeGender(head[2]), age, apparentAge: looks ? normalizeApparentAge(`about ${looks}`) : '' };
}
