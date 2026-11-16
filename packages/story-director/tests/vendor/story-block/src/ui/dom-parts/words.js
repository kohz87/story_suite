// Words for counts and names: pluralising, countable nouns and a block's display name.

export function plural(count, word = 'item') {
    return `${count} ${count === 1 ? word : `${word}s`}`;
}

/**
 * Countable noun for a column label: "Item" -> "item"/"items", "NPC" -> "NPC"/"NPCs".
 * Only a plain capitalised word is lower-cased, so acronyms keep their spelling.
 */
export function noun(label, count = 2) {
    let word = String(label ?? '').trim() || 'item';
    if (/^[A-Z][a-z]+$/.test(word)) word = word.toLowerCase();
    return count === 1 || /s$/i.test(word) ? word : `${word}s`;
}

export function unitWord(label, count) {
    return `${count} ${noun(label, count)}`;
}

export function blockName(def) {
    return String(def?.name ?? '').trim() || 'Block';
}
