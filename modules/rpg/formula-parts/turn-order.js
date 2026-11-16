// Turn order for one fight: the initiative bonuses, the quick-start rule and the order itself.
import { STANDARD_NUMBERS } from './constants.js';
import { num, statOf } from './shared-num.js';

/** Turn order: a character adds classBonus + AGI/2; a foe adds 2 × class. (The die is the caller's.) */
export const initiativeBonus = (stats, classBonus) => num(classBonus) + Math.floor(statOf(stats, 'agi') / 2);
export const foeInitiativeBonus = foeClass => 2 * Math.max(1, num(foeClass));

/** One opening action against a foe whose turn-order total is `margin` or more below the character's. */
export const quickStart = (characterTotal, foeTotal, margin = STANDARD_NUMBERS.quickStartMargin) => num(characterTotal) - num(foeTotal) >= num(margin);

/**
 * Turn order for one fight: highest total first; ties go to the higher AGI, then to the party.
 * `entries`: [{ id, total, agi, party: boolean }]. Returns the ids in order.
 */
export function turnOrder(entries) {
    return [...entries]
        .sort((a, b) => num(b.total) - num(a.total) || num(b.agi) - num(a.agi) || Number(Boolean(b.party)) - Number(Boolean(a.party)))
        .map(entry => entry.id);
}
