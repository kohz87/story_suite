// Reads a field schema's bar kind, scale and stage words, and a block's stats.
import { STAT_KEYS } from '../formula.js';
import { STAGES } from '../names.js';
import { whole } from './shared-whole.js';

/** The bar of a field: 'health' | 'stamina' | 'mana' | 'foe' when its schema has `blocks`, else null. */
export const barOf = schema => (schema?.type === 'int' && ['health', 'stamina', 'mana', 'foe'].includes(schema.blocks) ? schema.blocks : null);

/** The scale a bar's schema carries: 2 only when its pin says `scale: 2` (every older pin has no mark and reads as 1, exactly as before). */
export const scaleOf = schema => (schema?.scale === 2 ? 2 : 1);

/** The words a bar's stages go by, empty first. A foe's Health uses Health's. */
export const wordsOf = bar => (bar === 'foe' ? STAGES.health : STAGES[bar]) ?? STAGES.health;

/** The stats a block's fields hold, as `{ str … cha }` numbers. */
export const statsOfFields = fields => Object.fromEntries(STAT_KEYS.map(key => [key, whole(fields?.[key])]));
