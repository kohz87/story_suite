// Asks a query and answers undefined when nothing answers, for the validate parts.

export function asking(query, name, args) {
    try {
        return query(name, args);
    } catch {
        return undefined;
    }
}
