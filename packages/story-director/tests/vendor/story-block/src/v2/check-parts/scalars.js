// Scalar checks: whole numbers, text, one-of lists and true/false.
export function int(value, { min, max } = {}) {
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'must be a whole number';
    if (min !== undefined && value < min) return `must be ${min} or more`;
    if (max !== undefined && value > max) return `must be ${max} or less`;
    return '';
}

export function str(value, { min, max } = {}) {
    if (typeof value !== 'string') return 'must be text';
    if (min !== undefined && value.length < min) return min === 1 ? 'must not be empty' : `must be at least ${min} characters`;
    if (max !== undefined && value.length > max) return `must be at most ${max} characters`;
    return '';
}

export function oneOf(value, list) {
    return Array.isArray(list) && list.includes(value) ? '' : `must be one of: ${(list ?? []).join(', ')}`;
}

export function bool(value) {
    return typeof value === 'boolean' ? '' : 'must be true or false';
}
