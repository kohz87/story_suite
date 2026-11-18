// The waiting fight between the RPG's pause controller and the Suite view: two page events. The Suite view reads and answers the waiting choice through
// HOLD_EVENT, and claims the Fight screen through SCREEN_EVENT, so the old view's screen does not open while the Suite view is shown.
// Without a Suite view on the page nobody answers either event: the old view's pause and screen work as before.

import { foeStats } from '../combat/foes.js';

/** `{ op, answer }`: op 'view' answers the waiting choice; 'board', 'auto', 'plain', 'send' and 'discard' run the reader's answer and give the new view; 'restore' (with `origin`, the reply a discarded fight was opened on) gives the offer back that the fight's choice had marked done. The bridge itself sends op 'changed' when it starts or stops answering and when the pause changes. */
export const HOLD_EVENT = 'story-suite:fight-hold';
/** `{ id, handled }`: a screen the old view is about to open; a view that shows it itself sets `handled`. */
export const SCREEN_EVENT = 'story-suite:screen';

const OPS = ['board', 'auto', 'plain', 'send', 'discard', 'restore'];

/** Tells the page the waiting choice (the pause or the standing-foes offer) changed or can now be read. */
function notifyHold(doc) {
    if (typeof doc?.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
    try { doc.dispatchEvent(new globalThis.CustomEvent(HOLD_EVENT, { detail: { op: 'changed' } })); } catch { /* a listener that throws is the page's */ }
}

/** Asks the page whether another view shows screen `id` (it sets `handled`). True when one did. */
export function claimScreen(doc, id) {
    if (typeof doc?.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return false;
    const detail = { id, handled: false };
    try { doc.dispatchEvent(new globalThis.CustomEvent(SCREEN_EVENT, { detail })); } catch { return false; }
    return detail.handled === true;
}

/**
 * Answers HOLD_EVENT on `doc` from the pause controller `start` (board/start-controller.js). `discard()` throws the open fight away the way the
 * board's Discard fight does (the controller puts the waiting choice back). Each foe group of the view carries its full health (`hp`, Combat Rules v1).
 * `offers` (board/offers.js) is the offer for foes left standing without the reader's attack: with no pause waiting the view is that offer's
 * (`offer: true`) and 'board' / 'auto' answer it, as the old line's two buttons do. Returns the function that stops answering.
 */
export function attachHoldBridge({ doc, start, discard = () => {}, offers = null }) {
    const view = () => {
        const info = start.info() ?? offers?.info?.() ?? null;
        return info ? { ...info, foes: (info.foes ?? []).map(foe => ({ ...foe, hp: foeStats(foe).hp })) } : null;
    };
    const run = (op, origin) => {
        const offered = (op === 'board' || op === 'auto') && !start.info() && offers?.info?.();
        if (offered) offers.answer(op);
        else if (op === 'board') start.board();
        else if (op === 'auto') start.auto();
        else if (op === 'plain') start.plain();
        else if (op === 'send') start.send();
        else if (op === 'discard') start.discard(discard);
        else if (op === 'restore') offers?.restore?.(origin);
    };
    const answer = event => {
        const detail = event?.detail;
        if (!detail || typeof detail !== 'object') return;
        try {
            if (OPS.includes(detail.op)) run(detail.op, detail.origin);
            else if (detail.op !== 'view') return;
            detail.answer = view();
            detail.handled = true;
        } catch (error) {
            detail.handled = true;
            detail.error = String(error?.message ?? error);
        }
    };
    // (a view mounted before the RPG screens loaded, or a reload into a waiting fight, reads the pause again when it can be read)
    const changed = () => notifyHold(doc);
    doc?.addEventListener?.(HOLD_EVENT, answer);
    const unlisten = start.listen?.(changed), unoffer = offers?.listen?.(changed);
    changed();
    return () => { doc?.removeEventListener?.(HOLD_EVENT, answer); unlisten?.(); unoffer?.(); changed(); };
}
