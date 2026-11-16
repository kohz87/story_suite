/*
 * NPC State Delta card settings (Story Block 2.21.0 sdk.registerCardSettings, SDK-CARD-CONTRACT addendum D).
 *
 * A character card may recommend two of Delta's settings: the portrait prompt format and Scan every. Story Block
 * lists the ones that differ from the player's own, and applies the ticked ones with the player's click, by calling
 * `apply` here. Delta persists them exactly as its own controls do (the "Save prompt settings" button, the Scan
 * every box), so a reload keeps them. An older Story Block has no registerCardSettings: nothing is registered.
 * Public face: re-exports its parts.
 */
export { CARD_SETTINGS_OWNER, CARD_SETTINGS_LABEL, SCAN_EVERY_RANGE } from './card-settings-parts/constants.js';
export { validPortraitPromptFormat, validScanEvery } from './card-settings-parts/validators.js';
export { createCardSettingsDefinition } from './card-settings-parts/definition.js';
