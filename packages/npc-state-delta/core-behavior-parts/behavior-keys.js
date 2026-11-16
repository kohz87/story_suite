/* NPC State Delta behavior-lever keys, labels, categories and families. */
import { cleanText, normalizeName } from '../core-text.js';
import { DURABLE_PROFILE_LIMITS } from '../core-relationship.js';

export function behaviorProfileKey(value) {
    const text = cleanText(value, DURABLE_PROFILE_LIMITS.behaviorProfile);
    if (!text) return '';
    const match = text.match(/^([\p{L}][\p{L}\p{N} _\-/]{1,36})\s*:/u);
    return normalizeName(match ? match[1] : text);
}

// One category map serves the lever check, refine matching, ordering and the identity/morality
// safety gates. Labels may combine categories ("Care/Warmth"); each part is matched on its own.
const BEHAVIOR_LEVER_CATEGORY_SYNONYMS = Object.freeze([
    ['disposition', /^(?:disposition|temperament|kindness|empathy|morality|moral compass|social baseline|outlook)$/],
    ['cruelty', /^(?:cruelty|mercy|harm|ruthlessness|brutality)$/],
    ['independence', /^(?:independence|agency|autonomy|self reliance|boundaries|obedience|compliance|deference)$/],
    ['care', /^(?:care|caring|care style|affection|warmth|warm|compassion|protectiveness|support style|nurturing|nurturing style)$/],
    ['expressiveness', /^(?:expressiveness|expression|emotional display|emotional expression|emotionality)$/],
    ['conflict', /^(?:conflict|conflict style|assertiveness|anger|temper|composure|restraint|confrontation|aggression|self control)$/],
    ['threat', /^(?:threat|threat sensitivity|threat response|anxiety|risk sensitivity|risk tolerance|risk taking|uncertainty sensitivity|caution|wariness|vigilance|suspicion|trust)$/],
    ['analytical', /^(?:analytical|analytical style|analysis|reasoning|reasoning style|decision style|decision making|thinking style|evidence style|problem solving|judgment|judgement|planning|curiosity)$/],
    ['presentation', /^(?:social presentation|presentation|formality|etiquette|public bearing|social restraint|social style|sociability|demeanor|demeanour|manners)$/],
    ['loyalty', /^(?:loyalty|allegiance|faithfulness|fidelity)$/],
    ['drive', /^(?:drive|ambition|motivation|determination|perseverance)$/],
    ['honesty', /^(?:honesty|candor|candour|truthfulness|sincerity|integrity|deception|deceit|secrecy)$/],
]);

export function behaviorLeverLabel(value) {
    const text = cleanText(value, DURABLE_PROFILE_LIMITS.behaviorProfile);
    const colon = text.indexOf(':');
    return colon > 0 && colon <= 40 ? text.slice(0, colon).trim() : '';
}

export function behaviorProfileFamily(value) {
    const key = behaviorProfileKey(value);
    if (!key) return '';
    if (/^(?:disposition|kindness|empathy|morality|social baseline)$/.test(key)) return 'disposition';
    if (/cruelty|mercy|harm/.test(key)) return 'cruelty';
    if (/independence|agency|boundar|autonom|obedien|compliance|compliant|submission|submissive|deference/.test(key)) return 'independence';
    if (/^(?:care|affection|care style|warmth|warm|support style|nurturing style)$/.test(key)) return 'care';
    if (/express|emotional display/.test(key)) return 'expressiveness';
    if (/conflict|anger|composure|restraint|assertiv/.test(key)) return 'conflict';
    if (/^(?:anxiety|threat sensitivity|threat response|risk sensitivity|uncertainty sensitivity)$/.test(key)) return 'threat';
    if (/^(?:analytical style|analysis|reasoning|reasoning style|decision style|thinking style|evidence style|problem solving)$/.test(key)) return 'analytical';
    if (/^(?:social presentation|presentation|formality|etiquette|public bearing|social restraint)$/.test(key)) return 'presentation';
    const label = behaviorLeverLabel(value);
    if (!label) return '';
    for (const part of label.split(/[/&,+]|\band\b/i).map(normalizeName).filter(Boolean)) {
        const match = BEHAVIOR_LEVER_CATEGORY_SYNONYMS.find(([, pattern]) => pattern.test(part));
        if (match) return match[0];
    }
    return '';
}

export function behaviorProfileBody(value) {
    const text = cleanText(value, DURABLE_PROFILE_LIMITS.behaviorProfile);
    const index = text.indexOf(':');
    return index >= 0 ? cleanText(text.slice(index + 1), DURABLE_PROFILE_LIMITS.behaviorProfile) : text;
}
