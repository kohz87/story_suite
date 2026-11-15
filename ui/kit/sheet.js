// Opens the shared bottom sheet (dim backdrop, grab bar, optional title row) that closes by backdrop, Escape or its close button.
import { h } from './dom.js';

/**
 * Opens a sheet and returns `{ el, body, close }`; ctx = { doc, backStack, sheetHost }.
 * Options: `title` (header row with a × button; leave empty when the content has its own header), `label` (aria-label), `id` (back-stack id).
 * Closing is safe to repeat; the back-stack gets one `sheet` entry and focus returns to the opener.
 */
export function openSheet(ctx = {}, { title = '', label = null, id = 'sheet', onClose = null } = {}) {
  const doc = ctx.doc ?? globalThis.document;
  const opener = doc.activeElement ?? null;
  const body = h('div', { class: 'sh-body' });
  const closeBtn = title
    ? h('button', { type: 'button', class: 'x sh-x', 'aria-label': 'Close' }, '×')
    : null;
  const panel = h(
    'div',
    { class: 'sh-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': label ?? (title || 'Sheet') },
    h('span', { class: 'grab' }),
    title ? h('div', { class: 'sh-h' }, h('h3', null, title), closeBtn) : null,
    body,
  );
  const el = h('div', { class: 'sh-ov', dataset: { sheet: id } }, panel);
  const host = ctx.sheetHost ?? doc.querySelector?.('.su-root') ?? doc.body;
  let release = null;
  let open = true;

  function finish() {
    open = false;
    el.remove();
    opener?.focus?.();
    onClose?.();
  }
  function close() {
    if (!open) return false;
    release?.();
    finish();
    return true;
  }

  el.addEventListener('click', event => { if (event.target === el) close(); });
  closeBtn?.addEventListener('click', close);
  host.appendChild(el);
  release = ctx.backStack?.push({ id, layer: 'sheet', close: () => { finish(); } }) ?? null;
  closeBtn?.focus?.();
  return { el, body, close };
}
