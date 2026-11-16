// Whether a won fight earns a legendary find: the level gap and the check against the party's highest level.


/** How many levels above the party's highest a foe group must stand for a win to earn a legendary find. */
export const GAP = 10;

/**
 * Whether this roll won a fight against a foe group at least 10 levels above the party's highest (`legend` in the result): what the narrator's legendary
 * item lines wait for (`story.legendaryEarned`). Only a roll of the Levels rules (`levelled`) has levels to compare; the fight must have ended `won`.
 */
export function earnedLegend(dice, sheet, levelled) {
    if (!levelled || dice.stop !== 'won') return false;
    const party = Math.max(0, ...(sheet?.characters ?? []).map(character => character.level ?? 0));
    const lines = [...(dice.opening ?? []), ...dice.rounds.flatMap(round => round.lines)];
    const foes = Math.max(0, ...lines.filter(line => line.foe).map(line => line.aoe && Number.isFinite(line.aoeLevel) ? line.aoeLevel : line.foe.classValue ?? 0));
    return party > 0 && foes >= party + GAP;
}
