// Check builders: a check for a list or an ID-keyed record from a check for one value.
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** arrayOf(check) → a check for a list whose every item passes `check`. */
export function arrayOf(check) {
    return value => {
        if (!Array.isArray(value)) return 'must be a list';
        for (let i = 0; i < value.length; i++) {
            const error = check(value[i]);
            if (error) return `item ${i + 1} ${error}`;
        }
        return '';
    };
}

/** record(check, keyCheck?) → a check for `{ [key]: value }` whose every value (and key) passes. */
export function record(check, keyCheck = null) {
    return value => {
        if (!isRecord(value)) return 'must be a record (an object keyed by ID)';
        for (const key of Object.keys(value).sort()) {
            const keyError = keyCheck ? keyCheck(key) : '';
            if (keyError) return `key ${key} ${keyError}`;
            const error = check(value[key]);
            if (error) return `${key} ${error}`;
        }
        return '';
    };
}
