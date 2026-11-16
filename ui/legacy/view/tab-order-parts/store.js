// The reader's tab choice in extension_settings.storySuite.tabs: read it, save it, forget it.

import { TAB_SETTINGS_KEY } from './constants.js';
import { readTabChoice } from './choice.js';

/**
 * The reader's choice in extension_settings.storySuite.tabs: { choice(), set(next), reset() }. `set`
 * keeps a clean copy and saves (debounced); `reset` forgets it (the default order, everything shown).
 */
export function createTabOrderStore(ctx) {
    const root = () => {
        const es = ctx?.extensionSettings ?? {};
        if (!es.storySuite || typeof es.storySuite !== 'object') es.storySuite = {};
        return es.storySuite;
    };
    return {
        choice: () => readTabChoice(root()[TAB_SETTINGS_KEY]),
        set(next) {
            const clean = readTabChoice(next);
            root()[TAB_SETTINGS_KEY] = clean;
            ctx?.saveSettingsDebounced?.();
            return clean;
        },
        reset() {
            delete root()[TAB_SETTINGS_KEY];
            ctx?.saveSettingsDebounced?.();
            return readTabChoice(null);
        },
    };
}
