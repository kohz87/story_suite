// Story Suite v2: sealing old story history at a quiet moment (docs/dev/saves-and-persist.md "Sealed history"). After a reply has settled
// or a chat was opened (a long chat from before this build seals on its first quiet moment, RETENTION §5),
// a timer waits until the turn is idle, nothing is being generated or held, and the reply's own save has gone out; then the store seals what
// is due (at most once per step of replies: store/write/seal.js) and the chat is saved once more. The host setting `sealHistory` (default on)
// turns it off: nothing new is sealed, and a chat sealed before still reads.

import { IDLE_MS } from '../persist.js';
import { HISTORY_STRINGS } from '../strings/history.js';

/** How long after a reply the seal is first tried; each later try waits as long again while the chat is busy (at most `SEAL_TRIES` times). */
export const SEAL_WAIT_MS = 2 * IDLE_MS;
const SEAL_TRIES = 8;

export function createSealIdle(s, { store, problem, hostSettings, metadata = () => null, timers = globalThis }) {
    let timer = null;
    let tries = 0;

    const on = () => { try { return hostSettings()?.sealHistory !== false; } catch { return true; } };
    // (an interaction or fight still open in the chat's metadata is a hold too: core/interaction/)
    const open = () => { try { return Boolean(metadata()?.storySuiteInteraction?.open); } catch { return false; } };
    const busy = () => s.replyBusy === true || Boolean(s.heldReply) || Boolean(s.assistPending) || open() || store.inFlight?.() === true || store.dirty?.() === true
        || store.suspect?.() === true || store.readOnly?.() !== null;

    function cancel() {
        if (timer !== null) timers.clearTimeout(timer);
        timer = null;
    }

    function tryNow() {
        timer = null;
        if (!on()) return;
        if (busy()) {
            if (++tries < SEAL_TRIES) arm();
            return;
        }
        let out;
        try { out = store.seal(); } catch (error) { out = { ok: false, why: String(error?.message ?? error), refused: true }; }
        if (out?.ok && out.sealed > 0) {
            try { store.saveSoon?.(); } catch { /* the store tells its own save failure */ }
        } else if (out?.refused) {
            problem({ module: 'story-block', code: 'SEAL_SKIPPED', message: `${HISTORY_STRINGS.sealSkipped} (${out.why})`, quiet: true });
        }
    }

    function arm() {
        cancel();
        timer = timers.setTimeout(tryNow, SEAL_WAIT_MS);
        timer?.unref?.();
    }

    /** A reply settled or a chat was opened: try to seal at the next quiet moment (a later reply moves the moment on). */
    function afterReply() {
        if (!on()) return;
        tries = 0;
        arm();
    }

    return { afterReply, cancel, tryNow };
}
