// Features (MODULES §F100, SPEC §6): the optional mechanics a reader switches on and off, each in the
// Features subsection of its module's settings and on one overview of every module's features.
//
// A module declares them, `registerModule({ features: [{ id, label, describe, default, prompt? }] })`,
// ids namespaced by the module (`example-module.wear`), and marks what each one owns with
// `feature: '<id>'`: a capture kind, a command (`{ handler, feature }`, or a handler function with a
// `feature` property), a query or a hook (a function with a `feature` property, so an older host that
// only takes functions there still takes it), the module's context or one of its `context.parts`, a
// screen, a tab, a widget, a settings field (`{ type, …, feature }`) or the custom settings panel (a
// function with a `feature` property). Off means fully off (registry.js does the leaving out): no
// grammar, no context lines, commands refused with FEATURE_OFF, queries answer null, hooks skipped,
// screens, tabs, widgets, dialogs and settings fields hidden (their stored values kept). The state is never touched, so turning it back on brings everything back.
//
// The choice is the reader's, not the chat's: `extension_settings.storySuite.features[<id>] = true |
// false`; a feature with no choice stored takes its `default` (on when it gives none). Pure: no DOM,
// no SillyTavern.
// Public face: re-exports its parts.

export { FEATURE_OFF, GEAR_FEATURE, CORE_FEATURE, CORE_LEGACY } from './features-parts/names.js';
export { FEATURE_KEYS, PRESET_NAMES, PRESET_KEYS, NEEDS_KEYS } from './features-parts/shape.js';
export { WHY_MAX, LABEL_MAX, DESCRIBE_MAX } from './features-parts/limits.js';
export { NEEDS_HINT, PROMPT_HINT } from './features-parts/hints.js';
export { featureOf, featureRefs, affectsStatic } from './features-parts/refs.js';
export { featureProblems, featureWarnings } from './features-parts/problems.js';
export { presetsOf, inPresets, presetValue } from './features-parts/presets-read.js';
export { presetSwitches, selectedPreset, applyPreset } from './features-parts/presets-apply.js';
export { createFeatureStore, withHiddenFeatures } from './features-parts/store.js';
