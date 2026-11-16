// Rule helpers: a condition or an effect read from the form against the block's fields.
import { number } from './shared-basics.js';

// A rule's, card's or reply-end function's condition: one field compared with a value.
export const conditionOf = (condition, state) => {
    const schema = state[condition?.field];
    if (!schema || !['eq', 'ne', 'lt', 'gt', 'le', 'ge'].includes(condition?.op)) return null;
    return [condition.op, ['get', [condition.field]], schema.type === 'int' ? number(condition.value) : condition.value];
};

export const effectOf = (effect, state) => {
    const schema = state[effect?.field];
    if (!schema || !['set', 'add'].includes(effect?.op)) return null;
    if (effect.op === 'add') return schema.type === 'int' && Number.isSafeInteger(number(effect.value))
        ? { op: 'add', path: [effect.field], value: number(effect.value), bounds: 'clamp' } : null;
    let value = effect.value;
    if (schema.type === 'int') {
        value = number(value);
        if (!Number.isSafeInteger(value)) return null;
    }
    if (schema.list === true) { try { value = cleanList(value, schema.max); } catch { return null; } }
    return { op: 'set', path: [effect.field], value };
};
