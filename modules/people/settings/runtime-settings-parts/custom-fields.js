// The custom field names in force (the configured names) and the host's RPG probe.
// Level is a built-in field now (pack format 4): it is no longer added to the custom fields while the RPG is on.

import { normalizeCustomFieldNames } from '../../core/core.js';
import { getSettings } from './get-settings.js';

// The host's answer to "is Story Block's RPG feature on?", set by runtime-hosted.js; null (no host) means off.
let rpgProbe = null;
export function setRpgProbe(probe) { rpgProbe = typeof probe === 'function' ? probe : null; }

// Whether the host's RPG feature is on right now (false with no host or when the probe throws).
export function rpgIsOn() {
    try { return rpgProbe?.() === true; } catch { return false; }
}

// The custom field names in force right now: exactly the configured names (read at call time).
export function effectiveCustomFieldNames(settings = getSettings()) {
    return normalizeCustomFieldNames(settings?.customFieldNames);
}
