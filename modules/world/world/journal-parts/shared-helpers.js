// Story Director v2, journal: the type tests, the string-list reader and the host substitute wrapper its parts share.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isInt = value => Number.isSafeInteger(value);
export const list = value => (Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);

export const substituteOf = tools => (typeof tools?.substitute === 'function' ? value => {
    try {
        const out = tools.substitute(value);
        return typeof out === 'string' ? out : String(value ?? '');
    } catch {
        return String(value ?? '');
    }
} : value => String(value ?? ''));
