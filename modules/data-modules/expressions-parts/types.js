// The type of a declared field, and whether one type fits another.
import { dmObject, dmInt } from '../schema.js';
import { BAD, bool, str, int } from './shared-types.js';

export function fieldType(schema) {
    if (!dmObject(schema)) return BAD;
    if (schema.type === 'int' && dmInt(schema.min) && dmInt(schema.max)) return int(schema.min, schema.max);
    if (schema.type === 'enum' && Array.isArray(schema.values)) {
        const values = schema.values;
        const type = values.every(v => typeof v === 'number') ? int(Math.min(...values), Math.max(...values))
            : values.every(v => typeof v === 'boolean') ? bool()
                : values.every(v => v === null) ? { type: 'null' } : str(values);
        return { ...type, enumValues: values };
    }
    if (schema.type === 'bool') return bool();
    if (schema.type === 'text') return { type: 'text', max: schema.max, ...(schema.list === true ? { list: true } : {}) };
    return BAD;
}

export function compatible(target, source, { overlap = false } = {}) {
    if (target.type === 'invalid' || source.type === 'invalid') return true; // one diagnostic per bad reference
    if (target.enumValues) {
        let values = source.enumValues ?? source.values;
        if (!values && source.type === 'bool') values = [false, true];
        if (!values && source.type === 'null') values = [null];
        if (!values && source.type === 'int' && source.max - source.min < 32) values = Array.from({ length: source.max - source.min + 1 }, (_, i) => source.min + i);
        return Boolean(values && values.every(value => target.enumValues.includes(value)));
    }
    if (target.type !== source.type) return false;
    if (target.type === 'int') return overlap ? source.max >= target.min && source.min <= target.max
        : source.min >= target.min && source.max <= target.max;
    if (target.type === 'enum') return source.values.every(value => target.values.includes(value));
    return target.type !== 'text'; // text is display-only, never an expression
}
