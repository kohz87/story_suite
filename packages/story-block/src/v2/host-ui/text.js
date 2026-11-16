// Story Suite v2: the settings host's wording and fold ids (moved out of host-ui.js unchanged; host-ui.js re-exports them).
// The ids of the folds and the class the settings window carries, and the texts the settings, Tabs, Diagnostics and Features
// folds draw. Constants only.
// Public face: re-exports its parts.

export { OPEN_CLASS, HOST_FOLD, FEATURES_FOLD, VERSIONS_FOLD } from './text-parts/fold-ids-main.js';
export { DIAGNOSTICS_FOLD, SENT_FOLD, TABS_FOLD, PACKS_FOLD } from './text-parts/fold-ids-more.js';
export { S, EVENTS_FOLD, SUB_FOLD, featuresFoldOf } from './text-parts/fold-ids-sub.js';
export { SETTINGS_TEXT } from './text-parts/settings-text.js';
export { TABS_TEXT, DIAGNOSTICS_TEXT, FEATURE_TEXT } from './text-parts/page-text.js';
