/* Rename state check: whether a chat state holds nothing worth carrying over a rename. */

export function lifecycleRenameStateIsEmpty(state) {
    if (!state || typeof state !== 'object') return true;
    const graph = state.socialGraph && typeof state.socialGraph === 'object' ? state.socialGraph : {};
    const portraits = [state.portraitAssets, state.formPortraitAssets]
        .some(assets => assets && typeof assets === 'object' && Object.keys(assets).length > 0);
    return !(state.npcs?.length
        || state.candidates?.length
        || state.dismissed?.length
        || state.userDismissedGroups?.length
        || state.pendingBackfills?.length
        || graph.edges?.length
        || graph.unresolved?.length
        || portraits);
}
