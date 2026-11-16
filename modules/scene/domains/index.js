// Story Block's core module (§6, §7): the scene and inventory domains as one plain module definition
// for `sdk.registerModule`. This path keeps every public export; the core constants, kinds, part builder,
// merger, extra queries and module assembly live in domains/core/.
// Public face: re-exports its parts.

export { createPacksPart, createCoreModule, createCorePart, mergeParts } from './index-parts/assembly.js';
export { CORE_MODULE_ID, CORE_BUDGET, CORE_STATIC, GEAR_ITEM_GRAMMAR } from './index-parts/identity.js';
export { CORE_FEATURES, CORE_SETTINGS, youGrammar, CORE_KINDS } from './index-parts/declarations.js';
export { chatterBack, headMoved } from './index-parts/chatter.js';
