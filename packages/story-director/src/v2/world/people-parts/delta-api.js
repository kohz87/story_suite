// Story Director v2, people widget: reads NPC State Delta's page API (dossier opener and present-cast cards), or null.

/** NPC State Delta's `openDossier(name)` on this page, or null. */
export function dossierOpener() {
    try {
        const api = globalThis.NPCStateDelta;
        return typeof api?.openDossier === 'function' ? name => api.openDossier(name) : null;
    } catch {
        return null;
    }
}

/** NPC State Delta's page API for its present-cast cards (`globalThis.NPCStateDeltaCast`), or null. */
export function castApi() {
    try {
        const api = globalThis.NPCStateDeltaCast;
        return typeof api?.render === 'function' && typeof api?.onChange === 'function' ? api : null;
    } catch {
        return null;
    }
}
