// Shared numeric clamping helper for map view calculations.

export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
