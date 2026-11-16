// Matching reader text and planner citations against a person's kind words.

import { words } from './cite.js';
import { kindWords } from './kind.js';

// Words of ordinary prose that a calling or a lead happens to use: they never open the gate on their own.
const COMMON = new Set(['long', 'watch', 'iron', 'card', 'candidate', 'chain', 'cell', 'runner', 'sharp', 'guard', 'captain', 'knife', 'night', 'dark', 'grey', 'gray', 'pale', 'calm', 'warm', 'cold', 'tired', 'proud', 'gentle', 'stranger', 'keeper', 'people', 'village', 'frontier', 'city', 'great', 'noble', 'self', 'taught', 'spell', 'grammar', 'free', 'freed', 'broken', 'holds', 'roaming', 'little', 'small', 'tall', 'old', 'young', 'aging', 'dead', 'hair', 'quiet', 'loud', 'sworn', 'twenty', 'lost', 'thousand', 'sails', 'church', 'eternal', 'flame', 'eared', 'barge', 'barges', 'vargate', 'flower']);
/** The words a person is sought by: a telling word of their calling and of the lead of their `about`, common prose words out. */
export function gateWords(entry) {
    const { calling, lead } = kindWords(entry);
    return [...new Set(words(`${calling} ${lead}`).filter(word => !COMMON.has(word)))];
}
const hasWord = (have, word) => have.has(word) || have.has(`${word}s`) || have.has(`${word}es`) || (word.endsWith('s') && have.has(word.slice(0, -1)));

/** Whether the reader's `text` may be asking for this person's kind: a word of `gateWords` is in it as a whole word (a plural counts). */
export function kindTouches(entry, text) {
    const have = new Set(words(Array.isArray(text) ? text.join('\n') : text));
    return gateWords(entry).some(word => hasWord(have, word));
}

/** Whether cited words hold a telling word of the person's kind (their calling or the lead of their `about`, 4+ letters, no stop word). */
export function citesKind(entry, cited) {
    const { calling, lead } = kindWords(entry);
    const have = new Set(words(cited));
    return words(`${calling} ${lead}`).some(word => hasWord(have, word));
}
