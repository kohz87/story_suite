// Small readers shared by the character file's writer and parser.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const whole = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
// One line of text, cut by code points (the same shape the wizard keeps its text in).
export const line = (value, max) => [...(typeof value === 'string' ? value.replace(/\p{Cf}+/gu, '').normalize('NFC').replace(/\s+/g, ' ').trim() : '')].slice(0, max).join('').trim();
export const bad = message => ({ ok: false, message });
