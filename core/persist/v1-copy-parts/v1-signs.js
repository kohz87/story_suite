// V1 signs: tells whether a page object or settings drawer belongs to an old copy of Story Block (version 1).

// v1's settings drawer (v1's `index.js`, on the `v1` branch): its Rescan button and its display and money pickers.
const V1_IDS = ['story_block_rescan', 'story_block_display', 'story_block_money'];

/** True when `api` is v1's public object (v1's `index.js`, on the `v1` branch: frozen, apiVersion 1, listBlocks / getBlock / registerBlock). */
export function isV1Api(api) {
    if (!api || typeof api !== 'object') return false;
    try {
        return api.apiVersion === 1 && !api.sdk && ['listBlocks', 'getBlock', 'registerBlock'].every(name => typeof api[name] === 'function');
    } catch {
        return false;
    }
}

/** True when the page shows v1's settings drawer. */
export function hasV1Settings(doc) {
    try {
        return V1_IDS.some(id => !!doc?.getElementById?.(id));
    } catch {
        return false;
    }
}
