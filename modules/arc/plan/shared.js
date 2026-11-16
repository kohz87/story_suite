// Story Director v2, part **arc**: shared planner constants and text rules. Pure.
// Public face: re-exports its parts.

export { MAX_ANSWER_CHARS, MAX_LINES, PLAN_CAPS, MAX_ITEMS } from './shared-parts/limits.js';
export { MAX_FIGHTS, KEY_POINTS, DESC_POINTS, PART_POINTS } from './shared-parts/points.js';
export { LABELS, PARTS, DATE_PARTS, KIND_ORDER } from './shared-parts/schema.js';
export { SHOWN, RESERVED_KEYS } from './shared-parts/guards.js';
export { THINK_BLOCK, THINK_CLOSE, PLAN_OPEN, PLAN_CLOSE } from './shared-parts/blocks.js';
export { DECORATION, LABEL_LINE, FENCE } from './shared-parts/lines.js';
export { flat, part } from './shared-parts/text.js';
