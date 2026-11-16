// Constants for the public sdk: event names, host settings (defaults and schema), limits, and the
// preflight classifications and name patterns. Values only; no behaviour.
// Public face: re-exports its parts.

export { EVENTS } from './constants-parts/events.js';
export { MAX_CHANGE_LINES, SETTING_TEXT_MAX, SETTING_LIST_ROWS } from './constants-parts/limits.js';
export { HOST_SETTINGS_DEFAULTS, HOST_SETTINGS_SCHEMA } from './constants-parts/host-settings.js';
export { PREFLIGHT_CLASSES, STORE_VERSION } from './constants-parts/preflight.js';
export { RULES_DOMAIN, MODULE_ID_TEXT, DOMAIN_TEXT } from './constants-parts/names.js';
