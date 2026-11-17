// The waiting fight between the RPG's pause controller and the Suite view: two page events. The Suite view reads and answers the waiting choice through
// HOLD_EVENT, and claims the Fight screen through SCREEN_EVENT, so the old view's screen does not open while the Suite view is shown.
// Without a Suite view on the page nobody answers either event: the old view's pause and screen work as before.

import { foeStats } from '../combat/foes.js';

/** `{ op, answer }`: op 'view' answers the waiting choice; 'board', 'auto', 'plain', 'send' and 'discard' run the reader's answer and give the new view. */
export const HOLD_EVENT = 'story-suite:fight-hold';
/** `{ id, handled }`: a screen the old view is about to open; a view that shows it itself sets `handled`. */
export const SCREEN_EVENT = 'story-suite:screen';

const OPS = ['board', 'auto', 'plain', 'send', 'discard'];

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
 * Returns the function that stops answering.
 */
export function attachHoldBridge({ doc, start, discard = () => {} }) {
    const view = () => {
        const info = start.info();
        return info ? { ...info, foes: (info.foes ?? []).map(foe => ({ ...foe, hp: foeStats(foe).hp })) } : null;
    };
    const run = op => {
        if (op === 'board') start.board();
        else if (op === 'auto') start.auto();
        else if (op === 'plain') start.plain();
        else if (op === 'send') start.send();
        else if (op === 'discard') start.discard(discard);
    };
    const answer = event => {
        const detail = event?.detail;
        if (!detail || typeof detail !== 'object') return;
        try {
            if (OPS.includes(detail.op)) run(detail.op);
            else if (detail.op !== 'view') return;
            detail.answer = view();
            detail.handled = true;
        } catch (error) {
            detail.handled = true;
            detail.error = String(error?.message ?? error);
        }
    };
    doc?.addEventListener?.(HOLD_EVENT, answer);
    return () => doc?.removeEventListener?.(HOLD_EVENT, answer);
}
