// Foe numbers by tier (Combat Rules v1): HP, damage and roll bonus from level and tier.
// HP rounds down, damage rounds half up; a missing or unknown tier reads as standard.

import { TIERS, V1 } from './numbers.js';

const level = value => Math.min(V1.level.max, Math.max(V1.level.min, Math.floor(Number(value)) || V1.level.min));

/** One foe: { tier, level, hp, damage, roll, tempoRoll }. The roll bonus is added to a d20. */
export function foeStats({ level: lv, tier } = {}) {
    const name = Object.hasOwn(TIERS, tier) ? tier : 'standard', { mult, roll } = TIERS[name], f = V1.foe, l = level(lv);
    const base = f.rollBase + Math.floor(l / f.rollLevelDiv);
    return {
        tier: name, level: l,
        hp: Math.floor((f.hpBase + Math.floor(l / f.hpLevelDiv)) * mult),
        damage: Math.floor((f.damageBase + Math.floor(l / f.damageLevelDiv)) * mult + 0.5),
        roll: base + roll,
        tempoRoll: base + f.tempoTierTimes * roll,
    };
}

/** A foe group { name, count, level, tier } as numbered members, each at full HP. */
export function foeMembers({ name = 'Foe', count = 1, level: lv, tier } = {}) {
    const total = Math.max(1, Math.floor(Number(count)) || 1), stats = foeStats({ level: lv, tier });
    return Array.from({ length: total }, (_, i) => ({ name: String(name), n: i + 1, ...stats, maxHp: stats.hp }));
}
