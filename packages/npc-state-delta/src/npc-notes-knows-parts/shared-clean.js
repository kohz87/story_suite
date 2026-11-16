// Cleaning and comparing helpers shared by the know parts: text clean, whole day, reply key and same fact.

const REPLY_KEY_MAX = 80;

// The same cleaning as the neighbours (control characters to spaces, runs of space to one, cut to `max` characters).
export const clean = (value, max) => [...String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
export const wholeDay = value => (Number.isSafeInteger(value) && value >= 0 ? value : null);
export const replyKeyOk = value => (typeof value === 'string' && value.length > 0 && value.length <= REPLY_KEY_MAX) || (Number.isSafeInteger(value) && value >= 0);
export const sameFact = (a, b) => a.about.toLowerCase() === b.about.toLowerCase() && a.fact.toLowerCase() === b.fact.toLowerCase();
