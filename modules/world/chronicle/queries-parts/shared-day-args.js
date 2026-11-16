// Chronicle queries' reading of a story-day argument and the host's text substitution.

export const substituteOf = tools => (typeof tools?.substitute === 'function' ? value => {
    try {
        const out = tools.substitute(value);
        return typeof out === 'string' ? out : String(value ?? '');
    } catch {
        return String(value ?? '');
    }
} : value => String(value ?? ''));

export const dayArg = value => (value === null || value === undefined || value === '' ? null : Number.isSafeInteger(Number(value)) ? Number(value) : NaN);
