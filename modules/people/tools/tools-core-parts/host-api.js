/* NPC State supporting tools: access to the runtime API and the overlay host element. */
import { pageHandles } from '../../runtime/handles.js';

export function api() { return pageHandles.deltaApi; }
export function overlayMountHost() { return globalThis.document?.body || null; }
export function modalTopLayerSupported(doc = globalThis.document) {
    const dialog = doc?.createElement?.('dialog');
    return Boolean(dialog && typeof dialog.showModal === 'function');
}
