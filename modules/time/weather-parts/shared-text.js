// Story Director v2, part time: the text folding and guarded-query helpers the weather parts share.

export const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export const fold = value => text(value).normalize('NFKC').toLowerCase();
export const cutPoints = (value, max) => Array.from(value).slice(0, max).join('');

export function tryQuery(query, name, args) {
    if (typeof query !== 'function') return null;
    try { return query(name, args) ?? null; } catch { return null; }
}
