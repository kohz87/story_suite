// The custom field names in force: the configured names plus Level while the host's RPG feature is on (holds the probe).

import { normalizeCustomFieldNames } from '../core.js';
import { getSettings } from './get-settings.js';

// The host's answer to "is Story Block's RPG feature on?", set by runtime-hosted.js; null (no host) means off.
let rpgProbe = null;
export function setRpgProbe(probe) { rpgProbe = typeof probe === 'function' ? probe : null; }

// The custom field names in force right now: the configured names, plus "Level" while Story Block's RPG feature is on
// (read at call time, never stored, so a feature switched mid-chat is seen by the next prompt, injection or view).
// Standalone or RPG off: exactly the configured names. The settings page keeps showing the configured list.
export function effectiveCustomFieldNames(settings = getSettings()) {
    const names = normalizeCustomFieldNames(settings?.customFieldNames);
    let on = false;
    try { on = rpgProbe?.() === true; } catch { on = false; }
    return on && !names.some(name => name.toLowerCase() === 'level') ? [...names, 'Level'] : names;
}
