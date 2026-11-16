// Validates a model sentence against the allowed productions of a payload.
import { MAX_SENTENCE } from './limits.js';
import { productions } from './productions.js';

// A model sentence is accepted only when, after NFC and nothing else, it equals one allowed production. Raw newlines/controls, markup,
// oversize or a second sentence fail before any whitespace normalisation (they can never equal a production).
export function validPhrasing(kind, payload, sentence) {
    if (typeof sentence !== 'string') return null;
    if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029<>]/.test(sentence)) return null;
    const text = sentence.normalize('NFC');
    if ([...text].length > MAX_SENTENCE) return null;
    return productions(kind, payload).includes(text) ? text : null;
}
