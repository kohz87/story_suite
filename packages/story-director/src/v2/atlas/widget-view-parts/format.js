// Value coercion and formatting helpers for map widget props.

export const text = value => (typeof value === 'string' ? value : '');
export const px = value => `${Math.round(value * 10) / 10}px`;
export const fmt = value => String(Math.round(value * 100) / 100);
export const humanize = word => (word ? word.charAt(0).toUpperCase() + word.slice(1) : '');
