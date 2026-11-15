// Story Director v2, tracker part (domain): the problem list's size limits and key order, shared by its writers and its validator.

export const PROBLEM_LIMIT = 50;

/** How many problems are kept; the newest PROBLEM_LIMIT are shown. */
export const PROBLEM_ROOM = 2 * PROBLEM_LIMIT;

export const PROBLEM_KEY = /^(\d+)\.(\d+)$/;

// [rev, number] of a problem key, for ordering.
const keyOrder = key => {
    const match = PROBLEM_KEY.exec(key);
    return match ? [Number(match[1]), Number(match[2])] : [-1, -1];
};
export const byKey = (a, b) => {
    const [x, y] = [keyOrder(a), keyOrder(b)];
    return x[0] - y[0] || x[1] - y[1] || (a < b ? -1 : a > b ? 1 : 0);
};
