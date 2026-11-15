// The small pure value helpers: the plain-object test, JSON byte size, deepFreeze and a state's rev.

export const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const utf8 = new TextEncoder();
export const jsonBytes = value => utf8.encode(JSON.stringify(value)).length;

export function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const item of Object.values(value)) deepFreeze(item);
    }
    return value;
}

export const revOf = state => (Number.isInteger(state?.meta?.rev) ? state.meta.rev : 0);
