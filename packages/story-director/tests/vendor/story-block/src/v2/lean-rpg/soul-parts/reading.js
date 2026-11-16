// How a Character block reads the number that stands in a roll: the word for a value, and the label-and-word reading.
import { CLASS_NAMES } from '../names.js';
import { soulLabelOf } from './label.js';

/** The word for a value: the field's own name for it, else I–IX, else the number. */
export function soulWordOf(schema, value) {
    const named = schema?.names !== null && typeof schema?.names === 'object' && !Array.isArray(schema.names) ? schema.names[String(value)] : undefined;
    return typeof named === 'string' && named.trim() ? named : CLASS_NAMES[value - 1] ?? String(value);
}

/**
 * What a Character block calls the number that stands in a roll: its Level field (2.17.0: label "Level", the number as its word) or, for a block made before
 * levels, the Soul Class field's own label and names. → { label, word(value) }
 */
export function characterReading(definition) {
    const level = definition?.state?.level;
    if (level !== null && typeof level === 'object' && !Array.isArray(level)) return { label: soulLabelOf(level), word: value => String(value) };
    return soulReading(definition?.state?.soul);
}

/** A reading of the field for the places that carry it around: { label, word(value) }. */
export const soulReading = schema => ({ label: soulLabelOf(schema), word: value => soulWordOf(schema, value) });
