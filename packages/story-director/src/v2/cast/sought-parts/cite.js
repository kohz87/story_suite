// Tokenizing telling words and verifying cited phrases against story text.

import { cutPoints, flat } from '../domain.js';

const STOP = new Set(['that', 'this', 'with', 'from', 'they', 'them', 'their', 'there', 'then', 'what', 'when', 'where', 'which', 'while', 'about', 'after', 'before', 'have', 'been', 'were', 'will', 'would', 'could', 'should', 'into', 'over', 'under', 'again', 'still', 'only', 'some', 'such', 'than', 'very', 'your', 'ever', 'also']);
/** The telling words of a text (four letters or more, lower case, no filler). */
export const words = text => (String(text ?? '').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(word => !STOP.has(word));

const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWords = phrase => new RegExp(`(?<![\\p{L}\\p{N}_])${phrase.split(/\s+/).map(escapeRe).join('\\s+')}(?![\\p{L}\\p{N}_])`, 'iu');

export const MAX_CITED = 80;

/** A cited phrase as one plain line (quotes and markup off its ends), or '' when it is too short to mean anything. */
export function citedClean(value) {
    const text = flat(String(value ?? '').replace(/<[^>]*>/g, '')).replace(/^[\s"'“”‘’`*_[(]+|[\s"'“”‘’`*_\])]+$/g, '').trim();
    return (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 3 ? cutPoints(text, MAX_CITED) : '';
}

/** Whether `phrase` stands in one of `texts` as whole words, any case (a made-up phrase, or a part of a longer word, does not). */
export function citedIn(phrase, texts) {
    const clean = citedClean(phrase);
    if (!clean || clean.endsWith('…')) return false;
    const pattern = wholeWords(clean);
    return (Array.isArray(texts) ? texts : [texts]).some(text => pattern.test(flat(String(text ?? ''))));
}
