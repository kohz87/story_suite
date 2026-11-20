// The stats a v1 hero rolls with: the sheet's stat + what the worn pieces give (the number the Party card shows), held to the stat's top. Pure, apart from the questions put to `query`.
import { actorIdOf } from '../roster.js';
import { V1 } from '../combat/numbers.js';

/** `{ <hero key>: { str…cha: +n } }` for the v1 Characters whose worn pieces give something (`query('inventory.gear', { owner })`; the first v1 Character also holds the party's shared bag, as soak does). */
export function gearStatBonus(query, sheet) {
    const out = {};
    sheet.characters.filter(character => character.v1 === true).forEach((character, at) => {
        const sum = {};
        for (const owner of [actorIdOf(character.module), ...(at === 0 ? ['party'] : [])]) {
            for (const [stat, n] of Object.entries(query('inventory.gear', { owner })?.statBonus ?? {})) if (Number.isSafeInteger(n) && n > 0) sum[stat.toLowerCase()] = (sum[stat.toLowerCase()] ?? 0) + n;
        }
        if (Object.keys(sum).length) out[character.key] = sum;
    });
    return out;
}

/** The sheet with each v1 Character's stats at stat + worn gear (held to the top); the sheet itself when no piece gives anything or the answer fails. */
export function sheetWithGear(sheet, query) {
    let bonus;
    try { bonus = gearStatBonus(query, sheet); } catch { return sheet; }
    if (!Object.keys(bonus).length) return sheet;
    return { ...sheet, characters: sheet.characters.map(character => {
        const add = bonus[character.key];
        if (!add) return character;
        const stats = { ...character.stats };
        for (const [stat, n] of Object.entries(add)) if (Number.isFinite(stats[stat])) stats[stat] = Math.min(V1.stat.max, stats[stat] + n);
        return { ...character, stats };
    }) };
}
