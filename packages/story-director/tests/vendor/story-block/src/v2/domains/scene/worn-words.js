// The words for what {{user}} has equipped, each with its wear word: "oilskin coat (torn), shortsword". Pure.

import { condMark } from '../gear.js';
import { listItems } from '../inventory/queries.js';

// Clothes first, then what is carried in the hands.
const ORDER = Object.freeze(['body', 'cloak', 'head', 'feet', 'accessory-1', 'accessory-2', 'weapon', 'off-hand']);

/** The party's own wearer (the reader's character) holds the owner id `party`. Body, cloak, head, feet and accessories, then weapon and off-hand; a piece below Good carries its wear word. */
export function wornWords(state, owner = 'party') {
    const worn = listItems(state?.domains?.inventory, owner).filter(item => typeof item.equipped === 'string');
    const order = item => { const at = ORDER.indexOf(item.equipped); return at < 0 ? ORDER.length : at; };
    return worn.sort((a, b) => order(a) - order(b))
        .map(item => { const word = item.cond !== undefined ? condMark(item.cond) : ''; return `${item.name}${word ? ` (${word})` : ''}`; })
        .join(', ');
}
