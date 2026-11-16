/* NPC State Delta settings (role: runtime-settings). The extension's settings key, the portrait theme presets and custom
   preset library, the defaults, getSettings (which fills in and canonicalizes the stored settings), persistSettings,
   injectDepthOf and the present-cast display normalizer. Moved out of index.js without change; nothing here keeps
   per-instance state, so index.js imports the functions directly. Public face: re-exports its parts. */

export { PORTRAIT_THEME_PRESETS, PORTRAIT_CUSTOM_PRESET_LIMIT } from './runtime-settings-parts/portrait-preset-constants.js';
export { portraitCustomPreset, portraitCustomPresetLibrary, portraitCustomPresetFor, nextPortraitCustomPresetId } from './runtime-settings-parts/portrait-preset-library.js';
export { portraitCustomPresetNameTaken, uniquePortraitCustomPresetName } from './runtime-settings-parts/portrait-preset-names.js';
export { SETTINGS_LAZY_QUIET_MS, SETTINGS_LAZY_MAX_MS } from './runtime-settings-parts/save-timing.js';
export { persistSettings, persistSettingsLazy, flushPendingSettingsSave } from './runtime-settings-parts/save.js';
export { EXTENSION_NAME, injectDepthOf, normalizePresentCastDisplay } from './runtime-settings-parts/settings-values.js';
export { setRpgProbe, effectiveCustomFieldNames } from './runtime-settings-parts/custom-fields.js';
export { getSettings } from './runtime-settings-parts/get-settings.js';
