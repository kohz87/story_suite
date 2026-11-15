/* NPC State Delta identity: normalizing the visual apparent age into a stable ~N estimate. */
import { cleanText } from '../core-text.js';
import { AGE_NUMBER_WORD_RE, isUnknownAgePlaceholder, normalizedAgeText, parseEnglishAgeNumber } from './shared-age-text.js';

function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value ?? '')) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function stableAgeInRange(min, max, seed) {
    const low = Math.max(0, Math.round(Number(min) || 0));
    const high = Math.max(low, Math.round(Number(max) || low));
    const span = high - low + 1;
    return low + (stableHash(seed) % span);
}

const AGE_DECADES = Object.freeze({ twenties: 20, thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80, nineties: 90 });

function decadeWordRange(value) {
    const decade = AGE_DECADES[normalizedAgeText(value)];
    return Number.isFinite(decade) ? [decade, decade + 9] : null;
}

/**
 * Visual/apparent age for portrait prompting. Descriptor/range evidence becomes a stable ~N.
 * The estimate is seeded by NPC identity + evidence so repeated scans do not reroll it.
 */
export function normalizeApparentAge(value, seed = '') {
    const cleaned = cleanText(value, 80);
    if (!cleaned || isUnknownAgePlaceholder(cleaned)) return '';
    let lower = normalizedAgeText(cleaned);

    // Normalize the common prose wrappers first so the stored field remains compact.
    lower = lower
        .replace(/^(?:looks?|appears?)\s+(?:to\s+be\s+)?/i, '')
        .replace(/^apparent(?:ly)?(?:\s+age)?\s*[:=]?\s*/i, '')
        .replace(/^(?:about|around|approx(?:\.|imately)?)\s+/i, '')
        .replace(/^in\s+(?:his|her|their)\s+/i, '')
        .trim();

    let match = lower.match(/^~?(\d{1,3})(?:\s*(?:years?|yrs?)\s*(?:old)?)?$/i);
    if (match) {
        const number = Number(match[1]);
        if (Number.isFinite(number) && number >= 0 && number <= 200) return `~${Math.round(number)}`;
    }

    match = lower.match(new RegExp(`^(${AGE_NUMBER_WORD_RE})(?:\\s*(?:years?|yrs?)\\s*(?:old)?)?$`, 'i'));
    if (match) {
        const number = parseEnglishAgeNumber(match[1]);
        if (Number.isFinite(number)) return `~${number}`;
    }

    match = lower.match(/^(\d{1,3})\s*(?:-|to)\s*(\d{1,3})(?:\s*(?:years?|yrs?)\s*(?:old)?)?$/i);
    if (match) {
        const a = Number(match[1]);
        const b = Number(match[2]);
        if ([a, b].every(Number.isFinite) && a >= 0 && b >= 0 && a <= 200 && b <= 200) {
            const min = Math.min(a, b);
            const max = Math.max(a, b);
            return `~${stableAgeInRange(min, max, `${seed}|${lower}`)}`;
        }
    }

    match = lower.match(/^(early|mid|middle|late)\s+(\d{2,3})s$/i);
    if (match) {
        const decade = Number(match[2]);
        if (Number.isFinite(decade) && decade >= 10 && decade <= 190) {
            const band = match[1] === 'early' ? [decade, decade + 3]
                : (match[1] === 'late' ? [decade + 7, decade + 9] : [decade + 4, decade + 6]);
            return `~${stableAgeInRange(band[0], band[1], `${seed}|${lower}`)}`;
        }
    }

    match = lower.match(/^(early|mid|middle|late)\s+(twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)$/i);
    if (match) {
        const range = decadeWordRange(match[2]);
        if (range) {
            const decade = range[0];
            const band = match[1] === 'early' ? [decade, decade + 3]
                : (match[1] === 'late' ? [decade + 7, decade + 9] : [decade + 4, decade + 6]);
            return `~${stableAgeInRange(band[0], band[1], `${seed}|${lower}`)}`;
        }
    }

    const decadeRange = decadeWordRange(lower);
    if (decadeRange) return `~${stableAgeInRange(decadeRange[0], decadeRange[1], `${seed}|${lower}`)}`;

    const qualitativeRanges = [
        [/\bnewborn\b|\binfant\b/i, 0, 2],
        [/\btoddler\b/i, 2, 4],
        [/\bpre[- ]?teen\b/i, 10, 12],
        [/\badolescent\b/i, 13, 17],
        [/\bteen(?:ager)?\b/i, 13, 19],
        [/\byoung adult\b/i, 18, 29],
        [/\byoung\b/i, 18, 29],
        [/\bmiddle[- ]aged\b/i, 40, 59],
        [/\bolder adult\b/i, 55, 74],
        [/\belderly\b|\bsenior\b/i, 65, 85],
        [/\bchild\b/i, 6, 11],
        [/\badult\b/i, 25, 44],
    ];
    for (const [pattern, min, max] of qualitativeRanges) {
        if (pattern.test(lower)) return `~${stableAgeInRange(min, max, `${seed}|${lower}`)}`;
    }

    // Apparent Age is a compact visual estimate, not a prose field. Unknown wording is
    // intentionally rejected rather than allowed to drift into "around twenties"-style text.
    return '';
}
