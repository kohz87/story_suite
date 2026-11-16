/* NPC State Delta shared development content tokens: reason/source text reduced to comparable non-time tokens. */

import { durableRefinementTokens } from '../core-relationship.js';

const DEVELOPMENT_TIME_TOKENS = new Set([
    'time', 'day', 'week', 'month', 'year', 'decade', 'season', 'spring', 'summer', 'autumn', 'fall', 'winter', 'later', 'pass', 'elapse', 'next', 'during', 'after', 'over', 'throughout', 'across', 'through', 'into', 'past', 'previous', 'last', 'within', 'for', 'in',
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'couple', 'several', 'many', 'few',
]);

const DEVELOPMENT_CONTENT_ALIASES = new Map([
    ['school', 'learn'], ['study', 'learn'], ['education', 'learn'], ['academic', 'learn'], ['academics', 'learn'],
    ['train', 'practice'], ['practic', 'practice'], ['practis', 'practice'], ['lesson', 'practice'], ['coach', 'practice'], ['mentor', 'practice'],
    ['develop', 'development'], ['progress', 'development'], ['improv', 'development'],
]);

export function developmentContentTokens(value) {
    return [...new Set(durableRefinementTokens(value))]
        .filter(token => !DEVELOPMENT_TIME_TOKENS.has(token) && !/^\d+$/.test(token))
        .map(token => DEVELOPMENT_CONTENT_ALIASES.get(token) || token);
}
