// Taste words: citation-free cleaning and cutting, the taste identity key and the content words of a text.
import { clean, slug } from '../npc-meters-config.js';
import { stripMessageCitations } from '../../core-text.js';
import { TASTE_LIMITS } from './shared-limits.js';

const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'i', 'in', 'is', 'it', 'its', 'my', 'of', 'on', 'or',
    'our', 'she', 'he', 'they', 'the', 'their', 'this', 'that', 'to', 'was', 'we', 'were', 'with', 'you', 'your', 'his', 'her',
]);

// A taste's words never carry the scanner's message citations ("[m2]"). New words are written clean (addTaste) and every display
// read is clean (readTastes), but the stored leaf is never reshaped: the write path reads with { cite: false }, which keeps each old
// row exactly as stored, so a leaf valid before stays valid (tastesOk) and replay and Re-read keep old rows byte-identical.
export const tidy = (value, max) => clean(stripMessageCitations(clean(value, Infinity)), max);
// Cut only newly written or displayed words. An unbroken word longer than the limit contributes no fragment.
export function tasteWords(value, max) {
    const chars = [...tidy(value, Infinity)];
    if (chars.length <= max) return chars.join('');
    const head = chars.slice(0, max - 1).join('');
    return `${(/\s/u.test(chars[max - 1]) ? head : head.replace(/\S+$/u, '')).trimEnd()}…`;
}

/** A taste's identity: its words joined by "-", so "Burnt  Sugar" and "burnt sugar" are one taste. '' when nothing is left. */
export const tasteKey = item => slug(clean(item, TASTE_LIMITS.item), TASTE_LIMITS.item);

/** Lowercase letter and number words of a text, stop words dropped. Unicode letters count, so Cyrillic and Greek words match too. */
export function contentWords(text) {
    return (clean(text, Infinity).normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter(word => !STOP_WORDS.has(word));
}
