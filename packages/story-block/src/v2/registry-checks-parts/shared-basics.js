// The record test, id sort and plain-JSON check the definition checks share.

export const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** '' when `value` is plain JSON (§2.1), else where it is not. */
export function jsonProblem(value, path = '') {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return '';
    if (typeof value === 'number') return Number.isFinite(value) ? '' : `${path || 'the value'} is not a finite number`;
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
            const problem = jsonProblem(value[i], `${path}/${i}`);
            if (problem) return problem;
        }
        return '';
    }
    const proto = isObject(value) ? Object.getPrototypeOf(value) : undefined;
    if (proto === Object.prototype || proto === null) {
        for (const [key, item] of Object.entries(value)) {
            const problem = jsonProblem(item, `${path}/${key}`);
            if (problem) return problem;
        }
        return '';
    }
    return `${path || 'the value'} is not plain JSON (${value === undefined ? 'undefined' : typeof value})`;
}
