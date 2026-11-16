// Puts the one Story Suite settings tree in place when the runtime starts: one `ui` default and empty `core` and `modules` buckets.

import { assembleDefaults } from './defaults.js';
import { firstLoadSettings } from './first-load.js';

/**
 * Makes `root().storySuite` the schema-1 tree (`root`: () => extension_settings). An old-shaped tree moves whole to
 * `storySuite_legacy`; the new tree holds only the reader's choices (`settings()` reads them over the declared defaults, which assembleDefaults checks). Calls `save` only when it
 * changed something; a second call changes nothing. Returns the tree, or null when there is no settings object.
 */
export function loadSettings({ root, registry, coreDefaults, save = () => {} }) {
    const es = root?.();
    if (es === null || typeof es !== 'object' || Array.isArray(es)) return null;
    const before = es.storySuite;
    // The assembled defaults check the declarations (a duplicate id throws) and give the `ui` defaults. Only the choices
    // are stored in `core` and `modules`: a stored default would hide a pack's currency or a chat's rule overlay, and a
    // later change of a default would never reach the reader.
    const defaults = { ...assembleDefaults({ core: coreDefaults, modules: registry.settingsDefs() }), core: {}, modules: {} };
    const tree = firstLoadSettings(es, defaults);
    if (tree !== before) save();
    return tree;
}
