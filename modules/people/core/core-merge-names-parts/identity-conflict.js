// Identity-conflict checks between two dossiers: partial-name pairs, place overlap and the merge-blocking conflict test.
import { normalizeName } from '../core-text.js';
import { isRoleDescriptionLabel, normalizeGender } from '../core-identity.js';
import { bareTokens, titled } from './shared-name-tokens.js';

// (name collisions) Two dossiers that share a label only through a PART of a longer name are not one person on that alone: a surname
// ("Pell" and "Vrena Pell"), a first word, or a name with a title dropped ("Varn" and "Master Varn"). `partialNamePair` finds such a pair;
// `identityConflict` says they are different people when their genders differ, or their roles share no word and the scanner did not say
// they are the same individual (`explicit`). A pair that is not partial, or has no conflict, matches exactly as before.
export function partialNamePair(a, b) {
    const left = normalizeName(a);
    const right = normalizeName(b);
    if (!left || !right || left === right || isRoleDescriptionLabel(a) || isRoleDescriptionLabel(b)) return false;
    const [short, long] = bareTokens(a).length <= bareTokens(b).length ? [bareTokens(a), bareTokens(b)] : [bareTokens(b), bareTokens(a)];
    return short.length > 0 && short.every(token => long.includes(token));
}
const GENERIC_PLACE_WORDS = new Set(['near', 'from', 'with', 'into', 'outside', 'inside', 'room', 'hall', 'house',
    'street', 'road', 'square', 'market', 'tavern', 'city', 'town', 'village', 'district', 'quarter']);

export function placesOverlap(a, b) {
    const left = normalizeName(a);
    const right = normalizeName(b);
    if (!left || !right) return false;
    if (` ${left} `.includes(` ${right} `) || ` ${right} `.includes(` ${left} `)) return true;
    const words = new Set(left.split(' ').filter(word => word.length >= 4 && !GENERIC_PLACE_WORDS.has(word)));
    return right.split(' ').some(word => words.has(word));
}
const roleWords = role => new Set(normalizeName(role).split(/\s+/).filter(word => word.length >= 4));
// A role conflict alone is weak (the scanner words a role differently from scan to scan), so it blocks a merge only together with a second
// difference: the short name is the long one's surname ("Pell" / "Vrena Pell"), a title sits on one side only ("Varn" / "Master Varn"), or both
// have a place and the places do not overlap. A reworded role of the same person ("Vrena" / "Vrena Pell") still merges. Gender is stricter:
// a conflict there blocks on its own.
function secondDifference(a, b) {
    const [short, long] = bareTokens(a?.name).length <= bareTokens(b?.name).length ? [a, b] : [b, a];
    const shortTokens = bareTokens(short?.name), longTokens = bareTokens(long?.name);
    if (shortTokens.length === 1 && longTokens.length > 1 && longTokens.at(-1) === shortTokens[0]) return true;
    if (titled(a?.name) !== titled(b?.name)) return true;
    const places = record => [record?.location, record?.homeBase].filter(place => normalizeName(place));
    const left = places(a), right = places(b);
    return left.length > 0 && right.length > 0 && !left.some(place => right.some(other => placesOverlap(place, other)));
}
export function identityConflict(a, b, explicit = false) {
    const genderA = normalizeGender(a?.gender);
    const genderB = normalizeGender(b?.gender);
    if (genderA && genderB && genderA !== genderB) return true;
    if (explicit) return false;
    const wordsA = roleWords(a?.role);
    const wordsB = roleWords(b?.role);
    if (!wordsA.size || !wordsB.size) return false;
    const disjoint = ![...wordsA].some(word => wordsB.has(word) || [...wordsB].some(other => word.includes(other) || other.includes(word)));
    return disjoint && secondDifference(a, b);
}
