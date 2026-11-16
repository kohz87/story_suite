// How a bar is staged: the bars, the most stages, the highest stage index and the tone of a value.

import { STAGES } from '../../index.js';

export const BARS = Object.freeze(['health', 'mana', 'stamina']);

/** The most stages a bar is drawn with (the checker holds a role block to it; a block that got past it is drawn clamped). */
export const MAX_STAGE = 10;

/** The highest stage index of a bar: the field's max, else the last stage word; never more than MAX_STAGE. */
export const stageMax = (key, schema) => Math.min(MAX_STAGE, Number.isSafeInteger(schema?.max) ? Math.max(0, schema.max) : Math.max(1, (STAGES[key]?.length ?? 2) - 1));

/** Good near full, warn in the middle, bad near empty (the mockup: Hurt amber, Fresh green, Spent red). */
export function stageTone(value, max) {
    if (!(max > 0)) return 'neutral';
    const ratio = value / max;
    return ratio >= 0.7 ? 'good' : ratio >= 0.4 ? 'warn' : 'bad';
}
