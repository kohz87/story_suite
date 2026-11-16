// The whole-number readers the Standard formula parts share (a value as an integer, a stat as an integer).

export const num = value => (Number.isFinite(value) ? Math.trunc(value) : 0);
export const statOf = (stats, key) => num(stats?.[key]);
