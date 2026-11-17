// The new view's side of the waiting fight (modules/rpg/board/hold-bridge.js): reads and answers the pause through its page event, and shows the Fight screen the old view would open.

import { HOLD_EVENT, SCREEN_EVENT } from '../../modules/rpg/board/hold-bridge.js';

const ask = (doc, op) => {
  if (typeof doc?.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return null;
  const detail = { op, answer: null, handled: false };
  try { doc.dispatchEvent(new globalThis.CustomEvent(HOLD_EVENT, { detail })); } catch { return null; }
  return detail;
};

/** `{ view(), choose(op) }` on `doc`: `view()` → the waiting choice (null when none waits or the RPG screens are not loaded); `choose(op)` → `{ ok, view }` or `{ ok: false, message }`. */
export function createHold(doc = globalThis.document) {
  return Object.freeze({
    view: () => ask(doc, 'view')?.answer ?? null,
    choose(op) {
      const detail = ask(doc, op);
      if (!detail?.handled) return { ok: false, code: 'FAILED', message: 'The waiting fight cannot be reached.' };
      if (detail.error) return { ok: false, code: 'FAILED', message: detail.error };
      return { ok: true, view: detail.answer };
    },
  });
}

/** Shows the screens `show(id)` takes instead of the old view: `show` returns true for one it showed. Returns the function that stops. */
export function showScreens(doc, show) {
  const on = event => { const detail = event?.detail; if (detail && !detail.handled && show(detail.id) === true) detail.handled = true; };
  doc?.addEventListener?.(SCREEN_EVENT, on);
  return () => doc?.removeEventListener?.(SCREEN_EVENT, on);
}
