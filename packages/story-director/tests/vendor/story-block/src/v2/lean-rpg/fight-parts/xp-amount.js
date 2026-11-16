// Works out the XP one member earns from a won fight's groups.

import { FIGHT_XP } from '../names.js';

/** Foes are members, not groups; Down and dead party members still count unless they Left. */
export function outnumberedMultiplier(groups, partyCount) {
    const foes = groups.reduce((sum, group) => sum + group.count, 0);
    return Math.min(2, 1 + 0.5 * Math.max(0, foes - partyCount));
}

/** XP after the level-gap percentages and multiplier, rounded down before the applicable cap. */
export function memberXp(groups, level, bars = false, flat = false, multiplier = 1) {
    // A flat fight (`xp: 2` in its step): 15 for every foe, the level gap 10 % a level (no upper limit), at most 100.
    if (flat) return flatXp(groups, level, multiplier);
    // A marked fight (`bars: 2`): each group pays (15 + 2 per foe after the first) x max(1, ceil(level / 10)) x the level-gap percent, the same sum, cap and floor.
    if (bars) return markedXp(groups, level, multiplier);
    const percent = groups.reduce((total, group) => {
        const scale = Math.max(0, Math.min(FIGHT_XP.maxPercent, 100 + FIGHT_XP.gapPercent * (group.level - level)));
        return total + group.count * Math.max(1, Math.ceil(group.level / FIGHT_XP.perLevels)) * FIGHT_XP.perBand * scale;
    }, 0);
    const xp = Math.floor(percent * multiplier / 100);
    return xp > 0 ? Math.max(FIGHT_XP.min, Math.min(FIGHT_XP.max, xp)) : 0;
}

/** The XP of a flat fight (see memberXp): every foe pays 15 × (100 + 10 per level of gap) per cent, never below 0; the sum rounded down, then 0, or 1..100. */
function flatXp(groups, level, multiplier) {
    const percent = groups.reduce((total, group) => total + group.count * FIGHT_XP.flatBase * Math.max(0, 100 + FIGHT_XP.gapPercent * (group.level - level)), 0);
    const xp = Math.floor(percent * multiplier / 100);
    return xp > 0 ? Math.max(FIGHT_XP.min, Math.min(FIGHT_XP.flatMax, xp)) : 0;
}

/** The XP of a marked fight with no `xp` in its step (see memberXp): 0, or 1..60. */
function markedXp(groups, level, multiplier) {
    const percent = groups.reduce((total, group) => {
        const scale = Math.max(0, Math.min(FIGHT_XP.maxPercent, 100 + FIGHT_XP.gapPercent * (group.level - level)));
        return total + (FIGHT_XP.markedFirst + FIGHT_XP.markedMore * (group.count - 1)) * Math.max(1, Math.ceil(group.level / FIGHT_XP.perLevels)) * scale;
    }, 0);
    const xp = Math.floor(percent * multiplier / 100);
    return xp > 0 ? Math.max(FIGHT_XP.min, Math.min(FIGHT_XP.max, xp)) : 0;
}
