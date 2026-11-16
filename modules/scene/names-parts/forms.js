// Singular/plural lookup keys for an item name (the head word changes number). Pure.

import { aliasKey } from './clean.js';

// One word's other number: "ropes" → "rope", "berries" → "berry", "box" → "boxes".
function wordForms(word) {
    const forms = new Set([word]);
    if (/[^aeiou]ies$/.test(word)) forms.add(`${word.slice(0, -3)}y`);
    if (/(?:s|x|z|ch|sh|o)es$/.test(word)) forms.add(word.slice(0, -2));
    if (/[^s]s$/.test(word)) forms.add(word.slice(0, -1));
    if (/[^aeiou]y$/.test(word)) forms.add(`${word.slice(0, -1)}ies`);
    else if (/(?:s|x|z|ch|sh)$/.test(word)) forms.add(`${word}es`);
    else forms.add(`${word}s`);
    return forms;
}

/**
 * Lookup keys for a name, the exact key first: the head word changes number
 * ("Flasks of Oil" → "flask of oil", "Healing Potion" → "healing potions").
 */
export function nameForms(name) {
    const key = aliasKey(name);
    if (!key) return [];
    const of = key.indexOf(' of ');
    const head = of > 0 ? key.slice(0, of) : key;
    const tail = of > 0 ? key.slice(of) : '';
    const cut = head.lastIndexOf(' ');
    const before = head.slice(0, cut + 1);
    const word = head.slice(cut + 1);
    return [...new Set([key, ...[...wordForms(word)].map(form => `${before}${form}${tail}`)])];
}
