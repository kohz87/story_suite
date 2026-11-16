/* NPC State Delta identity: specificity of a stored age and normalizing a chronological age. */
import { cleanText } from '../core-text.js';
import { AGE_NUMBER_WORD_RE, isUnknownAgePlaceholder, normalizedAgeText, parseEnglishAgeNumber } from './shared-age-text.js';

export function ageSpecificity(value) {
    const age = String(value ?? '').trim();
    if (/^\d{1,3}$/.test(age)) return 3;
    if (/^~\d{1,3}$/.test(age)) return 2;
    return age ? 1 : 0;
}

function hasQualitativeAgeCue(value) {
    const lower = normalizedAgeText(value);
    return /\b(newborn|infant|toddler|child|pre[- ]?teen|adolescent|teen(?:ager)?|young adult|young|middle[- ]aged|older adult|elderly|senior|adult)\b/i.test(lower)
        || /^(?:looks?|appears?|apparent(?:ly)?)/i.test(lower)
        || /^(?:(?:about|around|approx(?:\.|imately)?)\s+)?(?:early|mid|middle|late)\s+(?:\d{2,3}s|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)$/i.test(lower)
        || /^(?:(?:about|around|approx(?:\.|imately)?)\s+)?(?:twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)$/i.test(lower)
        || /^\d{1,3}\s*(?:-|to)\s*\d{1,3}$/i.test(lower);
}

/**
 * Chronological age. This field is for actual story age only, never visual-age adjectives.
 * Exact numbers are normalized; otherwise grounded chronological wording is preserved.
 */
export function normalizeAge(value) {
    const cleaned = cleanText(value, 80);
    if (!cleaned || isUnknownAgePlaceholder(cleaned)) return '';
    const lower = normalizedAgeText(cleaned);
    let match = lower.match(/^(?:age\s*[:=]?\s*)?(\d{1,3})(?:\s*(?:years?|yrs?)\s*(?:old)?)?$/i);
    if (match) {
        const number = Number(match[1]);
        if (Number.isFinite(number) && number >= 0 && number <= 999) return String(Math.round(number));
    }
    const wordMatch = lower.match(new RegExp(`^(?:age\\s*[:=]?\\s*)?(${AGE_NUMBER_WORD_RE})(?:\\s*(?:years?|yrs?)\\s*(?:old)?)?$`, 'i'));
    if (wordMatch) {
        const number = parseEnglishAgeNumber(wordMatch[1]);
        if (Number.isFinite(number)) return String(number);
    }
    // A qualitative visual cue belongs in apparentAge, not chronological age.
    if (hasQualitativeAgeCue(lower)) return '';
    return cleaned;
}
