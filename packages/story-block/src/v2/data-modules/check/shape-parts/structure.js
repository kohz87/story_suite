// The structural validators: object shape, sized and named collections, distinct literals.
import { DM_LIMITS as L, dmInt, dmObject, dmSlug } from '../../schema.js';

export function shape(value, descriptor, path, add, code = 'DM_SCHEMA') {
    if (!dmObject(value)) { add(code, path, 'Expected an object with the declared fields.'); return false; }
    const required = Array.isArray(descriptor) ? descriptor : descriptor.required;
    const allowed = [...required, ...(descriptor.optional ?? [])];
    for (const key of Object.keys(value)) if (!allowed.includes(key)) add(code, `${path}.${key}`, `Unknown field "${key}"; expected ${allowed.join(', ')}.`);
    for (const key of required) if (!Object.hasOwn(value, key)) add(code, `${path}.${key}`, `Missing required field "${key}".`);
    return true;
}
export function sized(value, max, path, add, { min = 0, list = false } = {}) {
    if (!(list ? Array.isArray(value) : dmObject(value))) {
        add('DM_SCHEMA', path, list ? 'Expected a list.' : 'Expected a named object.');
        return false;
    }
    const length = list ? value.length : Object.keys(value).length;
    if (length < min) add('DM_SCHEMA', path, `Expected at least ${min} entries.`);
    if (length > max) add('DM_BUDGET', path, `Version 1 permits at most ${max} entries here.`);
    return true;
}
export function named(value, max, path, add, { label = false, min = 0 } = {}) {
    if (!sized(value, max, path, add, { min })) return [];
    for (const key of Object.keys(value)) {
        if (!dmSlug(key) || (label && !/^[a-z]+$/.test(key))) add(label ? 'DM_LABEL' : 'DM_SCHEMA', `${path}.${key}`, label
            ? 'Labels are one lowercase word of at most 40 characters.' : 'Names are safe lowercase slugs of at most 40 characters.');
    }
    return Object.entries(value);
}
export function distinct(values, path, add, { max = L.enumValues, keys = false } = {}) {
    if (!Array.isArray(values) || !values.length || values.length > max || values.some(value => keys ? !dmSlug(value)
        : !(value === null || typeof value === 'string' || typeof value === 'boolean' || dmInt(value)))) {
        add('DM_SCHEMA', path, `Expected 1 to ${max} distinct ${keys ? 'safe key slugs' : 'JSON scalar literals'}.`);
        return false;
    }
    if (new Set(values.map(value => JSON.stringify(typeof value === 'string' ? value.normalize('NFKC') : value))).size !== values.length) add('DM_SCHEMA', path, 'Values must be distinct after Unicode normalization.');
    return true;
}
