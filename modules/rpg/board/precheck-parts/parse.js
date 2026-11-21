// Reads the enemy groups (and a horde's words) out of the Assist answer (JSON alone, in prose, or in a code fence).
import { isObject } from './shared-words.js';

function balanced(text, start) {
    const pairs = { '{': '}', '[': ']' };
    const stack = [pairs[text[start]]];
    let quoted = false, escaped = false;
    for (let at = start + 1; at < text.length; at += 1) {
        const char = text[at];
        if (quoted) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quoted = false;
            continue;
        }
        if (char === '"') { quoted = true; continue; }
        if (pairs[char]) { stack.push(pairs[char]); continue; }
        if (char !== stack.at(-1)) continue;
        stack.pop();
        if (!stack.length) return text.slice(start, at + 1);
    }
    return null;
}

// The answer's JSON: the first list, or object with a `groups` list, in the text (or the value itself when already parsed); null when there is none.
function answerOf(text) {
    if (Array.isArray(text)) return text;
    if (isObject(text)) return Array.isArray(text.groups) ? text : null;
    const source = String(text ?? '');
    for (let at = 0; at < source.length; at += 1) {
        if (!'[{'.includes(source[at])) continue;
        const json = balanced(source, at);
        if (!json) continue;
        let value;
        try { value = JSON.parse(json); } catch { continue; }
        if (Array.isArray(value) || (isObject(value) && Array.isArray(value.groups))) return value;
    }
    return null;
}

/** The groups in an answer, from JSON alone or JSON inside prose or a code fence; null when no groups can be read. */
export function parsePrecheck(text) {
    const value = answerOf(text);
    return Array.isArray(value) ? value : value?.groups ?? null;
}

/** The answer's `horde` words (an object beside `groups`, as the prompt asks), unchecked; null when it gives none. */
export function parseHorde(text) {
    const value = answerOf(text);
    return isObject(value) && isObject(value.horde) ? value.horde : null;
}
