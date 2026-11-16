// Tiny type and number guards shared by the pulse parts.

export const isInt = value => Number.isSafeInteger(value);
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const unit = value => (Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0);
export const frac = value => value - Math.floor(value);
