// The record test, text and path folding and deep freeze the public API parts share.

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const text = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
export const fold = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

export function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const item of Object.values(value)) deepFreeze(item);
    }
    return value;
}
