// Reads the enemy groups out of the Assist answer (JSON alone, in prose, or in a code fence).
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

/** The groups in an answer, from JSON alone or JSON inside prose or a code fence; null when no groups can be read. */
export function parsePrecheck(text) {
    const source = String(text ?? '');
    for (let at = 0; at < source.length; at += 1) {
        if (!'[{'.includes(source[at])) continue;
        const json = balanced(source, at);
        if (!json) continue;
        let value;
        try { value = JSON.parse(json); } catch { continue; }
        if (Array.isArray(value)) return value;
        if (isObject(value) && Array.isArray(value.groups)) return value.groups;
    }
    return null;
}
