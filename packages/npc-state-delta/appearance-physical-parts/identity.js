/* Detecting the phrase that says what the NPC is, and updates that give a new identity. A part of appearance-physical.js (same owner, moved without change). */
import { CHANGEABLE_PRESENTATION, CONCEALED_MENTION } from './trait-patterns.js';
import { presentationSegments } from './segments.js';
import { appearanceText } from '../appearance-text.js';

// The leading phrase that says what the NPC is ("A silver dragon", "A wiry old man", "Spirit form")
// rather than what she wears: an article- or form-led piece that is not clothing, gear or condition.
// A look, gaze or pose ("A tired smile", "A weary look") is passing presentation, and a sentence
// about part of the body ("The scales are dusted with ash") describes that part, not what she is.
export const NOT_IDENTITY = /\b(?:smiles?|smiling|smirks?|grins?|grinning|frowns?|frowning|scowls?|glares?|glances?|gaze|stares?|looks?|expression|blush(?:es|ing)?|tears?|pose|posture|stance|demeanou?r|air|is|are|was|were|seems?|appears?)\b/i;
export function identityPhrase(value) {
    const first = presentationSegments(value)[0] || '';
    if (!first || CHANGEABLE_PRESENTATION.test(first) || CONCEALED_MENTION.test(first) || NOT_IDENTITY.test(first)) return '';
    return /^(?:an?|the)\s+\S/i.test(first) || /\bform\b/i.test(first) ? first : '';
}
// An update that says she has become something else ("Now a towering ogre", "She has become …",
// "turned into a wolf") describes a new identity even without an article-led opening.
export const BECOMES_IDENTITY = /(?:^\s*(?:(?:she|he|they|it)\s+(?:is\s+)?)?now\s+an?\s+\S|\b(?:has|have|had)\s+become\s+an?\s+\S|\b(?:becomes?|became|turn(?:s|ed)?\s+into|transform(?:s|ed)?\s+into|shift(?:s|ed)?\s+into)\s+an?\s+\S)/i;
export function describesIdentity(value) {
    return Boolean(identityPhrase(value)) || BECOMES_IDENTITY.test(appearanceText(value));
}
