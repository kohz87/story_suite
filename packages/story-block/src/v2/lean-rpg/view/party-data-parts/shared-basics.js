// Small readers shared by the party-data parts: record check, whole number, folded name, trimmed text.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const whole = (value, fallback = 0) => (Number.isSafeInteger(value) ? value : fallback);
export const fold = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export const textOf = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
