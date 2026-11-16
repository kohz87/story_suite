// The key shape check and the non-negative integer check shared by the ledger parts.

const KEY_RE = /^v1:[A-Za-z0-9_-]{43}$/;

export const isFactKey = key => typeof key === 'string' && KEY_RE.test(key);
export const nonNegative = value => (Number.isInteger(value) && value >= 0 ? value : null);
