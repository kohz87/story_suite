// The words a number field shows: its names, a Soul Class or rank name, and a stage word.

import { STAGES } from '../../index.js';
import { isRecord } from './shared-basics.js';

const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']);
const RANKS = Object.freeze(['Novice', 'Adept', 'Expert', 'Master']);

/** A number field's display name for `value` (`names` on the field), else `fallback`. */
export function nameOf(schema, value, fallback = '') {
    const named = isRecord(schema?.names) ? schema.names[String(value)] : undefined;
    return typeof named === 'string' && named ? named : fallback;
}

/** "II" for Soul Class 2 (a chat made before Levels still reads its stored class). */
export const soulName = (schema, value) => nameOf(schema, value, ROMAN[value] ?? String(value));

/** "Expert" for rank 2. */
export const rankName = (schema, value) => nameOf(schema, value, RANKS[value] ?? String(value));

/** The stage word of a health, mana or stamina value ("Hurt"); the field's own names win. */
export function stageWord(key, schema, value) {
    const words = STAGES[key] ?? [];
    return nameOf(schema, value, words[value] ?? String(value));
}
