// Story Director v2, part **cast**: safe query helper for cast rules.

/** Asks a query; `fallback` when there is none, it throws or it answers undefined. */
export function ask(query, name, args = {}, fallback = null) {
    if (typeof query !== 'function') return fallback;
    try {
        const value = query(name, args);
        return value === undefined ? fallback : value;
    } catch {
        return fallback;
    }
}
