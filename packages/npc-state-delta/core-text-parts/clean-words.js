/* Word-boundary cleaners for model-facing dossier context. */
import { cleanList } from './clean.js';

// (cleanup step 12, I-7) Model-facing dossier context at the stored cap. A value longer than that
// (a locked field keeps more) is cut at a word boundary, never mid-word.
export function cleanWords(value, max) {
    if (typeof value !== 'string') return '';
    const text = value.replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max + 1).lastIndexOf(' ');
    return text.slice(0, cut > 0 ? cut : max).trimEnd();
}

export function cleanWordsList(value, maxItems, maxChars) {
    return cleanList(Array.isArray(value) ? value.map(item => cleanWords(item, maxChars)) : value, maxItems, maxChars);
}
