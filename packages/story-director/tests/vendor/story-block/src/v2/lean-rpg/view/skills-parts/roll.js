// What a skill shows from the live sheet: its mastery bar and the roll it makes.

import { LEVEL, FORMULA, RANK_NAMES } from '../../names.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { classTerm, hasLevels, isStandard } from '../../rules.js';
import { levelBonus, statPart } from '../../formula.js';
import { effOf } from '../gear-stats.js';
import { RANK_TONES } from './shared-ranks.js';

const K = RPG_STRINGS.skills;

/** What the mastery bar shows for a skill: 4 cells, rank + 1 of them lit and the next one filling with practice (Master: all four). */
export function masteryOf(skill) {
    const master = skill.rank >= RANK_NAMES.length - 1;
    const value = master ? RANK_NAMES.length : skill.rank + 1 + Math.min(100, Math.max(0, skill.practice)) / 100;
    const next = RANK_NAMES[skill.rank + 1];
    return { value, max: RANK_NAMES.length, tone: RANK_TONES[skill.rank] ?? 'neutral',
        text: master ? K.meterMaster : fill(K.meter, { rank: skill.rankName, practice: skill.practice, next }) };
}

/**
 * The roll a skill makes from the live sheet: d20 + floor(stat / 2) + rank + floor(level / divisor) (before levels, classWeight x Soul Class; Standard: the pair of the stat and half of DEX, halved, in place of floor(stat / 2)). → { total, stat, value, half, rank, bonus } with
 * `stat` the stat's label (null for a skill that names none: the story then picks the stat, so only the rank and level are known).
 */
export function rollOf(skill, character, rules = FORMULA) {
    const entry = character.stats.find(stat => stat.key === skill.stat) ?? null;
    // (numbers with a divisor are the levelled ones: floor(level / divisor), a block made before levels at the level its class stands for; numbers without keep the
    // Soul Class term; a Level block under numbers with none reads the default divisor)
    const bonus = character.levelled && !hasLevels(rules) ? levelBonus(character.level, LEVEL.divisor) : classTerm(rules, character).classBonus;
    if (isStandard(rules) && entry) {
        // The Standard formula: the skill's stat in the main slot with half of DEX (a Mana skill is magic, a Stamina skill physical), halved once.
        const stats = Object.fromEntries(character.stats.map(stat => [stat.key, effOf(stat)]));
        const part = statPart(skill.uses === 'mana' ? 'magic' : 'physical', stats, { skillStat: skill.stat });
        const second = character.stats.find(stat => stat.key === part.second);
        return { total: part.value + skill.rank + bonus, stat: entry.label, value: entry.value, half: part.value, rank: skill.rank, bonus, second: second?.label ?? part.second.toUpperCase(), secondValue: second ? effOf(second) : 0 };
    }
    const half = entry ? Math.floor(effOf(entry) / 2) : 0;
    return { total: half + skill.rank + bonus, stat: entry?.label ?? null, value: entry ? effOf(entry) : 0, half, rank: skill.rank, bonus };
}
