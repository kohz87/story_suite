// Test-only: the two fights the note tests and the drafted golden tell, and the envelope of a played fight.

import { playBoard } from '../../../../src/v2/lean-rpg/combat/play.js';
import { envelopeOf } from '../../../../src/v2/lean-rpg/combat/envelope.js';
import { seeded } from './dice.helper.js';
import { withSkills } from './derived-skills.helper.js';

const hero = (label, build, stats, level = 12) => withSkills({ label, id: label, build, level, mastery: 3, stats: { str: 8, vit: 12, agi: 8, dex: 8, int: 8, wis: 8, cha: 5, ...stats } });
const rat = label => ({ id: label, label, tier: 'standard', level: 8, hp: 30, maxHp: 30, damage: 6, roll: 8 });
const wolf = (label, hp, damage) => ({ id: label, label, tier: 'standard', level: 8, hp, maxHp: hp, damage, roll: 8 });
export const turns = count => Array.from({ length: count }, () => ({}));

/** A quiet fight: two heroes against one wolf, won in a few exchanges. */
export const quiet = () => ({ party: [hero('Kira', 'Warrior', { str: 20, vit: 20 }), hero('Cy', 'Healer', { int: 14, wis: 14, vit: 20 })], foes: [wolf('Wolf', 30, 6)] });
/** A hard fight: one frail hero against three wolves, who hits to zero (a hero goes down). */
export const hard = () => ({ party: [hero('Ana', 'Warrior', { str: 14, vit: 4 }, 3)], foes: [wolf('Wolf 1', 40, 9), wolf('Wolf 2', 40, 9), wolf('Wolf 3', 40, 9)] });

/** A skirmish: an area attacker (Rin, Evasion stance), a healer with a Defence stance (Kira) and a hero with no skills (Bo, a plain attack) against three rats; the shapes the other fights lack. */
export const skirmish = () => ({ party: [hero('Bo', undefined, { agi: 16 }), hero('Rin', 'Skirmisher-area', { agi: 18 }), hero('Kira', 'Healer', { wis: 14, vit: 20 })], foes: [rat('Rat 1'), rat('Rat 2'), rat('Rat 3')] });
/** The skirmish's choices: Kira drops her stance in exchange 2 and heals Rin in exchange 3; stopped there, the fight is open. */
export const skirmishChoices = [{}, { Kira: { stance: false } }, { Kira: { kind: 'heal', target: 'Rin' } }];

/** Play `sheet` with `seed`: `count` exchanges, or a list of per-exchange choices (the automatic policy when omitted); the envelope as the host would store it. */
export function played(sheet, seed, count, extra = {}) {
    const record = playBoard(sheet, seeded({ seed, ...extra }), count === undefined ? undefined : Array.isArray(count) ? count : turns(count));
    return envelopeOf(record, { id: 'fight-1' });
}
