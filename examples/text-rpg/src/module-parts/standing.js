// Where a member stands, read from the counters: level and stat points from xp and points spent, health from the wound stage, and the stage a hurt adds.
import { levelFor } from '../rules/growth.js';
import { gainsAt } from '../rules/level-gains.js';

const whole = value => (Number.isFinite(value) ? Math.trunc(value) : 0);

/** The member's level: a companion's own, else the level their xp reaches. */
export function levelOf(member) {
    return member?.companion ? member.companion.level : levelFor(member?.xp).level;
}

/** The stat points left to spend: those the level has earned, less those spent (never below 0). */
export function pointsOf(member) {
    return Math.max(0, gainsAt(1, levelOf(member)).points - Math.max(0, whole(member?.spent)));
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
