// Lines mode: the runtime's normalizer drops an empty `memoryStamps` or `fieldChangeMessages` container a stored dossier has (a stub starts with both), and a later
// memory's or stamp's leaf add then depends on the reply that re-made it (a middle delete of that reply breaks the later one). The view about to be written gets
// the stored empty container back; the shared normalizer is unchanged.
const CONTAINERS = ['memoryStamps', 'fieldChangeMessages'];

export function keepStampContainers(built, slice) {
    for (const [id, record] of Object.entries(built?.npcs ?? {})) {
        if (!record || typeof record !== 'object') continue;
        for (const key of CONTAINERS) {
            const stored = slice?.npcs?.[id]?.[key];
            if (stored && typeof stored === 'object' && !Array.isArray(stored) && !(key in record)) record[key] = {};
        }
    }
    return built;
}
