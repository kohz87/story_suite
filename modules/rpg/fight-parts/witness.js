// Gathers the numbers a fight step depends on, for the replay guard.

import { isObject, slotsOf, whole } from './shared-values.js';

// The numbers a character's rise moves, and the reply's scratch keeps (`level` is the Level field of a block made from 2.17.0 on, `soul` the Soul Class of an earlier one).

// The party members the fight pays: not Left (readSheet leaves those out), not dead.
export const paidOf = sheet => sheet.characters.filter(character => character.alive !== false);

// The reply's scratch (data-modules/part.js finish): `perReply[<sid>/<swipeKey>].xpFrom` = { [module]: { xp, soul, points } }, what a character had before the
// first story line of this reply that wrote XP. → the numbers that are whole, by block.
const pairKey = source => `${source?.sid}/${source?.swipeKey}`;
export function fromOf(domain, source) {
    const out = {};
    const kept = domain?.perReply?.[pairKey(source)]?.xpFrom;
    if (!isObject(kept)) return out;
    for (const [module, rises] of Object.entries(kept)) {
        if (isObject(rises) && whole(rises.xp) && (whole(rises.soul) || whole(rises.level))) out[module] = { xp: rises.xp, ...(whole(rises.soul) ? { soul: rises.soul } : {}), ...(whole(rises.level) ? { level: rises.level } : {}), ...(whole(rises.points) ? { points: rises.points } : {}) };
    }
    return out;
}

/** The numbers the step depends on (the replay guard asks them again): the fight's groups and every filled group's Health, each paid member's rises, and what the reply's XP lines started from. */
export function fightWitness(sheet, domain, source, decision) {
    const given = Array.isArray(decision?.groups) ? decision.groups : null;
    // (`level` joins an entry only when the sheet has one of its own (a Foes block of the Levels rules), so the witness of an older Foes block, and the guard hash of its receipt, are what they were)
    const foes = sheet.foes.filter(foe => foe.filled).map(({ slot, name, count, class: soul, hurt, level, levelled }) => ({ slot, name, count, class: soul, hurt, ...(levelled && whole(level) ? { level } : {}) }));
    return { foes, was: slotsOf(decision?.was), ...(given ? { groups: given } : {}), ...(decision?.outnumbered === 1 ? { partyCount: sheet.characters.length } : {}), from: fromOf(domain, source),
        members: paidOf(sheet).map(character => ({ module: character.module, who: character.who, xp: character.xp, ...(character.soul !== undefined ? { soul: character.soul } : {}), ...(character.levelled ? { level: character.level } : {}), points: character.points })) };
}
