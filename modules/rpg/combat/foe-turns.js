// Which foes attack in a foe phase: every standing foe once, a lone elite/boss/apex once per standing hero, capped at
// twice the standing party. Targets rotate evenly across the living heroes in the exchange (v1 decision 48).

import { V1 } from './numbers.js';

const standing = list => Array.isArray(list) ? list.filter(actor => Number(actor?.hp) > 0) : [];

/** The ordered attackers for the foes' phase. Each entry is the foe that makes one attack. */
export function foeAttacks(party, foes) {
    const heroes = standing(party), alive = standing(foes);
    if (!heroes.length || !alive.length) return [];
    const only = alive.length === 1 ? alive[0] : null;
    const lone = only && V1.foe.loneTiers.includes(String(only.tier ?? V1.foe.defaultTier).toLowerCase());
    const attackers = lone ? Array.from({ length: heroes.length }, () => only) : [...alive];
    return attackers.slice(0, heroes.length * V1.foe.attackCapTimes);
}
