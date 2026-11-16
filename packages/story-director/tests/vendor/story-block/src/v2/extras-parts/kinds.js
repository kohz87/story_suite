// Choices and Inner chatter: the two display kinds as Story Block declares them, with their feature ids and grammar lines.

import { CORE_FEATURE } from '../features.js';
import { CHATTER_MAX, CHOICE_CHARS, CHOICE_MAX } from './limits.js';
import { CHATTER_CHARS, chatterCap } from './chatter-limits.js';
import { readChatter, readChoice } from './readers.js';

export const CHOICES_FEATURE = CORE_FEATURE.choices;
export const CHATTER_FEATURE = CORE_FEATURE.chatter;

/** The `~ chatter` grammar line for a cap of `cap` lines a reply. */
export function chatterGrammar(cap = CHATTER_MAX) {
    return `~ chatter Name: …a short unspoken thought, one line for each NPC in the scene who has something on their mind, up to ${chatterCap(cap)} (only NPCs in the scene, at most ${CHATTER_CHARS} characters; nobody hears it, so the story never reacts to it)`;
}

// Their kinds as Story Block declares them (src/v2/domains/index.js CORE_KINDS): one grammar line each,
// shown only while the feature is on. No names, counts or dice: the static part stays byte-identical.
export const EXTRA_KINDS = Object.freeze({
    choice: Object.freeze({
        grammar: `? choice Climb the wall (2 to ${CHOICE_MAX} lines at the end: short next moves the reader's character could make, at most ${CHOICE_CHARS} characters each; the reader picks, code never acts on them)`,
        feature: CHOICES_FEATURE,
        display: Object.freeze({ perReply: CHOICE_MAX, noun: 'choices', read: readChoice }),
    }),
    chatter: Object.freeze({
        grammar: chatterGrammar(CHATTER_MAX),
        feature: CHATTER_FEATURE,
        display: Object.freeze({ perReply: CHATTER_MAX, noun: 'chatter lines', read: readChatter }),
    }),
});
