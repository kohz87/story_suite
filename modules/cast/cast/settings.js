// Story Director v2, part **cast**: the feature, its settings and the switch every hook and query reads (pure).
// Public face: re-exports its parts.

export { CALL_MS, HOLD_MS, HOOK_MS, TAIL_BUDGET } from './settings-parts/budgets.js';
export { DEFAULTS, FEATURE, SCHEMA } from './settings-parts/schema.js';
export { castOn, castSettings, featureOn, settingsOf } from './settings-parts/read.js';
