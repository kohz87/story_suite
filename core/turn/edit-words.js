// Story Suite v2: the words of a reply's prose that a capture reads (perf PB8; docs/dev/edit-prose-only.md). An edit that adds or
// removes one of them is not prose-only and takes the full path: a real-world day or month name (the calendar-names check), any
// cast person's name or alias (packs, NPC State, the cast store), or a "#N" reference (quoted evidence).
// `changedWords(before, after)` is the multiset difference of the two texts' words; `touchesCaptureWords(...)` checks it against the lists.

const DAYS_MONTHS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WORD = /#\d+|[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

const wordsOf = text => {
    const counts = new Map();
    for (const word of String(text ?? '').toLowerCase().match(WORD) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
    return counts;
};

/** The words (lowercase) that occur a different number of times in the two texts. */
export function changedWords(before, after) {
    const was = wordsOf(before), now = wordsOf(after), out = [];
    for (const [word, n] of now) if (was.get(word) !== n) out.push(word);
    for (const [word, n] of was) if (!now.has(word) && n) out.push(word);
    return out;
}

/** Whether the edit adds or removes a day or month name, a "#N", or a word of any name in `names()` (called only when some word changed). */
export function touchesCaptureWords(before, after, names) {
    const changed = changedWords(before, after);
    if (!changed.length) return false;
    if (changed.some(word => word.startsWith('#') || DAYS_MONTHS.includes(word))) return true;
    let own;
    try { own = names(); } catch { return true; }
    if (!Array.isArray(own)) return true;
    const known = new Set();
    for (const name of own) for (const word of typeof name === 'string' ? name.toLowerCase().match(WORD) ?? [] : []) known.add(word);
    return changed.some(word => known.has(word) || known.has(word.replace(/['’]s$/, '')));
}
