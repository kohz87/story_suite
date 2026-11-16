// Sentence splitting, regex escaping, quote normalization, and negation prefix check.

export const NOT_BEFORE = /\b(?:not|never|won't|wont|don't|dont|didn't|didnt|wouldn't|can't|cannot|refuse to)\s+(?:\w+\s+){0,2}$/i;

export const sentencesOf = text => String(text ?? '').split(/(?<=[.!?…\]])\s+|\n+/).filter(Boolean);

export function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeQuotes(text) {
    return text.replace(/[’‘]/g, '\'');
}
