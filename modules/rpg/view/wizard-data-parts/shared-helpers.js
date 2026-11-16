// Small plain-data helpers the wizard files share: record test, one-line text and clamping.



export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const oneLine = (value, max) => [...(typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')].slice(0, max).join('');

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
