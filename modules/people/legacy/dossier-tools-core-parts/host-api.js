/* NPC State Delta supporting tools: access to the runtime API, the dossier root and the overlay host element. */
const DOSSIER_ROOT_ID = 'npc_state_delta_dossier_root';

export function api() { return globalThis.NPCStateDelta || null; }
export function uiRoot() { return document.getElementById(DOSSIER_ROOT_ID); }
export function overlayMountHost() { return globalThis.document?.body || null; }
export function modalTopLayerSupported(doc = globalThis.document) {
    const dialog = doc?.createElement?.('dialog');
    return Boolean(dialog && typeof dialog.showModal === 'function');
}
