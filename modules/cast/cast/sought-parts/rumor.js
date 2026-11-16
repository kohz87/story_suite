// Building name-free rumor lines for sought cast members who are elsewhere.

import { cutPoints, flat } from '../domain.js';
import { words } from './cite.js';
import { kindWords } from './kind.js';
import { nameTester } from './names.js';

export const MAX_RUMOR = 240;
const lowerFirst = text => text.replace(/^(\p{Lu})(\p{Ll}+)(?=\s+\p{Ll}|$|,)/u, (_all, first, rest) => `${first.toLowerCase()}${rest}`);
const article = text => (/^(?:the|a|an|some)\s/i.test(text) ? '' : /^[aeiou]/i.test(text) ? 'an ' : 'a ');

/**
 * The line the narrator is told when the reader sought a kind of person who is elsewhere: who they are (calling, the lead of `about`) and
 * where to find them (their routine's first part and `where`), built from the entry and never carrying the name, an alias or a name-like
 * token: a part that does is left out, and with nothing left (or the whole still naming them) there is no rumor (''). `home`: they are at
 * their start, so their routine says what they do there.
 */
export function rumorText(entry, { where = '', home = false } = {}) {
    const mentions = nameTester(entry);
    const { calling, lead } = kindWords(entry);
    const place = mentions(where) ? '' : flat(where);
    // Who they are: their calling, else the lead of their `about`.
    const kind = calling ? lowerFirst(cutPoints(calling, 80)) : lowerFirst(lead);
    if (!kind) return '';
    // The lead says more of who they are when there is a calling too ("a saintess candidate, healer (fox-eared saintess candidate of the Church...)").
    const extra = calling && lead && !words(calling).some(word => words(lead).includes(word)) ? ` (${cutPoints(lead, 60)})` : '';
    // Where to find them: what their routine has them at (only at their start, and only a short noun phrase), then the place.
    const routine = home ? shortRoutine(entry?.routine, mentions) : '';
    const spot = routine && place && !routine.toLowerCase().includes(place.toLowerCase()) ? `${routine} in ${place}` : routine || (place ? `in ${place}` : '');
    const text = `People here know of ${article(kind)}${kind}${extra}${spot ? `, ${routine ? 'at ' : 'found '}${spot}` : ''}.`;
    if (mentions(text)) return '';
    return cutPoints(text, MAX_RUMOR);
}

// The first part of a routine when it reads as a place and a time ("Watchhouse infirmary by day"): short, no comma, not opening with a verb.
function shortRoutine(routine, mentions) {
    const part = String(routine ?? '').split(/[;.]/).map(flat).find(one => one && !mentions(one)) ?? '';
    const first = part.replace(/^(?:the|a|an)\s+/i, '').split(/\s+/)[0] ?? '';
    if (!part || Array.from(part).length > 32 || part.includes(',') || /(?:s|ing|ed)$/i.test(first)) return '';
    return part.replace(/^(\p{Lu})(?=\p{Ll}+\s)/u, c => (/^the\s/i.test(part) ? c.toLowerCase() : c));
}
