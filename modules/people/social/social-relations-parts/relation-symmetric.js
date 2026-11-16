/* Mirroring a symmetric bond ("childhood friend") onto the other side.
   Part of social-relations.js; social-relations.js re-exports it. */

import { norm } from '../social-primitives.js';

// Words a symmetric bond shares on both sides ("childhood friend", "second cousin"). Any other
// qualifier ("older", "disinherited half-elf") describes one person only and must not be mirrored.
const MUTUAL_RELATION_QUALIFIERS = new Set([
    'best', 'close', 'childhood', 'old', 'lifelong', 'sworn', 'bitter', 'former', 'estranged', 'ex',
    'first', 'second', 'third', 'distant', 'fellow',
]);

const SYMMETRIC_RELATION_WORD = /\b(friend|rival|cousin|ally|companion|comrade|colleague|coworker|neighbou?r|classmate|enemy|acquaintance|teammate)\b/;

function symmetricInverse(rel) {
    const words = norm(rel).split(/\s+/).filter(Boolean);
    const index = words.findIndex(word => SYMMETRIC_RELATION_WORD.test(word));
    if (index < 0) return '';
    return [...words.slice(0, index).filter(word => MUTUAL_RELATION_QUALIFIERS.has(word)), words[index]].join(' ');
}

export { MUTUAL_RELATION_QUALIFIERS, SYMMETRIC_RELATION_WORD, symmetricInverse };
