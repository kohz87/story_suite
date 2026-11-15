// Story Director v2, names: small readers of the values the host and its queries give.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const ask = (query, name, args = {}) => {
    try { return (typeof query === 'function' ? query(name, args) : null) ?? null; } catch { return null; }
};
export const queryOf = source => (typeof source?.query === 'function' ? (name, args) => source.query(name, args) : null);
export const namesOf = list => (Array.isArray(list) ? list : []).map(entry => (typeof entry === 'string' ? entry : entry?.name)).filter(name => typeof name === 'string');
