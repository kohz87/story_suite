// Checking whether the reply shows a person the meeting brought in (name match and withdrawal).

import { isInt, isMet, isRecord, keysOfPerson, slotOf, tables } from '../domain.js';
import { bare } from './shared-bare.js';

const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether `text` (the reply's shown words, hidden comments out) names the person: their name or one of their aliases as a whole word,
 * in any case. A title alone ("Sister") is not a name, and a name inside a longer word is not the name.
 */
export function namedIn(person, text) {
    const said = String(text ?? '');
    if (!said) return false;
    const names = [person?.name, ...(Array.isArray(person?.aliases) ? person.aliases : [])].map(name => String(name ?? '').trim()).filter(Boolean);
    return names.some(name => new RegExp(`(?<![\\p{L}\\p{N}_])${name.split(/\s+/).map(escapeRe).join('\\s+')}(?![\\p{L}\\p{N}_])`, 'iu').test(said));
}

/**
 * The people the meeting recorded for reply `index` brought in who the reply did not show, as keys: `slice.meeting` is for that reply, the
 * person was met by it (their `rev` is the meeting's) for place or goal (someone met in the story is never withdrawn), and neither the
 * shown `text` names them nor `present` (keys of the scene's present list at the end) does, nor, for a meeting marked `seen`, `seen` (everyone the reply's scene lines had present at any point).
 */
export function unshown(slice, { index = null, text = '', present = new Set(), seen = new Set() } = {}) {
    const meeting = slotOf(slice?.meeting);
    if (!meeting || !isInt(index) || meeting.at !== index) return [];
    const { people } = tables(slice);
    const out = [];
    // A meeting made with `seen` also counts who the reply had in the scene at any point, by a name only that person has (a label two
    // people share, "the captain", shows neither).
    const sharing = new Map();
    for (const other of Object.values(people)) if (isRecord(other)) for (const name of new Set(keysOfPerson(other))) sharing.set(name, (sharing.get(name) ?? 0) + 1);
    const wasSeen = person => meeting.seen === 1 && keysOfPerson(person).some(name => sharing.get(name) === 1 && (seen.has(name) || seen.has(bare(name))));
    for (const key of meeting.keys) {
        const person = isRecord(people[key]) ? people[key] : null;
        if (!person || !isMet(person) || person.met.why === 'story' || person.met.rev !== meeting.rev) continue;
        if (namedIn(person, text) || wasSeen(person) || keysOfPerson(person).some(name => present.has(name) || present.has(bare(name)))) continue;
        out.push(key);
    }
    return out;
}
