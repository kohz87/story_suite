// Where a member stands, read from the counters: level and stat points from xp, the points creation granted and the counted purchases, health from the wound stage, and the stage a hurt adds.
import { levelFor } from '../rules/growth.js';
import { LEVEL } from '../rules/levels.js';
import { earnedAt } from '../rules/level-gains.js';
import { countedPurchases } from './purchases.js';

const whole = value => (Number.isFinite(value) ? Math.trunc(value) : 0);

/** The member's level: the level their xp reaches; a companion's is the level they joined at plus a level for every 100 xp earned with the party since. */
export function levelOf(member) {
    if (!member?.companion) return levelFor(member?.xp).level;
    return Math.min(LEVEL.max, member.companion.level + Math.floor(Math.max(0, whole(member.xp)) / LEVEL.xpPerLevel));
}

/** The stat points left to spend: those the level has earned, less the purchases it pays for (never below 0). A companion has no stat sheet, so none. */
export function pointsOf(member) {
    if (member?.companion) return 0;
    const earned = earnedAt(levelOf(member), member?.granted);
    return Math.max(0, earned - countedPurchases(member, earned).reduce((sum, item) => sum + item.n, 0));
}

/** The wound stage after a failed roll adds `stages`: never past Badly wounded (4) from one line; only `~ health` sets Down. */
export function woundsAfter(member, stages) {
    const now = woundsOf(member);
    return now + Math.min(Math.max(0, whole(stages)), Math.max(0, 4 - now));
}

/** The wound stage, 0 (Unhurt) to 4 (Badly wounded) from the counter, clamped (a replay can push it out of range); 5 (Down) only when `~ health` marked the member down. */
export function woundsOf(member) {
    return member?.down === true ? 5 : Math.min(4, Math.max(0, whole(member?.wounds)));
}
