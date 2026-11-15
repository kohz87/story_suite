// The small text and number readers, the query guard and the text limit every part of the game header shares.

export const TEXT_MAX = 120;

export const textOf = value => (typeof value === 'string' ? value.trim() : '');
export const count = value => (Number.isFinite(Number(value)) ? Number(value) : null);

export function safeQuery(query, name, args) {
    if (typeof query !== 'function') return null;
    try {
        return query(name, args) ?? null;
    } catch {
        return null;
    }
}
