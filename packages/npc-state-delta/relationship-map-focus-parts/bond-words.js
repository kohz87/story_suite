// A bond's relation word and tone: the word from a relation text or tie tags, and the tone the word or the story's tags give.

import { plain } from '../relationship-map-core.js';
import { KNOWN_SOCIAL_RELATION_FAMILIES, socialRelationFamily } from '../social-relations.js';
import { tieTone } from '../dossier-ui-bond-tone.js';
import { FOCUS_TONES } from './focus-constants.js';

// Green: kin, partner, friendship and the ties of teaching or guardianship (ally is the mockup's word for a friend).
const GOOD_WORDS = new Set([
    'child', 'parent', 'sibling', 'partner', 'mentor', 'student', 'guardian', 'ward', 'friend', 'cousin',
    'aunt-uncle', 'niece-nephew', 'grandparent', 'grandchild', 'parent-in-law', 'child-in-law', 'sibling-in-law',
    'ally',
]);
// Red: open hostility.
const BAD_WORDS = new Set(['rival', 'enemy']);
// Gold: a debt or a duty owed one way.
const GOLD_WORDS = new Set(['owes', 'debt', 'duty']);

// Free relation text that is not a known family still gets a word when it names one of the above.
const WORD_HINTS = Object.freeze([
    [/\ballies\b|\bally\b/, 'ally'],
    [/\benem(?:y|ies)\b/, 'enemy'],
    [/\brivals?\b/, 'rival'],
    [/\bowes?\b|\bowing\b|\bowed\b/, 'owes'],
    [/\bdebts?\b/, 'debt'],
    [/\bduty\b|\bduties\b/, 'duty'],
]);

// The relation word under a tied person's name: the known family when there is one, else the first
// hint word in the text, else the first two words of the text (cut to 18 characters).
export function relationWord(relation = '') {
    const text = plain(relation).toLocaleLowerCase();
    if (!text) return '';
    const family = socialRelationFamily(text);
    if (KNOWN_SOCIAL_RELATION_FAMILIES.has(family)) return family;
    const hint = WORD_HINTS.find(([pattern]) => pattern.test(text));
    if (hint) return hint[1];
    return text.split(/\s+/).slice(0, 2).join(' ').slice(0, 18);
}

// The word a tie tag gives (the Ties section's rule: owes first, else the first tag), or '' without tags.
export const tagWord = tags => { const list = Array.isArray(tags) ? tags : []; return list.includes('owes') ? 'owes' : (list[0] || ''); };

// The local tone rule, keyed by the relation word. Anything not listed is grey.
export function localBondTone(word = '') {
    const key = plain(word).toLocaleLowerCase();
    if (BAD_WORDS.has(key)) return FOCUS_TONES.bad;
    if (GOLD_WORDS.has(key)) return FOCUS_TONES.gold;
    if (GOOD_WORDS.has(key)) return FOCUS_TONES.good;
    return FOCUS_TONES.grey;
}

// A bondTone(word, relation) passed in through options wins when it returns a known tone; otherwise
// the local rule decides. No bondTone helper exists in this repository yet, so callers pass none.
export function bondToneOf(word = '', relation = '', { bondTone, tags } = {}) {
    // A tie tag the story gave (ally, rival, owes) wins over the relation word's tone (dossier-ui-bond-tone.js).
    const tied = { hostile: FOCUS_TONES.bad, duty: FOCUS_TONES.gold, close: FOCUS_TONES.good }[tieTone(tags)];
    if (tied) return tied;
    if (typeof bondTone === 'function') {
        const tone = bondTone(word, relation);
        if (Object.values(FOCUS_TONES).includes(tone)) return tone;
    }
    return localBondTone(word);
}

