// Story Block v2's runtime, wired once for SillyTavern (index.js) and for the testkit alike: the
// registry with the core module (scene, inventory, packs, events), settings under
// extension_settings.storySuite, the store over the chat, the command bus, the public sdk and the
// turn. No DOM: the settings overlay, the tab host and the mounts are index.js's (src/v2/ui-host.js).
//
// What the runtime adds on top of the parts:
// * the initial state of a chat with none is the registry's, with the enabled packs' start merged
//   in (SPEC §2.6; `start` hooks, packs' applyStart);
// * the chat's one currency (MODULES §F1) is the reader's name for it, else the first enabled
//   pack's suggestion, else the default (gold);
// * the events part commits through this runtime's command bus (its cues are system steps) and asks
//   through its sdk;
// * the reader's features (MODULES §F100, features.js) under extension_settings.storySuite.features: the
//   registry leaves out what is off, a change is the sdk's `feature` event, and the assist helpers get
//   their two switches from Story Block's preroll and extractor features.
// * sdk.callModel (MODULES §G, model-call.js) over the `callModel` option (the one the assist helpers
//   use), else SillyTavern's own (stModelCall): one call per module at a time, a time limit
//   (`modelTimeoutMs`), FEATURE_OFF while the calling module's feature is off. A call on the chat's
//   connection (the assist's too) is marked as our own, so the turn never takes its prompt for the
//   reply's; sdk.callModel's waits while a reply is being built or awaited (the assist's run inside the
//   turn and do not). A profile's call goes at once.
// Public face: re-exports its parts.

export { VERSION } from './runtime-parts/version.js';
export { createRuntime } from './runtime-parts/create.js';
export { initialWithStart, packsFor, withPackCurrency } from './runtime/start.js';
export { SAVE_SEQ_KEY, MEMO_PREFIX, markUsed, saveOnUnload, storeSaving } from './runtime/saving.js';
