// Adapted from ui/kit/controls.js (keep in step when that file changes). The suite's button and segmented control (tabs), the same classes; no icons.
import { h } from './dom.js';

const joinClass = (...parts) => parts.filter(Boolean).join(' ');

/** Creates a button in the suite's button family (default, primary or danger). */
export function button({ label, tone = 'default', disabled = false, type = 'button', className, title, ariaLabel, dataset, onClick } = {}) {
  const mod = tone === 'primary' ? 'pri' : tone === 'danger' ? 'dng' : null;
  return h('button', { type, class: joinClass('btn2', mod, className), disabled: Boolean(disabled), title: title ?? null, 'aria-label': ariaLabel ?? null, dataset, onClick }, label);
}

/** Creates a segmented control (a group or a tablist) of mutually exclusive options: `items` are { value, label }. */
export function segmented({ items = [], value, role = 'group', label, className, onChange } = {}) {
  const isTablist = role === 'tablist';
  const activeAttr = isTablist ? 'aria-selected' : 'aria-pressed';
  const buttons = [];
  const pick = (at, event) => {
    if (!items[at]) return;
    buttons.forEach((btn, i) => btn.setAttribute(activeAttr, String(i === at)));
    if (typeof onChange === 'function') onChange(items[at].value, items[at], event);
  };
  const container = h('div', { class: joinClass('seg', className), role, 'aria-label': label ?? null });
  items.forEach((item, at) => {
    const btn = h('button', { type: 'button', role: isTablist ? 'tab' : null, [activeAttr]: String(item.value === value), dataset: { value: String(item.value) }, onClick: event => pick(at, event),
      onKeydown: event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const next = (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
        pick(next, event);
      } }, item.label);
    buttons.push(btn);
    container.appendChild(btn);
  });
  return container;
}
