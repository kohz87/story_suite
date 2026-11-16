// Story Director v2, part screens: the tiny text helpers the view queries share (flatten text, test for a record, cut by length).

export const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const cut = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
