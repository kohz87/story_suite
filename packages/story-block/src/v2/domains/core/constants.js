// Story Block's core module identity, static prompt/grammar text, features and settings. These are the
// stable values the core part and module assembly share; no domain logic lives here. Public face: re-exports its parts.

export { CORE_MODULE_ID, CORE_BUDGET, CORE_STATIC, GEAR_ITEM_GRAMMAR } from './constants-parts/identity.js';
export { CORE_FEATURES } from './constants-parts/features.js';
export { CORE_SETTINGS } from './constants-parts/settings.js';
