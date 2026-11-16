// Lines mode: the runtime's normalizer drops an empty `memoryStamps` container a stored dossier has, and a later memory's leaf add then depends on the reply that
// re-made it (a middle delete of that reply breaks the later one). The view about to be written gets the stored empty container back; the shared normalizer is unchanged.
export function keepStampContainers(built, slice) {
    for (const [id, record] of Object.entries(built?.npcs ?? {})) {
        const stored = slice?.npcs?.[id]?.memoryStamps;
        if (stored && typeof stored === 'object' && !Array.isArray(stored) && record && typeof record === 'object' && !('memoryStamps' in record)) record.memoryStamps = {};
    }
    return built;
}
