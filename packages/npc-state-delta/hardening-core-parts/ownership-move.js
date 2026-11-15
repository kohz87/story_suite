/* Canonical ownership move: re-points data, tombstone and recovery entries from an old chat key to a new one. */

export function applyCanonicalOwnershipMove(config = {}, { oldKey = '', newKey = '', newPointer = null, recoveryPointer = null, reason = 'renamed' } = {}) {
    if (!oldKey || !newKey || oldKey === newKey) return config;
    for (const name of ['dataFiles', 'sidecarTombstones', 'recoveryFiles']) {
        if (!config[name] || typeof config[name] !== 'object') config[name] = {};
    }
    if (recoveryPointer) config.recoveryFiles[oldKey] = recoveryPointer;
    config.sidecarTombstones[oldKey] = { reason: `${String(reason || 'renamed')}:${newKey}`, at: Date.now() };
    const predecessorTombstone = config.sidecarTombstones?.[oldKey] || null;
    if (newPointer) {
        config.dataFiles[newKey] = newPointer;
        // Only a verified live sidecar may supersede a previous retirement marker. Tombstone-only
        // history must never clear an unrelated destination tombstone during an owner rename.
        delete config.sidecarTombstones[newKey];
    } else if (predecessorTombstone && !config.dataFiles?.[newKey] && !config.sidecarTombstones[newKey]) {
        config.sidecarTombstones[newKey] = {
            ...structuredClone(predecessorTombstone),
            reason: `${String(reason || 'renamed')}-retired:${oldKey}`,
            at: Date.now(),
        };
    }    delete config.dataFiles[oldKey];    return config;
}
