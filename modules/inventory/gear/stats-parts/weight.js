// What one unit of an item weighs in load: its own `weight` (a pack's, or the reader's Edit), else a default by slot or kind. Coins weigh nothing.

import { GEAR } from './constants.js';
import { words, singular } from './shared-words.js';

const baseOf = slot => (typeof slot === 'string' ? slot.trim().replace(/-\d+$/, '') : '');
const whole = value => Number.isSafeInteger(value) && value >= 0 && value <= GEAR.weight.max;

/** A pack item's explicit `weight` (a whole number 0…GEAR.weight.max), only for a `pack.` def; else null (a story line never sets one). */
export const packWeight = (id, value) => (typeof id === 'string' && id.startsWith('pack.') && whole(value) ? value : null);

// (`singular` only drops a final s, so "passes" and "tallies" are read here too)
const isPaper = word => [singular(word), word.replace(/sses$/, 'ss'), word.replace(/ies$/, 'y')].some(form => GEAR.paperwork.includes(form));
// The item's head noun: the name's last word, leaving out anything in brackets and from " of " on ("Ledger of Debts" is a ledger, a "Map Case" a case).
const headNoun = name => words(String(name ?? '').replace(/\([^)]*\)/g, ' ').split(/\sof\s/i)[0]).at(-1) ?? '';
const paperwork = def => (def?.kind === 'goods' || def?.kind === 'material') && isPaper(headNoun(def.name));

/** The default weight of an item with no `weight` of its own: equipment by its slot (weapon 3, body 5, off-hand 4, head 2, cloak 2, feet 2, accessory 0), a quest item 0, paperwork (goods or material named as a paper, pass, warrant, ...) 0, anything else 1. */
export function defaultWeight(def) {
    if (def?.kind === 'equipment') return GEAR.weight.bySlot[baseOf(def.slot)] ?? GEAR.weight.other;
    if (paperwork(def)) return 0;
    return GEAR.weight.byKind[def?.kind] ?? GEAR.weight.other;
}

/** What one unit of `def` weighs: 0 for money; else its own `weight`, else its default. */
export function weightFor(def) {
    if (def?.kind === 'money') return 0;
    return whole(def?.weight) ? def.weight : defaultWeight(def);
}
