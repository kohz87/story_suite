// Stat points and skill slots earned between two levels.

function levelValue(value) {
    return Math.min(99, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)));
}

/** Stat points and multiples-of-three skill slots in the levels crossed after `fromLevel`. */
export function gainsAt(fromLevel, toLevel) {
    const from = levelValue(fromLevel);
    const to = levelValue(toLevel);
    if (to <= from) return { points: 0, slots: 0 };
    return {
        points: to - from,
        slots: Math.floor(to / 3) - Math.floor(from / 3),
    };
}
