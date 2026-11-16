// Floating-point cleanup and number formatting for route text.

// 6.500000000001 → 6.5, so sums and printed numbers stay clean.
export function tidy(value) {
    return Math.round(value * 1e9) / 1e9;
}

export function num(value) {
    return String(Number(Number(value).toFixed(2)));
}
