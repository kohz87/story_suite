// Plain-value helpers: the owner pattern, the plain-object test and a deep copy. Pure.

// The party, or an actor ID (`ac_` + 8 base36, as check.js's RECORD_ID).
export const OWNER_RE = /^(?:party|ac_[0-9a-z]{8})$/;

export const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const clone = value => JSON.parse(JSON.stringify(value));
