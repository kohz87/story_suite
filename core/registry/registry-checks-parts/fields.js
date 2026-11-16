// Settings schema fields: the known types, their long form and what is wrong with one.

import { isObject } from './shared-basics.js';

export const FIELD_TYPES = Object.freeze(['bool', 'int', 'choice', 'text', 'list', 'profile']);

export const fieldType = field => (typeof field === 'string' ? field : Array.isArray(field) ? 'choice' : field?.type);

// One settings schema field: '' or what is wrong with it. A string is shorthand for its type and
// an array for a choice. A type this Story Block does not know (a newer module's) is no problem: the
// field is hidden and its value kept as it is (definitionWarnings says so).
export function fieldProblem(field, where) {
    const type = fieldType(field);
    if (typeof type === 'string' && type && !FIELD_TYPES.includes(type)) return '';
    if (!FIELD_TYPES.includes(type)) return `${where} has no type; use one of ${FIELD_TYPES.join(', ')}`;
    if (type === 'choice') {
        const options = Array.isArray(field) ? field : field.options;
        if (!Array.isArray(options) || !options.length) return `${where} is a choice with no options`;
    }
    if (type === 'list') {
        if (!isObject(field.of) || !Object.keys(field.of).length) return `${where} is a list with no fields in "of"`;
        for (const [key, sub] of Object.entries(field.of)) {
            if (sub?.type === 'list') return `${where}.${key} is a list inside a list, which the overlay cannot show`;
            const problem = fieldProblem(sub, `${where}.${key}`);
            if (problem) return problem;
        }
    }
    if (type === 'int') {
        for (const bound of ['min', 'max']) if (field[bound] !== undefined && !Number.isInteger(field[bound])) return `${where}.${bound} is not a whole number`;
    }
    if (!Array.isArray(field) && typeof field === 'object' && field.readOnly !== undefined && typeof field.readOnly !== 'boolean' && typeof field.readOnly !== 'function') {
        return `${where}.readOnly is not true, false or a function of the values`;
    }
    if (!Array.isArray(field) && typeof field === 'object' && field.shows !== undefined && typeof field.shows !== 'function') {
        return `${where}.shows is not a function of the values`;
    }
    return '';
}

/** A schema field in its long form: { type, label?, help?, min?, max?, options?, of?, readOnly?, shows? }. */
export function normalizeField(field) {
    if (typeof field === 'string') return { type: field };
    if (Array.isArray(field)) return { type: 'choice', options: field };
    return field;
}
