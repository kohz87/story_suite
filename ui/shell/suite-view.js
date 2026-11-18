// Builds the suite root over the chat: it slides in from the edge on phone and tablet, and on desktop opens in place (fade + slight scale) over a dimmed chat (ui/css/shell.css).

import { h } from '../kit/dom.js';
import { applyTheme } from '../theme/apply.js';
import { GLASS_DARK } from '../theme/tokens.js';

// The page behind is made inert while the suite covers it; these are left alone: no box to reach (script, style and the like),
// a native dialog, and the live regions that announce or show messages (SillyTavern's toasts).
const KEEP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'DIALOG']);
const keepLive = node => KEEP.has(String(node.tagName ?? '').toUpperCase()) || node.id === 'toast-container' || node.hasAttribute?.('aria-live') || ['alert', 'status'].includes(node.getAttribute?.('role'));

/**
 * Creates the suite root: a dim layer plus a panel (slide on phone and tablet, fade on desktop) that holds the tab host.
 * Options: `doc`, `host` (where the layer mounts), `backStack` (optional), `tokens`, `scheme`, `onOpen`, `onClose`.
 */
export function createSuiteView(options = {}) {
  const {
    doc = globalThis.document,
    host = doc.body,
    backStack = null,
    tokens = GLASS_DARK,
    scheme = 'dark',
    onOpen = null,
    onClose = null,
  } = options;

  const dim = h('div', { class: 'su-dim', 'aria-hidden': 'true' });
  const content = h('div', { class: 'su-content' });
  const root = h(
    'section',
    { class: 'su-root', role: 'region', 'aria-label': 'Story Suite', tabindex: '-1' },
    h('div', { class: 'su-back', 'aria-hidden': 'true' }),
    content,
  );
  const layer = h('div', { class: 'su-layer', 'data-state': 'closed', 'aria-hidden': 'true' }, dim, root);
  root.setAttribute('inert', '');

  let open = false;
  let destroyed = false;
  let release = null;
  let opener = null;   // what had the focus before the suite opened: it gets it back on close
  let stilled = [];    // the page's elements this view made inert (none that were inert already)

  applyTheme(root, tokens, { scheme });
  host.appendChild(layer);

  function setState(next) {
    open = next;
    layer.setAttribute('data-state', next ? 'open' : 'closed');
    layer.setAttribute('aria-hidden', next ? 'false' : 'true');
    if (next) root.removeAttribute('inert');
    else root.setAttribute('inert', '');
  }

  // The page behind the suite: inert while it is open, so Tab and a screen reader stay in the suite; closing gives back exactly what it took.
  function stillPage() {
    stilled = [...(host.children ?? [])].filter(node => node !== layer && !keepLive(node) && !node.hasAttribute?.('inert'));
    for (const node of stilled) node.setAttribute('inert', '');
  }
  function wakePage() {
    for (const node of stilled) node.removeAttribute('inert');
    stilled = [];
  }

  function openView() {
    if (destroyed || open) return false;
    opener = doc.activeElement ?? null;
    stillPage();
    setState(true);
    root.focus?.({ preventScroll: true });
    if (backStack) {
      release = backStack.push({ id: 'suite', layer: 'suite', close: () => closeView({ fromStack: true }) });
    }
    if (typeof onOpen === 'function') onOpen();
    return true;
  }

  function closeView({ fromStack = false } = {}) {
    if (destroyed || !open) return false;
    const active = doc.activeElement ?? null;
    const mine = !active || active === doc.body || layer.contains?.(active) === true;
    wakePage();
    setState(false);
    // (the focus goes back to the opener when it was in the suite or nowhere, and the opener is still on the page)
    if (mine && opener && opener !== doc.body && doc.body?.contains?.(opener)) opener.focus?.({ preventScroll: true });
    opener = null;
    if (release && !fromStack) release();
    release = null;
    if (typeof onClose === 'function') onClose();
    return true;
  }

  dim.addEventListener('click', () => closeView());

  return {
    root,
    layer,
    content,
    open: openView,
    close: closeView,
    isOpen: () => open,
    setTheme(nextTokens, nextScheme) {
      return applyTheme(root, nextTokens, { scheme: nextScheme });
    },
    destroy() {
      if (destroyed) return;
      if (open) closeView();
      destroyed = true;
      layer.remove();
    },
  };
}
