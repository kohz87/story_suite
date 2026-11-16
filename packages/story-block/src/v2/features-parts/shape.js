// Features: the fields a feature entry, its needs and its presets may have, and the preset names.

// The fields a feature entry has; any other is a newer module's, warned and ignored.
export const FEATURE_KEYS = Object.freeze(['id', 'label', 'describe', 'default', 'prompt', 'needs', 'presets']);
// "How much to track" (Settings → Features): a feature entry may carry `presets: { lean?: boolean, full?: boolean }`.
// Standard is the feature's own `default`; a preset key it leaves out is its `default` too; `presets: false` keeps the
// feature out of presets (a preset never changes it). A module with no `presets` follows `default` in all three.
export const PRESET_NAMES = Object.freeze(['lean', 'standard', 'full']);
export const PRESET_KEYS = Object.freeze(['lean', 'full']);
// `needs`: what another module must register for the feature to work at all.
export const NEEDS_KEYS = Object.freeze(['kinds', 'commands', 'queries', 'why']);
