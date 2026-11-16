// Parses a story line's or a reader action's labels into typed arguments, refusing with plain sentences.
import { dmInt, dmLabelNames, dmOwn, dmValueOfName } from '../schema.js';
import { oneLine } from '../../../core/text.js';
import { STRINGS } from '../../../core/strings.js';
import { refuse } from './errors.js';

/** "guild, watch or compact" */
export const orList = values => {
    const list = values.map(String);
    return list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} or ${list.at(-1)}`;
};
export function cleanList(value, max) {
    const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(';') : null;
    if (!entries || entries.some(entry => typeof entry !== 'string')) refuse('DM_BOUNDS', '', STRINGS.blocks.listLimit);
    const cleaned = entries.map(entry => oneLine(entry)).filter(Boolean);
    if (cleaned.length > 12) refuse('DM_BOUNDS', '', STRINGS.blocks.listLimit);
    return [...cleaned.join('; ')].slice(0, max).join('');
}
// (a number with display names also takes any of them: "be a whole number from 0 to 5 or Down, Hurt or Unhurt")
const ruleOf = (schema, names = null) => (schema.type === 'enum' ? `be ${orList(schema.values)}`
    : schema.type === 'int' ? `be a whole number from ${schema.min} to ${schema.max}${names ? ` or ${orList(Object.values(names).slice(0, 8))}${Object.keys(names).length > 8 ? ' …' : ''}` : ''}`
        : schema.type === 'text' ? STRINGS.editMessages.textNonempty : 'be true or false');

// Each label of a line is one declared name with one value of its declared type; anything else is refused with a plain sentence
// ("faction must be guild, watch or compact"), never guessed. `text`: a story line (its values are text); else typed (a reader action).
export function parseLabels(definition, kind, labels, { text = false } = {}) {
    const args = {};
    const allowed = ['kind', ...(definition.scope === 'character' ? ['who'] : []), ...Object.keys(kind.labels)];
    for (const key of Object.keys(labels)) if (!allowed.includes(key)) refuse('DM_LABEL', key, key === 'who' ? 'this module has no characters, so who is not allowed' : `${key} is not a label of this line (${orList(allowed.filter(name => name !== 'kind'))})`);
    for (const [key, schema] of Object.entries(kind.labels)) {
        if (!dmOwn(labels, key) && schema.optional === true) continue;
        if (!dmOwn(labels, key)) refuse('DM_LABEL', key, `${key} is missing`);
        let value = labels[key];
        // A number the story may write as one of its display names; the stored value is always the number.
        const names = text && schema.type === 'int' ? dmLabelNames(definition, kind, key) : null;
        if (text) {
            if (schema.type === 'int' && names && typeof value === 'string' && !/^-?\d+$/.test(value)) value = dmValueOfName(names, value) ?? value;
            if (schema.type === 'int' && /^-?\d+$/.test(value)) value = Number(value);
            if (schema.type === 'bool' && ['true', 'false'].includes(value)) value = value === 'true';
            if (schema.type === 'enum') {
                const matches = schema.values.filter(candidate => String(candidate) === value);
                if (matches.length === 1) value = matches[0];
            }
        }
        if (schema.type === 'text' && typeof value === 'string') value = [...oneLine(value)].slice(0, schema.max).join('');
        const valid = schema.type === 'int' ? dmInt(value, schema.min, schema.max)
            : schema.type === 'bool' ? typeof value === 'boolean'
                : schema.type === 'text' ? typeof value === 'string' && value.length > 0 : schema.values.includes(value);
        if (!valid) refuse('DM_LABEL', key, `${key} must ${ruleOf(schema, names)}`);
        args[key] = value;
    }
    return args;
}
