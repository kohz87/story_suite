// Pack format 4, the game pack's RPG section: the fields it may hold and the pull tuning (§5.3 of the pack format 4 design).

// Format 3's fields (skillSets, formula, numbers, ranks, levelCap, playerRank) and `pull`.
export const GAME_RPG_FIELDS = Object.freeze(['skillSets', 'formula', 'numbers', 'ranks', 'levelCap', 'playerRank', 'pull']);
// `rpg.pull: { abilities?: 1-6, stance?: true|false }`: how many of a person's abilities become sheet skills, and whether a stance skill is added.
export const RPG_PULL_FIELDS = Object.freeze(['abilities', 'stance']);
export const RPG_PULL_LIMITS = Object.freeze({ min: 1, max: 6 });
