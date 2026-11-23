// Where a member stands, read from the counters: level and stat points from xp and the counted purchases, health from the wound stage, and the stage a hurt adds.
import { levelFor } from '../rules/growth.js';
import { gainsAt } from '../rules/level-gains.js';
import { countedPurchases } from './purchases.js';

const whole = value => (Number.isFinite(value) ? Math.trunc(value) : 0);

/** The member's level: a companion's own, else the level their xp reaches. */
export function levelOf(member) {
    return member?.companion ? member.companion.level : levelFor(member?.xp).level;
}

/** The stat points left to spend: those the level has earned, less the purchases it pays for (never below 0). */
export function pointsOf(member) {
    const earned = gainsAt(1, levelOf(member)).points;
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
