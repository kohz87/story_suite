// The draft's points: the pool to place (10, one more for each starting level above 1, or a saved character's own unspent points), the points still to place, and how far each stat may move.
import { STAT_KEYS } from '../words/stats.js';
import { levelOf, startOf } from './limits.js';
import { RULES } from './rules.js';

const int = value => (Number.isFinite(value) ? Math.trunc(value) : 0);

/** The points a starting level adds to place (one a level above 1; none for a saved character, whose stats already hold what its level bought). */
export const extraOf = draft => (draft?.from ? 0 : levelOf(draft) - 1);

/** The points a draft starts with to place: 10 and the level's, or the unspent points of a saved character. */
export const poolOf = draft => (draft.from ? draft.from.points : RULES.points + extraOf(draft));

/** The points still to place: the pool less what the stats rose above where they started (below 0 when over; a stat lowered gives a point back). */
export const pointsLeft = draft => poolOf(draft) - STAT_KEYS.reduce((sum, key) => sum + int(draft.stats[key]) - startOf(draft, key), 0);

/** How low and how high a stat may be set: 5 to 10 at creation (that much higher with each level's point, to 30), and never off the value a saved character came with (a stat saved above 10 stays, up to 15). */
export function statBounds(draft, stat) {
  const base = draft?.from?.stats?.[stat];
  return Number.isInteger(base) ? [Math.min(RULES.min, base), Math.max(RULES.max, base)] : [RULES.min, Math.min(30, RULES.max + extraOf(draft))];
}
