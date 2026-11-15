// Small value tests the chip and strip renderers share.
export const numberOr = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
export const hasValue = value => value !== undefined && value !== null && value !== '';
