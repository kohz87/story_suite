// One safe own-property step into a value, and the forbidden keys it and writes refuse.

export const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

export function step(value, key) {
    if (key === undefined || key === null || FORBIDDEN.has(String(key))) return undefined;
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object' && typeof value !== 'string') return undefined;
    return Object.hasOwn(value, key) ? value[key] : undefined;
}
