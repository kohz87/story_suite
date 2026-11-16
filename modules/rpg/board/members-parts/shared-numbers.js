// Number helpers shared by the member and pack code: whole numbers, clamping, a held bar value, a value read from a Map or object.

export const num = value => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0);
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const held = (value, size) => clamp(num(value), 0, Math.max(0, num(size)));

export function valuesAt(values, slot) {
    if (values instanceof Map) return values.get(slot);
    return values?.[slot];
}
