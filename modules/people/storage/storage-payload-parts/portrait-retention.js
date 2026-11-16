// Which portrait assets a state still needs, and pruning the rest, in place or as a copy.
export function retainedPortraitAssetIds(state = {}) {
    const retained = new Set();
    const addNpcs = value => {
        for (const npc of Array.isArray(value) ? value : []) {
            const id = String(npc?.id || '').trim();
            if (id) retained.add(id);
        }
    };
    addNpcs(state.npcs);
    for (const checkpoint of Array.isArray(state.checkpoints) ? state.checkpoints : []) addNpcs(checkpoint?.snapshot?.npcs);
    addNpcs(state.branchRootSnapshot?.npcs);
    // The reversible rollback journal can be the only remaining proof that an NPC
    // existed before a deep tail deletion once byte-budgeted full checkpoints have
    // been pruned. Keep that NPC's portrait asset reachable until the journal entry
    // itself expires; the journal stores no portrait binary.
    for (const entry of Array.isArray(state.rollbackJournal) ? state.rollbackJournal : []) {
        const npcUndo = entry?.undo?.npcs;
        addNpcs(npcUndo?.full);
        for (const change of Array.isArray(npcUndo?.changes) ? npcUndo.changes : []) {
            if (change?.restore && typeof change.restore === 'object') addNpcs([change.restore]);
        }
    }
    const blocked = new Set((Array.isArray(state.userDismissedGroups) ? state.userDismissedGroups : [])
        .flatMap(group => [...(Array.isArray(group?.ids) ? group.ids : []), group?.npcId])
        .map(value => String(value || '').trim()).filter(Boolean));
    for (const id of blocked) retained.delete(id);
    return retained;
}

export function prunePortraitAssetsForState(state = {}) {
    const assets = state?.portraitAssets && typeof state.portraitAssets === 'object' ? state.portraitAssets : {};
    const retained = retainedPortraitAssetIds(state);
    return Object.fromEntries(Object.entries(assets).filter(([id, portrait]) => retained.has(String(id)) && portrait?.dataUrl));
}

// Form portraits share the main portrait retention rule: they stay while any live, checkpointed
// or journal-restorable record of that NPC can still show them.
export function pruneFormPortraitAssetsForState(state = {}) {
    const assets = state?.formPortraitAssets && typeof state.formPortraitAssets === 'object' ? state.formPortraitAssets : {};
    const retained = retainedPortraitAssetIds(state);
    const out = {};
    for (const [id, forms] of Object.entries(assets)) {
        if (!retained.has(String(id)) || !forms || typeof forms !== 'object') continue;
        const kept = Object.entries(forms).filter(([, portrait]) => portrait?.dataUrl).slice(0, 8);
        if (kept.length) out[id] = Object.fromEntries(kept);
    }
    return out;
}

export function prunePortraitAssetsInPlace(state = {}) {
    if (!state || typeof state !== 'object') return state;
    state.portraitAssets = prunePortraitAssetsForState(state);
    if (state.formPortraitAssets && typeof state.formPortraitAssets === 'object') state.formPortraitAssets = pruneFormPortraitAssetsForState(state);
    return state;
}
