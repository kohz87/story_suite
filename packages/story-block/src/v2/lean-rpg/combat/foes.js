// Foe numbers by tier (Combat Rules v1): HP, damage and roll bonus from level and tier.
// HP rounds down, damage rounds half up; a missing or unknown tier reads as the default tier; tier names match case-insensitively. A group holds at most V1.foe.groupMax members.

import { TIERS, V1 } from './numbers.js';

const level = value => Math.min(V1.level.max, Math.max(V1.level.min, Math.floor(Number(value)) || V1.level.min));

/** One foe: { tier, level, hp, damage, roll }. The roll bonus is added to a d20; the one foe roll serves attack, defence and tempo. */
export function foeStats({ level: lv, tier } = {}) {
    const key = typeof tier === 'string' ? tier.toLowerCase() : '', f = V1.foe;
    const name = Object.hasOwn(TIERS, key) ? key : f.defaultTier, { mult, roll } = TIERS[name], l = level(lv);
    return {
        tier: name, level: l,
        hp: Math.floor((f.hpBase + Math.floor(l / f.hpLevelDiv)) * mult),
        damage: Math.floor((f.damageBase + Math.floor(l / f.damageLevelDiv)) * mult + f.damageRound),
        roll: f.rollBase + Math.floor(l / f.rollLevelDiv) + roll,
    };
}

/** A foe group { name, count, level, tier } as numbered members, each at full HP. */
export function foeMembers({ name = 'Foe', count = 1, level: lv, tier } = {}) {
    const total = Math.min(V1.foe.groupMax, Math.max(1, Math.floor(Number(count)) || 1)), stats = foeStats({ level: lv, tier });
    return Array.from({ length: total }, (_, i) => ({ name: String(name), n: i + 1, ...stats, maxHp: stats.hp }));
}
