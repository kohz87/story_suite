// What a story-block.fields node says that cannot hold for its module.
import { dmObject, dmOwn } from '../schema.js';
import { FIELDS_PROPS } from './constants.js';

/** What a fields node says that cannot hold for this module: [{ at, message }] (none when it is fine). */
export function fieldsNodeProblems(definition, props) {
    const out = [], bad = (at, message) => out.push({ at, message });
    if (!dmObject(props)) { bad('', 'story-block.fields needs props.'); return out; }
    for (const key of Object.keys(props)) if (!FIELDS_PROPS.includes(key)) bad(`.${key}`, `story-block.fields has no prop "${key}" (expected ${FIELDS_PROPS.join(', ')}).`);
    if (props.module !== definition.id) bad('.module', 'story-block.fields may show only its own module.');
    const names = Array.isArray(props.fields) ? props.fields : props.field !== undefined ? [props.field] : [];
    if (!names.length || names.length > 32 || names.some(name => typeof name !== 'string' || !dmOwn(definition.state, name))) bad('.field', 'Name a field of this module (field) or a list of them (fields).');
    else {
        const first = definition.state[names[0]];
        if (props.field !== undefined && props.fields !== undefined) bad('.fields', 'Give field or fields, not both.');
        if (props.as !== undefined && !['map', 'record'].includes(props.as)) bad('.as', 'as is "map" or "record".');
        const map = props.as === 'map' || (props.as === undefined && (first.type === 'map' || false));
        if (map && (first.type === 'map' ? first.values.type !== 'int' || names.length !== 1 : names.some(name => definition.state[name].type !== 'int'))) bad('.field', 'A map of numbers is a map field of whole numbers, or a list of whole-number fields.');
    }
    for (const key of ['names', 'labels', 'units', 'tones']) if (props[key] !== undefined && !dmObject(props[key])) bad(`.${key}`, `${key} must be an object.`);
    if (props.tiles !== undefined && (typeof props.tiles !== 'boolean' || props.as !== 'record')) bad('.tiles', 'tiles is true or false and goes with as "record".');
    if (props.title !== undefined && (typeof props.title !== 'string' || [...props.title].length > 60)) bad('.title', 'title must be text of at most 60 characters.');
    return out;
}
