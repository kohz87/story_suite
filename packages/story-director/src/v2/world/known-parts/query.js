// Story Director v2, world: asks the other parts and modules a query through the host tools, with a fallback.

/** `query(name, args)` from the tools a host passes, or null. */
export const queryOf = tools => (typeof tools?.query === 'function' ? (name, args) => tools.query(name, args) : typeof tools === 'function' ? tools : null);

/** Asks a query; `fallback` when there is no query, it throws (no module answers it) or it answers undefined. */
export function tryQuery(query, name, args = {}, fallback = null) {
    if (typeof query !== 'function') return fallback;
    try {
        const value = query(name, args);
        return value === undefined ? fallback : value;
    } catch {
        return fallback;
    }
}
