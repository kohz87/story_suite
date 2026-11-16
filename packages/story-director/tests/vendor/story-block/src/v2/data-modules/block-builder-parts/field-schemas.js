// Field schemas: a plain field, a List of entries and the three change kinds of a list, from the form.
import { oneLine } from '../../../text.js';
import { DM_LIMITS as L } from '../schema.js';
import { cleanList, titlePart } from '../interpreter.js';
import { STRINGS, fill } from '../../strings.js';
import { problem, number } from './shared-basics.js';
import { parseNames } from './names.js';
import { partKey } from './slugs.js';

const B = STRINGS.blocks;

// A part of an entry (or a plain field) from its form: text, number or choice. → { schema } or { error } (a problem for the form).
export function partSchema(field, path, label, { list = false, names = false } = {}) {
    if (field.type === 'text') return { schema: { type: 'text', max: Number(field.max ?? 120), default: String(field.default ?? ''), label } };
    if (field.type === 'list' && list) {
        try { return { schema: { type: 'text', max: 240, default: cleanList(field.default ?? '', 240), list: true, label } }; } catch { return { error: problem(`${path}.default`, B.listLimit) }; }
    }
    if (field.type === 'number') {
        const schema = { type: 'int', min: number(field.min), max: number(field.max), default: number(field.default), label };
        if (names) {
            const given = parseNames(field.names);
            if (!given) return { error: problem(`${path}.names`, B.namesInvalid) };
            if (Object.keys(given).length) schema.names = given;
        }
        return { schema };
    }
    if (field.type === 'choice') {
        const values = Array.isArray(field.values) ? field.values.map(value => oneLine(value)) : String(field.values ?? '').split(',').map(value => oneLine(value));
        if (values.length < 2 || values.length > L.enumValues || values.some(value => !value) || new Set(values).size !== values.length) return { error: problem(`${path}.values`, B.choiceLimit) };
        return { schema: { type: 'enum', values, default: field.default || values[0], label } };
    }
    return { error: problem(`${path}.type`, B.fieldType) };
}

export function entriesSchema(field, path, label) {
    const parts = Array.isArray(field.of) ? field.of : [];
    if (!parts.length || parts.length > L.entrySubs) return { error: problem(`${path}.of`, B.entrySubsLimit) };
    const max = number(field.max ?? L.entriesDefault);
    if (!Number.isSafeInteger(max) || max < 1 || max > L.entriesMax) return { error: problem(`${path}.max`, fill(B.entriesMax, { max: L.entriesMax })) };
    const of = {};
    for (const [index, part] of parts.entries()) {
        const where = `${path}.of.${index}`, name = oneLine(part?.name), key = partKey(part?.key || name);
        if (!name || [...name].length > 60 || !key || Object.hasOwn(of, key) || ['at', 'kind', 'who'].includes(key)) return { error: problem(`${where}.name`, B.entrySubName) };
        const made = partSchema(part, where, name);
        if (made.error) return made;
        of[key] = made.schema;
    }
    return { schema: { type: 'entries', of, max, label } };
}
// The three lines of a List of entries: add an entry (its title is required), change one by `at` (its number or title; any part), drop one by `at`.
export function entryKinds(key, schema, roles) {
    const parts = Object.entries(schema.of), title = titlePart({ state: { [key]: schema }, roles }, key) ?? parts[0][0];
    const label = part => (part.type === 'int' ? { type: 'int', min: part.min, max: part.max } : part.type === 'enum' ? { type: 'enum', values: part.values } : { type: 'text', max: part.max });
    const labels = optional => Object.fromEntries(parts.map(([name, part]) => [name, { ...label(part), ...(optional || name !== title ? { optional: true } : {}) }]));
    const at = { type: 'text', max: L.entryAt };
    return {
        [`add-${key}`]: { op: '+', labels: labels(false), effects: [{ op: 'entryAdd', path: [key] }] },
        [`set-${key}`]: { op: '~', labels: { at, ...labels(true) }, effects: [{ op: 'entrySet', path: [key] }] },
        [`drop-${key}`]: { op: '-', labels: { at }, effects: [{ op: 'entryDrop', path: [key] }] },
    };
}
