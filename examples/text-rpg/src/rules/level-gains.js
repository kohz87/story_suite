// Stat points and skill slots earned between two levels.

function levelValue(value) {
    return Math.min(99, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)));
}

/** The stat points a character at `level` has to spend before any purchase: one a level above 1, less the `granted` ones creation already placed (never below 0). */
export const earnedAt = (level, granted) => Math.max(0, gainsAt(1, level).points - (Number.isInteger(granted) ? granted : 0));

/** Stat points (one a level) and skill slots (one every tenth level) in the levels crossed after `fromLevel`. */
export function gainsAt(fromLevel, toLevel) {
    const from = levelValue(fromLevel);
    const to = levelValue(toLevel);
    if (to <= from) return { points: 0, slots: 0 };
    return {
        points: to - from,
        slots: Math.floor(to / 10) - Math.floor(from / 10),
    };
}
