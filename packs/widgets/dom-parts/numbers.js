// Number helpers: clamp, a finite number with a fallback, a short display number.

/** Clamps a number into [min, max]. */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}


/** A finite number, or the fallback. */
export function num(value, fallback = 0) {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

/** A number for display or an SVG attribute: at most two decimals, no trailing zeros, no "-0", never "Infinity". */
export function fmt(value) {
    const n = num(value);
    // Two decimals only where n * 100 is still exact enough to round (and cannot overflow to Infinity).
    const rounded = Math.abs(n) < 1e13 ? Math.round(n * 100) / 100 : Math.round(n);
    return String(Object.is(rounded, -0) ? 0 : rounded);
}
