// Small checks and the gated-meter list shared by the gate parts.

const REPLY_MAX = 120;
export const isInt = value => Number.isInteger(value);
export const isReply = value => (typeof value === 'string' ? value.length > 0 && value.length <= REPLY_MAX : isInt(value) && value >= 0);
export const METERS_GATED = Object.freeze(['trust', 'affection', 'tension']);
