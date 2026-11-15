// The mark limit, the on/off setting and reading or testing the marked reply keys.

export const MARK_LIMIT = 128;
export const memoryFactsOn = settings => settings?.memoryFacts !== false;

export function markedKeys(state) {
    const keys = state?.memoryFactMarks?.keys;
    return Array.isArray(keys) ? keys.filter(key => typeof key === 'string' && key) : [];
}

export function isMarked(state, key) {
    return typeof key === 'string' && key.length > 0 && markedKeys(state).includes(key);
}
