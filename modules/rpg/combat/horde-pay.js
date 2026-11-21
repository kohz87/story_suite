// What a won horde pays one hero, pure (owner, 21 Nov): each wave is paid as a fight of its own (rewards.js winXp, the setup's XP rule: 15 a foe × the tier's factor,
// held to 1..100 a wave), on the foes that fell only (a foe still standing when the gate held or the leader fell pays nothing), summed with no cap over the waves.
// Wave 0 is the opening front (ids `<slot>.<n>`); an arrival `<slot>.<wave>.<n>` is paid with its wave.
import { TIERS } from './numbers.js';
import { winXp } from './rewards.js';

const parts = foe => String(foe?.id ?? '').split('.');

/** The fallen foes of a horde record as waves of groups: `[[{ count, level, tier }]]`, by wave then group (`<slot>` or `<slot>.<wave>`), in order. */
export function fallenWaves(record) {
    const waves = new Map();
    for (const foe of record?.foes ?? []) {
        if (Number(foe.hp) > 0) continue;
        const id = parts(foe), wave = id.length > 2 ? Number(id[1]) : 0, key = id.slice(0, -1).join('.');
        const groups = waves.get(wave) ?? new Map(), kept = groups.get(key);
        if (kept) kept.count += 1;
        else groups.set(key, { count: 1, level: Number(foe.level) || 1, tier: Object.hasOwn(TIERS, foe.tier) ? foe.tier : 'standard' });
        waves.set(wave, groups);
    }
    return [...waves.keys()].sort((a, b) => a - b).map(wave => [...waves.get(wave).values()]);
}

/** One hero's base XP for a won horde at `level` (before the XP rate): the sum of each wave's winXp. */
export const hordeXp = (record, level, rule) => fallenWaves(record).reduce((sum, groups) => sum + winXp(groups, level, rule), 0);
