// Tells whether the suite draws the desktop layout and calls back when that changes: ui/css/desk.css decides (a container query on the suite root), this only reads its answer.

/**
 * Watches `probe` (the tab host's `.su-desk` wrapper) for the desktop flag desk.css sets on it, re-read whenever `root` changes size.
 * Returns `{ on() → boolean, check() → boolean (calls onChange(next) when it flipped), stop() }`; without getComputedStyle or ResizeObserver it stays off.
 */
export function watchDesk({ probe, root, onChange = null } = {}) {
  const view = probe?.ownerDocument?.defaultView ?? null;
  const read = () => {
    try { return String(view?.getComputedStyle?.(probe)?.getPropertyValue?.('--su-desk') ?? '').trim() === '1'; } catch { return false; }
  };
  // Read lazily: a style read while the suite is being built would flush its closed state, and the first open would then animate where it did not before.
  let on = null;
  const current = () => (on === null ? (on = read()) : on);
  const check = () => {
    const next = read();
    if (on === null) on = next;
    else if (next !== on) {
      on = next;
      onChange?.(next);
    }
    return on;
  };
  const Observer = view?.ResizeObserver ?? null;
  const observer = Observer && root ? new Observer(() => check()) : null;
  observer?.observe(root);
  return { on: current, check, stop: () => observer?.disconnect() };
}
