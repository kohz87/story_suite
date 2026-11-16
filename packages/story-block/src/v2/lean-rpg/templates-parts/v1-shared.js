// What the Combat Rules v1 block definitions (Character, Skills, Foes) share: the seven stats with WIS, the largest each bar can be, and the
// stage word a numeric bar is set by. The numbers come from combat/numbers.js and combat/bars.js, never typed twice here.
import { STATS_V1 } from '../names.js';
import { V1, TIERS } from '../combat/numbers.js';
import { barsOf } from '../combat/bars.js';


const statsAt = value => Object.fromEntries(STATS_V1.map(key => [key, value]));
/** What a new character's bars hold (every stat at the start value, level 1), and the most each can hold (every stat at its maximum, level 99). */
export { STATS_V1 };
export const BAR_START_V1 = Object.freeze(barsOf(statsAt(V1.stat.start), V1.level.min));
export const BAR_MAX_V1 = Object.freeze(barsOf(statsAt(V1.stat.max), V1.level.max));

/** The foe tiers the Foes block offers, weakest first. */
export const TIER_NAMES = Object.freeze(Object.keys(TIERS));
