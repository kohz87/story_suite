// What a fight award raised: the new level and the points it brought, for the reply's changes line "Astra reached Lv 3 (+1 point)".

const whole = value => Number.isSafeInteger(value);

/** The block's `level` and `points` before and after an award → { to, points? } when the level rose, else null. */
export function raisedLevel(before, after) {
    if (!whole(before?.level) || !whole(after?.level) || after.level <= before.level) return null;
    const points = whole(before.points) && whole(after.points) ? after.points - before.points : 0;
    return { to: after.level, ...(points > 0 ? { points } : {}) };
}
