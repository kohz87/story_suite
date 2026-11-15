// The public sdk (docs/v2/SPEC.md §3.1, §6): what modules get from `await StoryBlock.ready`.
// Built from the store, the command bus and the registry; it adds the parts they share: events,
// settings under extension_settings.storySuite, the view modules read, ids, and adding a late
// module's initial state. No SillyTavern import (turn.js wires SillyTavern).
//
// The parts live under src/v2/sdk/: constants, settings, ids, events, queries and lifecycle. This file
// keeps its path, builds the sdk, and re-exports every public name.
// Public face: re-exports its parts.

export { createSdk } from './sdk-parts/create.js';
export { EVENTS, MAX_CHANGE_LINES, HOST_SETTINGS_DEFAULTS, HOST_SETTINGS_SCHEMA, SETTING_TEXT_MAX, SETTING_LIST_ROWS, PREFLIGHT_CLASSES } from './sdk/constants.js';
export { settingValue, createSettings } from './sdk/settings.js';
export { newId } from './sdk/ids.js';
export { createEvents } from './sdk/events.js';
export { runQuery, mountQuery, makeView, featureOn, missingModules } from './sdk/queries.js';
export { announceModules, ensureModules, preflight } from './sdk/lifecycle.js';
