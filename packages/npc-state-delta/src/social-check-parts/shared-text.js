// Text helpers the social check parts share: one-line clean cut and whole-word splitting.

// Flattened to one line and cut by code points (a surrogate pair is never split).
export const clean = (value, max) => [...String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
export const words = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
