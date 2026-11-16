// Small helpers the thread-write parts share: a deep copy and a failure result.

export const copy = value => structuredClone(value);
export const failure = (code, message) => ({ ok: false, code, message });
