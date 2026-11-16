// The story check's roll, Combat Rules v1 (the fight's own numbers, read from combat/numbers.js): d20 + stat÷2 + level÷4, and half the mastery
// (rounded up) when the skill is a utility one. A natural 1 misses; a tie with the number wins; a natural 20 or a lead of the decisive margin is decisive.
// No "success at a cost". Pure.

import { TYPE_STATS } from '../formula-parts/constants.js';
import { masteryTerm, rollOutcome } from '../combat/rolls.js';
import { RANKS, V1 } from '../combat/numbers.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(value)) || lo));
const level = member => clamp(member?.level, V1.level.min, V1.level.max);
const statOf = (member, key) => {
    const raw = member?.stats?.[key];
    return clamp(raw === null || raw === '' || !Number.isFinite(Number(raw)) ? V1.stat.start : raw, V1.stat.min, V1.stat.max);
};

/** The mastery a skill's rank (0..6) gives: Novice 1 … Legend 7. */
export const masteryOf = rank => RANKS[clamp(rank, 0, RANKS.length - 1)].mastery;

/** The stat a check uses: the skill's own (one with none: the old fitting stat) or the plain stat named. */
export const checkStat = (skill, stat) => (skill ? String(skill.stat ?? '').trim().toLowerCase() || TYPE_STATS.check.main : stat);

/** The bonus a member adds to the die: stat÷2 + level÷4 (+ half mastery for a utility skill). `skill` null: a plain stat check. */
export function checkBonus(member, skill, stat) {
    const base = Math.floor(statOf(member, checkStat(skill, stat)) / V1.roll.physicalDiv) + Math.floor(level(member) / V1.roll.levelDiv);
    return base + (skill && String(skill.type).toLowerCase() === 'utility' ? masteryTerm(masteryOf(skill.rank)) : 0);
}

/** The result of one check's die: { outcome: 'success' | 'fail', decisive }. */
export function checkOutcome(die, bonus, dc) {
    const raw = rollOutcome(die, bonus, dc);
    return { outcome: raw === 'miss' ? 'fail' : 'success', decisive: raw === 'decisive' };
}
