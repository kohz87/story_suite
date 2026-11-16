// Joins a block's fields into tail lines: one field, all of a block's fields, and the named fields a root changed.
import { dmHidden } from '../../schema.js';
import { barOf } from '../../../../../../../modules/rpg/blocks.js';
import { valueText, entriesText, shownText } from './field-words.js';

// A hidden field (`prompt: false`) is left out: the story is never told it.
const fieldText = (definition, key, value, room) => (Array.isArray(value) ? entriesText(definition, key, value, room) : value !== null && typeof value === 'object'
    ? `${key}: ${Object.entries(value).map(([name, item]) => `${name} ${valueText(item)}`).join(', ')}` : `${key} ${shownText(definition.state[key], value)}`);
// (`room`: the characters the line may take; a List of entries takes what the other fields leave)
const fieldsText = (definition, fields, room = Infinity) => {
    const shown = Object.entries(fields).filter(([key]) => !dmHidden(definition.state[key]));
    const lists = shown.filter(([, value]) => Array.isArray(value)).length;
    const left = lists ? (room - shown.filter(([, value]) => !Array.isArray(value)).reduce((sum, [key, value]) => sum + fieldText(definition, key, value).length + 2, 0)) / lists : 0;
    return shown.map(([key, value]) => fieldText(definition, key, value, lists ? Math.max(0, Math.floor(left)) : undefined)).join('; ');
};
// The named fields a root changed, for its summary: "Soul Class II → III". Empty for a block with no display names.
const namedChanges = (definition, before, after) => Object.entries(definition.state).filter(([key, schema]) => (schema.names || barOf(schema)) && before[key] !== after[key])
    .map(([key, schema]) => `${schema.label ?? key} ${shownText(schema, before[key], { fields: before, key })} → ${shownText(schema, after[key], { fields: after, key })}`);

export { fieldText, fieldsText, namedChanges };
