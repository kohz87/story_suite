// Ratio and percentage: a bound number pair read as a clamped fraction or a whole percent.

function finite(value) {
    const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof number === 'number' && Number.isFinite(number) ? number : null;
}

/** a / b clamped to 0…1 (4 decimals); 0 when b is not a positive number. */
export function ratio(a, b) {
    const top = finite(a);
    const bottom = finite(b);
    if (top === null || bottom === null || bottom <= 0) return 0;
    return Math.round(Math.min(1, Math.max(0, top / bottom)) * 10000) / 10000;
}

/** a / b as a whole percentage, 0…100. */
export const pct = (a, b) => Math.round(ratio(a, b) * 100);
