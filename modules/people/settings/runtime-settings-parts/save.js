// Saving the settings: the immediate save, the coalesced lazy save and the flush of a pending one.

import { getContext } from '../../../../../../../extensions.js';
import { SETTINGS_LAZY_QUIET_MS, SETTINGS_LAZY_MAX_MS } from './save-timing.js';

// Settings changes the reader or a recovery step makes are saved at once (ST's own 1 s debounce). The sidecar pointer that follows
// every dossier write is not urgent: the sidecar path is deterministic and hydration re-reads its revision, so those saves are
// coalesced (SETTINGS_LAZY_QUIET_MS after the last request, never later than SETTINGS_LAZY_MAX_MS after the first) and flushed on
// page hide, chat change and any immediate save. Each save writes ST's whole settings body, so a burst costs one, not one per write.
const lazySave = { timer: null, firstAt: 0 };

function cancelLazySettingsSave() {
    if (lazySave.timer) clearTimeout(lazySave.timer);
    lazySave.timer = null;
    lazySave.firstAt = 0;
}

export function persistSettings() {
    cancelLazySettingsSave();
    const ctx = getContext();
    if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
}

export function persistSettingsLazy() {
    const now = Date.now();
    if (!lazySave.timer) lazySave.firstAt = now;
    else clearTimeout(lazySave.timer);
    const wait = Math.max(0, Math.min(SETTINGS_LAZY_QUIET_MS, lazySave.firstAt + SETTINGS_LAZY_MAX_MS - now));
    lazySave.timer = setTimeout(() => {
        cancelLazySettingsSave();
        // A timer has no caller to take an error: a failed deferred save is logged, not thrown.
        try { persistSettings(); } catch (error) { console.warn('[NPC State Delta] the deferred settings save could not be requested.', error); }
    }, wait);
}

// Page hide, chat change: a pending coalesced save is handed to ST now (its own 1 s debounce starts). Nothing pending, nothing saved.
export function flushPendingSettingsSave() {
    if (!lazySave.timer) return false;
    persistSettings();
    return true;
}
