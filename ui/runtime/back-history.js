// Lets the browser's Back (a phone's Back button or gesture too) walk the suite's back-stack the way Escape does: one Back closes the
// top window (a menu, a sheet, the dossier, Settings, then the suite), and the page is never left while something of the suite is open.

const MARK = 'storySuiteBack';

/**
 * Keeps one history entry of its own while the suite is open (`backStack`, runtime/back-stack.js, has its `suite` entry); `win` is the page's window.
 * (a window left on the stack under a closed suite does not count: Back then leaves the page as before)
 * Back takes that entry off: the top of the stack is closed and, while something is still open (or the close was refused), the entry is put back.
 * When the suite closes another way (Escape, a × button, a chat change) the entry is taken off with `history.back()`, and that one popstate is not
 * read as a Back. → the function that stops it (a page without a history API gets a no-op).
 */
export function bindBackHistory(backStack, win) {
  const hist = win?.history;
  if (typeof backStack?.watch !== 'function' || typeof hist?.pushState !== 'function' || typeof win?.addEventListener !== 'function') return () => {};
  let armed = false;      // our entry is in the history, on top
  let unwinding = false;  // history.back() was called to take it off: the popstate that comes is ours
  let queued = false;
  let stopped = false;
  const ours = () => { try { return hist.state?.[MARK] === true; } catch { return false; } };

  // (read once the stack settles: a close that pushes or removes on its way must not add and take entries in between)
  function sync() {
    queued = false;
    if (stopped || unwinding) return;
    const want = backStack.hasLayer('suite');
    if (want && !armed) {
      hist.pushState({ [MARK]: true }, '');
      armed = true;
    } else if (!want && armed) {
      armed = false;
      if (ours()) { unwinding = true; hist.back(); }
    }
  }
  const later = () => {
    if (queued || stopped) return;
    queued = true;
    queueMicrotask(sync);
  };
  function onPop() {
    if (stopped) return;
    if (unwinding) { unwinding = false; later(); return; }
    if (!armed) return;
    armed = false;   // the browser took our entry off: that was a Back
    backStack.pop();
    later();
  }

  const offWatch = backStack.watch(later);
  win.addEventListener('popstate', onPop);
  later();
  // (an entry still in the history stays: taking it off here could land after a new mount's own entry and close that one)
  return () => {
    stopped = true;
    offWatch();
    win.removeEventListener?.('popstate', onPop);
  };
}
