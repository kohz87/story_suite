// Paths into a query result or list row: validate, read and resolve the `$item` references.

// A path into a query result or a list item: `hp.cur`, `actors.0.name`.
const SEGMENT = /^[\w$-]{1,64}$/;
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
export function pathError(path) {
    if (typeof path !== 'string' || !path) return 'a path must be a non-empty string';
    if (path.length > 256) return 'a path must be at most 256 characters';
    for (const segment of path.split('.')) {
        if (!SEGMENT.test(segment)) return `"${path}" is not a path (use names joined by dots, like hp.cur)`;
        if (FORBIDDEN.has(segment)) return `"${path}" uses the reserved name "${segment}"`;
    }
    return '';
}

// `$item`, `$item.name`, `$index`: references to the list row being drawn.
const ITEM_REF = /^\$item(?:\.(.+))?$/;
export function itemRef(value) {
    if (typeof value !== 'string') return null;
    if (value === '$index') return { index: true };
    const match = ITEM_REF.exec(value);
    if (!match) return null;
    return { path: match[1] ?? '' };
}

/** Own-property walk; '' returns the value itself. Missing → undefined. */
export function getPath(value, path) {
    if (!path) return value;
    let current = value;
    for (const segment of path.split('.')) {
        if (FORBIDDEN.has(segment) || current === null || typeof current !== 'object') return undefined;
        if (!Object.hasOwn(current, segment)) return undefined;
        current = current[segment];
    }
    return current;
}
