// Small text helpers shared by the pre-check's world readers: cut by code points, split into words, ask a query safely.

export const cut = (value, max) => [...String(value ?? '').replace(/\s+/gu, ' ').trim()].slice(0, max).join('').trim();
export const wordsOf = text => String(text ?? '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
export const ask = (query, name, args) => { try { return typeof query === 'function' ? query(name, args) : null; } catch { return null; } };
