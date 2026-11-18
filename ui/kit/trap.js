// Keeps Tab inside a modal window (a sheet, the dossier): from its last control Tab goes to the first, Shift+Tab from the first to the last.

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]';

// (a control that is disabled, hidden, out of the Tab order, or not drawn at all — display: none, in a real browser — is skipped)
const reachable = node => node.disabled !== true && !node.hasAttribute?.('disabled') && !node.hasAttribute?.('hidden') && node.getAttribute?.('tabindex') !== '-1'
  && (typeof node.getClientRects !== 'function' || node.getClientRects().length > 0);

/**
 * → a keydown listener for `panel` (add it on the panel or an element around it). `isOn()` says whether the window is still open.
 * Focus from outside the panel is pulled in to its first control (its last with Shift); a panel with no control keeps Tab from leaving.
 */
export function tabTrap(panel, { doc = panel?.ownerDocument ?? globalThis.document, isOn = () => true } = {}) {
  return function keep(event) {
    if (event.key !== 'Tab' || !isOn()) return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter(reachable);
    const active = doc?.activeElement ?? null;
    const inside = active && panel.contains?.(active);
    const end = event.shiftKey ? items[0] : items.at(-1);
    if (!items.length) { event.preventDefault?.(); return; }
    if (!inside || active === end) { event.preventDefault?.(); (event.shiftKey ? items.at(-1) : items[0]).focus(); }
  };
}
