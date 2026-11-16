// Story Director v2, tracker part (convert): compares two values by content, key order aside.

/**
 * A value as text with every object's keys in order, so two threads that hold the same compare equal
 * however their keys came to be ordered (a field a later line added sits last in the stored thread).
 */
export function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    // As JSON keeps it: a key whose value is undefined is not there.
    if (value && typeof value === 'object') return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value) ?? 'undefined';
}

/**
 * Whether two values hold the same (key order aside). A thread a line did not change must not look
 * changed: it would get the line's `rev`, a write into a thread another reply made, which a deleted
 * reply then takes the whole line down with (B-b1r2-12).
 */
export const sameValue = (a, b) => canonical(a) === canonical(b);
