// Writes one grammar line (and one example line) for a single kind of a module.
import { DM_LIMITS as L, dmLabelNames } from '../schema.js';
import { oneLine } from '../../../../../../core/text.js';

// A number with display names: when every whole value has one, the names in order and then the range ("Down|Hurt|Unhurt (0..2)");
// else the range and the names it has ("1..9 (1=I, 2=II)"). The narrator may write either the name or the number.
function namedRange(schema, names) {
    const range = `${schema.min}..${schema.max}`, count = schema.max - schema.min + 1;
    const all = count <= L.names && Array.from({ length: count }, (_, at) => names[String(schema.min + at)]);
    if (all && all.every(name => typeof name === 'string')) return `${all.map(name => oneLine(name)).join('|')} (${range})`;
    return `${range} (${Object.entries(names).map(([value, name]) => `${value}=${oneLine(name)}`).join(', ')})`;
}
const valuesOf = (schema, names = null) => schema.type === 'enum' ? schema.values.map(value => oneLine(value)).join('|')
    : schema.type === 'int' ? (names ? namedRange(schema, names) : `${schema.min}..${schema.max}`) : schema.type === 'text' ? 'text' : 'true|false';

const onEntries = kind => (kind.effects ?? []).some(effect => effect?.op === 'entrySet' || effect?.op === 'entryDrop');

/**
 * One line of grammar for a kind: "+ dm reputation — reason | kind: gain | faction: guild|watch|compact".
 * `seen` (a Map, optional): a long list of values (the health words) already written on an earlier line is not written again: "to: same words as
 * character set-health" (the narrator may write the same words; only the text is shorter).
 */
export function kindGrammar(definition, name, reference, seen = null) {
    const kind = definition.kinds[name];
    // A line that changes an entry may give any part the line that adds one gives: it says so instead of writing them all again.
    const add = kind.effects?.length === 1 && kind.effects[0].op === 'entrySet' ? `add-${kind.effects[0].path?.[0]}` : null;
    const same = add && definition.kinds[add] && Object.keys(kind.labels).every(label => label === 'at' || definition.kinds[add].labels[label]);
    return `${kind.op} dm ${reference} — reason | kind: ${name}${definition.scope === 'character' ? ' | who: attached actor' : ''}`
        + (same ? ` | at: number or title | [any part of ${add}]` : Object.entries(kind.labels).map(([label, schema]) => {
            // (a line that works a List of entries names the entry it changes by number or title; a part the line may leave out is in brackets)
            if (label === 'at' && onEntries(kind)) return ' | at: number or title';
            const values = valuesOf(schema, schema.type === 'int' ? dmLabelNames(definition, kind, label) : null);
            if (schema.optional === true) return ` | [${label}: ${values}]`;
            const before = seen && values.length >= SAME_WORDS_AT ? seen.get(values) : undefined;
            if (seen && values.length >= SAME_WORDS_AT && before === undefined) seen.set(values, `${reference.split('/').at(-1)} ${name}`);
            return ` | ${label}: ${before === undefined ? values : `same words as ${before}`}`;
        }).join(''));
}
// A list of values at least this long is written once per prompt (the stage words of a health bar are 55 characters, a stat list 29).
const SAME_WORDS_AT = 40;

/** A concrete example line for a kind, using each label's first legal value (Setup shows these). */
export function kindExample(definition, name, reference) {
    const kind = definition.kinds[name];
    const first = schema => schema.type === 'enum' ? schema.values[0] : schema.type === 'int' ? schema.min : schema.type === 'text' ? 'text' : true;
    return `${kind.op} dm ${reference} — why it happens | kind: ${name}${definition.scope === 'character' ? ' | who: Name' : ''}`
        + Object.entries(kind.labels).map(([label, schema]) => ` | ${label}: ${label === 'at' && onEntries(kind) ? 1 : first(schema)}`).join('');
}
