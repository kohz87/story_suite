// Builds the foldable "Inner chatter · N" block inside a reply: a header with a chevron, then one row per person: **Name:** “thought” between quote icons.
import { h } from '../kit/dom.js';

/** The block for one reply's `lines` ([{ name, text }]), or null when there are none; `open` unfolds it, `onToggle(open)` hears the header's click. Drawn in the page only. */
export function chatterBlock(lines, { open = false, onToggle = () => {} } = {}) {
  const list = (Array.isArray(lines) ? lines : []).filter(row => row?.name && row?.text);
  if (!list.length) return null;
  // (SillyTavern's Font Awesome quote glyphs, hidden from a screen reader: the <q> already says it is a quote)
  const mark = side => h('i', { class: `fa-solid fa-quote-${side} ssch-qm`, 'aria-hidden': 'true' });
  const body = h('div', { class: 'ssch-body' }, list.map(row => h('p', { class: 'ssch-row' }, h('b', `${row.name}:`), ' ', mark('left'), h('q', { class: 'ssch-q' }, row.text), mark('right'))));
  const head = h('button', { type: 'button', class: 'ssch-head', 'aria-expanded': String(open), onClick: () => onToggle(!open) },
    h('span', { class: 'ssch-t' }, `Inner chatter · ${list.length}`), h('span', { class: 'ssch-cv', 'aria-hidden': 'true' }, open ? '▴' : '▾'));
  if (!open) body.setAttribute('hidden', '');
  return h('div', { class: 'ssch', dataset: { ssChatter: '1' } }, head, body);
}
