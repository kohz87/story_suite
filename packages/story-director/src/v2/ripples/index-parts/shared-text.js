// Text and list helpers shared by the ripples parts.

export const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export const fold = value => text(value).normalize('NFKC').toLowerCase();
export const cut = (value, max) => Array.from(value).slice(0, max).join('');

export const list = value => (Array.isArray(value) ? value : []);
