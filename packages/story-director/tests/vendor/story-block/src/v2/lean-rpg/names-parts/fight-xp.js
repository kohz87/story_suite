// Names: the XP a won fight pays and the battle marker.

/**
 * XP for a won fight (fight.js), worked out for each party member who has not Left, group by group from the member's level against the group's:
 * base = count × max(1, ceil(foeLevel / `perLevels`)) × `perBand`, times clamp(100 + `gapPercent` × (foeLevel − memberLevel), 0, `maxPercent`) per cent. The groups
 * are added (whole per cents, so no rounding error) and rounded down; a total above 0 is held to `min` .. `max`, a total of 0 gives nothing.
 * Level 5 against six level 5 crawlers: 6 × 1 × 2 = 12.
 * A fight captured with `xp: 2` (flat XP, 11 Nov) pays every foe `flatBase` × the same per cent (no band, no count bonus), added, rounded down, 1..`flatMax`.
 */
export const FIGHT_XP = Object.freeze({ markedFirst: 15, markedMore: 2, flatBase: 15, flatMax: 100, perBand: 2, perLevels: 10, gapPercent: 10, maxPercent: 200, min: 1, max: 60 });

/** The line the narrator writes where the fight is told (the battle log is drawn there). */
export const BATTLE_MARKER = '[battle]';
