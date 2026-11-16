// Cleaning a text to one line, reading an integer with a fallback and signing a value.

// Flattened to one line and cut by code points (a surrogate pair is never split).
export const clean = (value, max) => [...String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();

export const intOr = (value, fallback) => {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : fallback;
};

export const signed = value => (value > 0 ? `+${value}` : String(value));
