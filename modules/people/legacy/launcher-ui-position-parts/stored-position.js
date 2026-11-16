/* Saved launcher position: the compact position record and its best-effort storage read and write. */
import { finite } from './shared-number.js';

export function launcherPositionRecord(position = {}) {
    return {
        left: Math.round(finite(position.left)),
        top: Math.round(finite(position.top)),
    };
}

export function readStoredPosition(storage = globalThis.localStorage, storageKey = '') {
    try {
        const parsed = JSON.parse(storage?.getItem?.(storageKey) || 'null');
        if (!parsed || !Number.isFinite(Number(parsed.left)) || !Number.isFinite(Number(parsed.top))) return null;
        return launcherPositionRecord(parsed);
    } catch {
        return null;
    }
}

export function saveStoredPosition(position, storage = globalThis.localStorage, storageKey = '') {
    try { storage?.setItem?.(storageKey, JSON.stringify(launcherPositionRecord(position))); }
    catch { /* UI position persistence is best-effort only. */ }
}
