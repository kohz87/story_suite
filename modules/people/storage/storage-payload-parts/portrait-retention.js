// Which portrait assets a state still needs, and pruning the rest, in place or as a copy.
// `keepHeld`: also keep the pictures of people the state no longer holds (while the store holds the chat it can bring them back with a swipe,
// a swipe back or a delete, and their form pictures live only here); a person the reader deleted (a user-dismissed group) still loses them.
export function retainedPortraitAssetIds(state = {}, { keepHeld = false } = {}) {
    const retained = new Set();
    const addNpcs = value => {
        for (const npc of Array.isArray(value) ? value : []) {
            const id = String(npc?.id || '').trim();
            if (id) retained.add(id);
        }
    };
    addNpcs(state.npcs);
    if (keepHeld) {
        for (const assets of [state.portraitAssets, state.formPortraitAssets]) {
            for (const id of Object.keys(assets && typeof assets === 'object' ? assets : {})) retained.add(id);
        }
    }
    const blocked = new Set((Array.isArray(state.userDismissedGroups) ? state.userDismissedGroups : [])
        .flatMap(group => [...(Array.isArray(group?.ids) ? group.ids : []), group?.npcId])
        .map(value => String(value || '').trim()).filter(Boolean));
    for (const id of blocked) retained.delete(id);
    return retained;
}

export function prunePortraitAssetsForState(state = {}, options = {}) {
    const assets = state?.portraitAssets && typeof state.portraitAssets === 'object' ? state.portraitAssets : {};
    const retained = retainedPortraitAssetIds(state, options);
    return Object.fromEntries(Object.entries(assets).filter(([id, portrait]) => retained.has(String(id)) && portrait?.dataUrl));
}

// Form portraits share the main portrait retention rule.
export function pruneFormPortraitAssetsForState(state = {}, options = {}) {
    const assets = state?.formPortraitAssets && typeof state.formPortraitAssets === 'object' ? state.formPortraitAssets : {};
    const retained = retainedPortraitAssetIds(state, options);
    const out = {};
    for (const [id, forms] of Object.entries(assets)) {
        if (!retained.has(String(id)) || !forms || typeof forms !== 'object') continue;
        const kept = Object.entries(forms).filter(([, portrait]) => portrait?.dataUrl).slice(0, 8);
        if (kept.length) out[id] = Object.fromEntries(kept);
    }
    return out;
}

export function prunePortraitAssetsInPlace(state = {}, options = {}) {
    if (!state || typeof state !== 'object') return state;
    state.portraitAssets = prunePortraitAssetsForState(state, options);
    if (state.formPortraitAssets && typeof state.formPortraitAssets === 'object') state.formPortraitAssets = pruneFormPortraitAssetsForState(state, options);
    return state;
}
