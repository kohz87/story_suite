// Numeric and plain-object shape checks for route inputs.

export function positive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function nonNegative(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function finite(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
