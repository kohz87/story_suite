// Looks up a Character or a foe slot on a read sheet from a phrase, and finds a character's best stat.
import { STATS } from '../names.js';
import { fold, matchName } from './match.js';

const FOE_NUMBER = /^(?:foe|slot|#)?\s*(\d{1,2})$/i;

/** The character a phrase names (by `who`), or null. */
export const matchCharacter = (sheet, phrase) => matchName(sheet?.characters ?? [], phrase, entry => entry.who, { either: true });

/** The filled foe slot a phrase names (its name, or "foe2" / "slot 2" / "2"), or null. */
export function matchFoe(sheet, phrase) {
    const slots = (sheet?.foes ?? []).filter(foe => foe.filled);
    const number = FOE_NUMBER.exec(String(phrase ?? '').trim());
    if (number) return slots.find(foe => foe.slot === Number(number[1])) ?? null;
    return matchName(slots, phrase, foe => foe.name, { either: true });
}

/** The character `who` names (exact, folded), or null. */
export const characterOf = (sheet, who) => sheet?.characters?.find(entry => entry.key === fold(who)) ?? null;

/** The stat `character` is best at (the first on a tie), or null when the sheet holds none of the seven. */
export function strongestStat(character) {
    let best = null;
    for (const stat of STATS) {
        const value = character?.stats?.[stat];
        if (Number.isInteger(value) && (best === null || value > character.stats[best])) best = stat;
    }
    return best;
}
