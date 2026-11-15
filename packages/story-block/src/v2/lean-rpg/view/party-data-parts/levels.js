// Levels as text: a stored level, "Lv 14 · Guild F", and the XP line.

import { LEVEL } from '../../names.js';
import { levelLabel, playerRankValue } from '../../levels.js';
import { RPG_STRINGS, fill } from '../../strings.js';

/** A level from a stored value: a whole number 1 to 99 (`fallback` when it is not one). */
export const levelOf = (value, fallback = 1) => (Number.isSafeInteger(value) ? Math.min(LEVEL.max, Math.max(1, value)) : fallback);

/** "Lv 14 · Guild F" for a party member (the pack's player rank), "Rank F · Lv 7" for a foe or a member of a story with no player-rank source, else "Lv 14". */
export function levelText(level, { ranks = [], playerRank = null, state = null, subject = null, foe = false } = {}) {
    if (foe || !playerRank) return levelLabel(level, ranks);
    return levelLabel(level, ranks, { playerRank, value: playerRankValue(state, playerRank) });
}

/** "24 / 100 to Lv 15", or "100 / 100 · level cap" at the cap (the XP holds at 100 there). */
export const xpLine = character => (character.level >= character.cap ? fill(RPG_STRINGS.party.xpCap, { xp: character.xp }) : fill(RPG_STRINGS.party.xpText, { xp: character.xp, next: character.level + 1 }));
