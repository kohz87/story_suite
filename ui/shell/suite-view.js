// Builds the suite root that slides in over the chat, sized from its container and centred over a dimmed chat on desktop.

import { h } from '../kit/dom.js';
import { applyTheme } from '../theme/apply.js';
import { GLASS_DARK } from '../theme/tokens.js';

/**
 * Creates the suite root: a dim layer plus a sliding panel that holds the tab host.
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
    { class: 'su-root', role: 'region', 'aria-label': 'Story Suite' },
    h('div', { class: 'su-back', 'aria-hidden': 'true' }),
    content,
  );
  const layer = h('div', { class: 'su-layer', 'data-state': 'closed', 'aria-hidden': 'true' }, dim, root);
  root.setAttribute('inert', '');

  let open = false;
  let destroyed = false;
  let release = null;

  applyTheme(root, tokens, { scheme });
  host.appendChild(layer);

  function setState(next) {
    open = next;
    layer.setAttribute('data-state', next ? 'open' : 'closed');
    layer.setAttribute('aria-hidden', next ? 'false' : 'true');
    if (next) root.removeAttribute('inert');
    else root.setAttribute('inert', '');
  }

  function openView() {
    if (destroyed || open) return false;
    setState(true);
    if (backStack) {
      release = backStack.push({ id: 'suite', layer: 'suite', close: () => closeView({ fromStack: true }) });
    }
    if (typeof onOpen === 'function') onOpen();
    return true;
  }

  function closeView({ fromStack = false } = {}) {
    if (destroyed || !open) return false;
    setState(false);
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
