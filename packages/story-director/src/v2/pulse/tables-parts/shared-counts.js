// Tiny count and unit-range helpers shared by the pulse table parts.

export const count = value => (Number.isSafeInteger(value) && value > 0 ? value : 0);
export const unitOf = value => (Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0);
