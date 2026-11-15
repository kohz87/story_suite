// The type of a field path, including dynamic path segments.
import { STRINGS } from '../../strings.js';
import { fieldType } from './types.js';
import { BAD, str, int } from './shared-types.js';

// A path's entire enum range must name fixed keys. This is shared by reads and effects.
export function pathType(path, env, at, add, visit) {
    if (!Array.isArray(path) || path.length < 1 || path.length > 2) {
        add('DM_SCHEMA', at, 'A field path is one or two declared key segments.');
        return BAD;
    }
    const segment = (value, allowed, where) => {
        const type = typeof value === 'string' ? str([value]) : visit(value, where);
        if (type.type === 'invalid') return [];
        if (type.type !== 'enum' || !type.values.length || type.values.some(key => !allowed.includes(key))) {
            add('DM_SCHEMA', where, 'Every possible path segment must resolve to a declared field or fixed map key.');
            return [];
        }
        return type.values;
    };
    const roots = segment(path[0], Object.keys(env.state ?? {}), `${at}[0]`);
    const types = [];
    for (const root of roots) {
        const field = env.state[root];
        if (field?.type === 'map') {
            if (path.length !== 2) { add('DM_SCHEMA', at, 'A map path must select a fixed scalar key.'); continue; }
            if (segment(path[1], field.keys ?? [], `${at}[1]`).length) types.push(fieldType(field.values));
        } else if (field?.type === 'entries') add('DM_SCHEMA', at, STRINGS.blocks.entriesFormula);
        else if (path.length !== 1) add('DM_SCHEMA', at, 'A scalar field has no child keys.');
        else types.push(fieldType(field));
    }
    if (!types.length || types.some(type => type.type === 'invalid')) return BAD;
    const type = types[0].type;
    if (types.some(t => t.type !== type)) {
        add('DM_SCHEMA', at, 'A dynamic field path must select one scalar type.');
        return BAD;
    }
    if (types.length === 1) return types[0];
    // Writes must fit every possible target; reads include every possible value.
    if (type === 'int') {
        const result = int((env.writing ? Math.max : Math.min)(...types.map(t => t.min)),
            (env.writing ? Math.min : Math.max)(...types.map(t => t.max)));
        const finite = types.find(t => t.enumValues);
        if (env.writing && finite) result.enumValues = finite.enumValues.filter(value => types.every(t => value >= t.min && value <= t.max && (!t.enumValues || t.enumValues.includes(value))));
        return result;
    }
    if (type === 'enum') return str(env.writing ? types[0].values.filter(v => types.every(t => t.values.includes(v)))
        : [...new Set(types.flatMap(t => t.values))]);
    if (type === 'text') return { type: 'text', max: (env.writing ? Math.min : Math.max)(...types.map(t => t.max)) };
    if (env.writing && type === 'bool' && types.some(t => t.enumValues)) return { type: 'bool', enumValues: [false, true].filter(v => types.every(t => !t.enumValues || t.enumValues.includes(v))) };
    return types[0];
}
