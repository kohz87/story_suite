// How a story note, an item and a group of owners read in the tail.

import { trimText } from '../../scene/names.js';
import { condMark } from '../gear.js';
import { itemText } from '../validate.js';

// With gear on, an item below Good shows its condition word after the name: "Cane Sword (worn)".
export const condText = (item, gear) => { const word = gear && item.cond !== undefined ? condMark(item.cond) : ''; return word ? ` (${word})` : ''; };

// Where a thing was found is on the screens, not in the prompt (prompt diet): "found at the drain", "picked up in the cellar" is left out of a note,
// what else it says stays ("tarred hemp, found at the drain" → "tarred hemp"). Only "found" or "picked up" with a place word is left out; who it was taken
// from, a debt, a clue, a duel, "found on the body of Captain Rell" all stay. The stored note is not touched.
const PROVENANCE = /^(?:found|picked up)\s+(?:at|in|near|under|behind|inside|beside)\b/iu;
export function promptNote(note) {
    const text = String(note ?? '');
    const parts = text.split(/\s*[;,]\s*/);
    const kept = parts.filter(part => !PROVENANCE.test(part.trim()));
    return kept.length === parts.length ? text : kept.join(', ');
}

export function itemPhrase(item, gear = false) {
    const said = item.note ? promptNote(item.note) : '';
    const note = said ? ` (${trimText(said, 40)})` : '';
    return `${itemText(item.name, item.qty)}${condText(item, gear)}${note}`;
}

export function owners(items) {
    return [...new Set(items.map(item => item.owner))];
}
