// The party's levels: the cap a new foe's level may reach, the average, and the list read from a sheet.
import { FOE_LEVEL, levelOfClass } from './level-basics.js';

/**
 * The most a NEW foe's level may be: the party's highest level + 20 (`band`), at most 99 (the party with no one is level 1, so 21). `band` 10 (`oldBand`) is the
 * cap a reply captured before the +20 rule keeps on a Re-read (it has no `foeCap` mark; act.js). It is a ceiling only: nothing raises a level to it.
 */
export const foeLevelCap = (levels, band = FOE_LEVEL.band) => Math.min(FOE_LEVEL.max, Math.max(FOE_LEVEL.min, ...(levels ?? []).filter(value => Number.isInteger(value) && value >= 1)) + band);

/** The party's average level, rounded to the nearest whole level (1 with no one): `levels` is a list of numbers, anything else in it is passed over. */
export function averageLevel(levels) {
    const list = (levels ?? []).filter(value => Number.isFinite(value) && value >= 1);
    return list.length ? Math.max(FOE_LEVEL.min, Math.min(FOE_LEVEL.max, Math.round(list.reduce((sum, value) => sum + value, 0) / list.length))) : FOE_LEVEL.min;
}

/** The levels of a sheet's party (readSheet): each member's `level`, else, for a block of the earlier rules, the level their Soul Class stands for. Left or dead are not counted. */
export const partyLevels = sheet => (sheet?.characters ?? []).filter(entry => entry?.alive !== false)
    .map(entry => (Number.isInteger(entry.level) ? entry.level : levelOfClass(entry.soul))).filter(value => Number.isInteger(value));
