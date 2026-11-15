// Reader settings: the status strip switch and the reader's saved screen and card choices.

import { CORE_FEATURE } from '../../features.js';

/**
 * The status strip is on unless the reader turned it off (MODULES §F54): the feature `story-block.hud`
 * when the reader has set it, else the drawer switch older versions kept (`storySuite.hud`).
 */
export function hudOn(extensionSettings) {
    const suite = extensionSettings?.storySuite;
    const choice = suite?.features?.[CORE_FEATURE.hud];
    return typeof choice === 'boolean' ? choice : suite?.hud !== false;
}

/** Reader choices for screens and cards: extension_settings.storySuite.{screens, cards}. */
export function readerStore(ctx) {
    const root = () => {
        const es = ctx.extensionSettings ?? {};
        if (!es.storySuite || typeof es.storySuite !== 'object') es.storySuite = {};
        return es.storySuite;
    };
    return {
        reader: () => ({ screens: root().screens ?? {}, cards: root().cards ?? {} }),
        saveReader(next) {
            root().screens = next.screens ?? {};
            root().cards = next.cards ?? {};
            ctx.saveSettingsDebounced?.();
        },
    };
}
