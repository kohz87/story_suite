// Chronicle queries' guarded call of another module's query.

export const toolsQuery = tools => (typeof tools?.query === 'function' ? (name, args) => tools.query(name, args) : typeof tools === 'function' ? tools : null);

export function ask(query, name, args) {
    if (typeof query !== 'function') return null;
    try {
        return query(name, args) ?? null;
    } catch {
        return null;
    }
}
