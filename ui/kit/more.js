// Shows the first few rows of a list and a "Show all N" / "Show fewer" button for the rest.
import { h } from './dom.js';
import { button } from './controls.js';

/** Builds a list that shows `limit` rows, then a toggle for the rest; `render(item, index)` returns a row element. */
export function moreList({ items = [], render, limit = 5, className, expanded = false, onToggle } = {}) {
  if (typeof render !== 'function') throw new TypeError('moreList needs a render function');
  const rows = Array.isArray(items) ? items : [];
  const list = h('div', { class: 'more-list' });
  const foot = h('div', { class: 'more-foot' });
  const root = h('div', { class: ['more', className] }, list, foot);
  let open = Boolean(expanded);

  function draw() {
    const shown = open ? rows : rows.slice(0, limit);
    list.replaceChildren(...shown.map((item, index) => render(item, index)));
    root.dataset.expanded = String(open);
    if (rows.length <= limit) {
      foot.replaceChildren();
      return;
    }
    foot.replaceChildren(button({
      label: open ? 'Show fewer' : `Show all ${rows.length}`,
      className: 'more-btn',
      pressed: open,
      onClick: () => {
        open = !open;
        draw();
        if (typeof onToggle === 'function') onToggle(open);
      },
    }));
  }

  draw();
  return root;
}
