// Story Director v2, people widget: reads NPC State Delta's in-process handles (dossier opener and present-cast cards), or null.
import { pageHandles } from '../../../people/runtime/handles.js';

/** NPC State Delta's `openDossier(name)` on this page, or null. */
export function dossierOpener() {
    try {
        const api = pageHandles.deltaApi;
        return typeof api?.openDossier === 'function' ? name => api.openDossier(name) : null;
    } catch {
        return null;
    }
}

/** NPC State Delta's cast API for its present-cards (`pageHandles.castApi`), or null. */
export function castApi() {
    try {
        const api = pageHandles.castApi;
        return typeof api?.render === 'function' && typeof api?.onChange === 'function' ? api : null;
    } catch {
        return null;
    }
}
