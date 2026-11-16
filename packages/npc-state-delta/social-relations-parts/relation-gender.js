/* Narrowing a gender-neutral inverse ("aunt / uncle") once the counterpart gender is known.
   Part of social-relations.js; social-relations.js re-exports it. */

import { norm } from '../social-primitives.js';

// An inverse derived without gender reads "aunt / uncle"; once the counterpart's gender is known
// the bond names the one that applies.
const GENDERED_RELATION_PAIRS = [['aunt', 'uncle'], ['niece', 'nephew']];

function genderedRelation(relation, counterpart = null) {
    const gender = String(counterpart?.gender || '').toLowerCase();
    if (!relation || (gender !== 'female' && gender !== 'male')) return relation;
    const parts = relation.split(/\s*\/\s*/).map(norm);
    const pair = GENDERED_RELATION_PAIRS.find(([f, m]) => parts.length === 2 && parts.includes(f) && parts.includes(m));
    return pair ? pair[gender === 'female' ? 0 : 1] : relation;
}

export { GENDERED_RELATION_PAIRS, genderedRelation };
