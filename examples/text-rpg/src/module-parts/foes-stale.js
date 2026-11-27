// When a group of foes was last touched, and when it counts as left behind: a day of story time with no reply touching it.

const DAY = 1440;

/** True when the story clock `now` is a day or more past the minute the group was last touched (`group.at`); with either unknown it is not. */
export const stale = (group, now) => Number.isInteger(now) && Number.isInteger(group.at) && now - group.at >= DAY;

/** Marks a group touched by this reply (set up, reinforced or hit): the dice step's clock, and the reply's sid. */
export function touch(ctx, slice, group) {
    const clock = slice.dice?.[ctx.reply?.sid]?.clock;
    group.at = Number.isInteger(clock) ? clock : null;
    group.sid = typeof ctx.reply?.sid === 'string' ? ctx.reply.sid : null;
}
