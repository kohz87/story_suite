// Greys out a section page's setting rows while that section's module card is off, with one line saying why.
import { h } from '../kit/dom.js';

const CONTROLS = 'button,input,select,textarea';

/** The one line shown above a greyed page. */
export function offNote(name) {
  return h('p', { class: 'fine offnote', role: 'status' }, `${name} is off, so these settings do nothing. Turn it on above to change them.`);
}

/**
 * Disables every row (and its controls) under `nodes`, except the module card (`.mods`).
 * Returns the nodes with `offNote(name)` placed first. Rows are read-only until the card is switched on again (the page is drawn again then).
 */
export function greyOut(nodes, name) {
  const out = [];
  for (const node of nodes) {
    if (node?.classList?.contains('mods') || !node?.querySelectorAll) { out.push(node); continue; }
    const rows = node.classList.contains('srow') ? [node] : node.querySelectorAll('.srow');
    for (const row of rows) {
      row.classList.add('dis');
      row.setAttribute('aria-disabled', 'true');
    }
    for (const el of [...(node.matches?.(CONTROLS) ? [node] : []), ...node.querySelectorAll(CONTROLS)]) {
      el.setAttribute('disabled', '');
    }
    out.push(node);
  }
  const at = out.findIndex(n => n?.classList?.contains('mods'));
  out.splice(at + 1, 0, offNote(name));
  return out;
}
