// Story Director v2, part screens: how a view query asks another query through the host's tools, with a fallback.

/** A `query(name, args)` from the tools a host passes (MODULES §F3), or null. */
export function queryFrom(tools) {
    if (typeof tools?.query === 'function') return tools.query;
    if (typeof tools === 'function') return tools;
    return null;
}

export function ask(query, name, args, fallback) {
    if (!query) return fallback;
    try {
        const value = query(name, args);
        return value === undefined ? fallback : value;
    } catch {
        return fallback;
    }
}
