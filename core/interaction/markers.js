// Drops the reader-only marker lines (`[word]` on a line of their own) of the interaction kinds from prompt text.

const cache = new Map();
const escape = word => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

// One regex per word set: the same pattern and the same one-blank-line rule the `[battle]` marker has always had.
function patternOf(words) {
    const key = words.join('\u0000');
    let pattern = cache.get(key);
    if (!pattern) {
        pattern = {
            has: new RegExp(`\\[(?:${words.map(escape).join('|')})\\]`, 'i'),
            strip: new RegExp(`^[ \\t]*\\[(?:${words.map(escape).join('|')})\\][ \\t]*(?:\\r?\\n|$)(?:[ \\t]*\\r?\\n)?`, 'gim'),
        };
        if (cache.size > 16) cache.clear();
        cache.set(key, pattern);
    }
    return pattern;
}

/** `text` without the `[word]` marker lines of `words` (each with the one blank line after it); anything else is returned as it is. */
export function stripMarkers(text, words) {
    const list = [...new Set((Array.isArray(words) ? words : []).filter(word => typeof word === 'string' && word))].sort();
    if (!list.length || typeof text !== 'string') return text;
    const pattern = patternOf(list);
    return pattern.has.test(text) ? text.replace(pattern.strip, '') : text;
}
