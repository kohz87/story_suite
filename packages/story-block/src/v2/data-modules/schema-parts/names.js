// Display names of number fields: the name of a value, what is shown, the value of a name, a label's names.
import { dmObject, dmOwn } from './checks.js';

// --- Display names and hidden fields (the RPG's number names and `prompt: false`) -----------------------------------------
const foldName = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

/** The display name of an int field's value: its `names` entry, or null. Stored values stay numbers. */
export const dmNameOf = (schema, value) => (schema?.type === 'int' && dmOwn(schema.names, String(value)) ? schema.names[String(value)] : null);

/** What a person (or the AI) is shown for a value: its name when it has one, else the value as it is. */
export const dmShown = (schema, value) => dmNameOf(schema, value) ?? (typeof value === 'string' ? value : String(value));

/** The number a name stands for (case-insensitive, spaces tidied), or null. */
export function dmValueOfName(names, text) {
    if (!dmObject(names)) return null;
    const wanted = foldName(text);
    if (!wanted) return null;
    const hit = Object.entries(names).find(([, name]) => foldName(name) === wanted);
    return hit ? Number(hit[0]) : null;
}

/**
 * The names a kind's int label shows: its own `names` (a label whose effect works the number out, as the Standard bars' stage words do),
 * else those of the int field a `set` effect copies it into (`value: ['arg', label]`), so a label needs no second copy of them. Null when
 * there are none.
 */
export function dmLabelNames(definition, kind, label) {
    if (kind?.labels?.[label]?.type === 'int' && dmObject(kind.labels[label].names)) return kind.labels[label].names;
    for (const effect of Array.isArray(kind?.effects) ? kind.effects : []) {
        if (effect?.op !== 'set' || !Array.isArray(effect.value) || effect.value[0] !== 'arg' || effect.value[1] !== label) continue;
        const field = Array.isArray(effect.path) && typeof effect.path[0] === 'string' && dmOwn(definition?.state, effect.path[0]) ? definition.state[effect.path[0]] : null;
        if (field?.type === 'int' && dmObject(field.names)) return field.names;
    }
    return null;
}
