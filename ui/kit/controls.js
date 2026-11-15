// Provides the suite's single control family: button, chip, switch toggle and segmented control.
import { h } from './dom.js';
import { glyph } from './glyphs.js';

function resolveIcon(icon) {
  if (!icon) return null;
  return typeof icon === 'string' ? glyph(icon) : icon;
}

function joinClass(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Creates a button in the suite's single button family (default, primary, danger or icon). */
export function button(opts = {}) {
  const {
    label,
    icon,
    tone = 'default',
    disabled = false,
    pressed,
    type = 'button',
    className,
    title,
    ariaLabel,
    dataset,
    onClick,
  } = opts;

  const base = tone === 'icon' ? 'ibtn' : 'btn2';
  const mod = tone === 'primary' ? 'pri' : tone === 'danger' ? 'dng' : null;
  return h(
    'button',
    {
      type,
      class: joinClass(base, mod, className),
      disabled: Boolean(disabled),
      'aria-pressed': pressed !== undefined ? String(Boolean(pressed)) : null,
      'aria-label': ariaLabel ?? (tone === 'icon' && label ? label : null),
      title: title ?? null,
      dataset,
      onClick,
    },
    resolveIcon(icon),
    tone === 'icon' ? null : label,
  );
}

/** Creates a chip: a button with aria-pressed when interactive, or a non-interactive status span. */
export function chip(opts = {}) {
  const {
    label,
    icon,
    tone,
    pressed,
    disabled = false,
    className,
    title,
    ariaLabel,
    dataset,
    onClick,
  } = opts;

  const interactive = typeof onClick === 'function' || pressed !== undefined;
  const tag = interactive ? 'button' : 'span';
  return h(
    tag,
    {
      type: interactive ? 'button' : null,
      class: joinClass('chip2', tone, className),
      disabled: interactive && disabled ? true : null,
      'aria-pressed': interactive ? String(Boolean(pressed)) : null,
      'aria-label': ariaLabel ?? null,
      title: title ?? null,
      dataset,
      onClick: interactive ? onClick : null,
    },
    resolveIcon(icon),
    label,
  );
}

/** Creates a switch control (role="switch") that toggles aria-checked on click. */
export function toggle(opts = {}) {
  const {
    checked = false,
    label,
    labelledBy,
    disabled = false,
    className,
    dataset,
    onChange,
  } = opts;

  const el = h('button', {
    type: 'button',
    class: joinClass('sw', className),
    role: 'switch',
    'aria-checked': String(Boolean(checked)),
    'aria-label': label ?? null,
    'aria-labelledby': labelledBy ?? null,
    disabled: Boolean(disabled),
    dataset,
  });

  el.addEventListener('click', (event) => {
    if (el.hasAttribute('disabled')) return;
    const next = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(next));
    if (typeof onChange === 'function') onChange(next, event);
  });

  return el;
}

function normalizeItem(item) {
  if (Array.isArray(item)) return { value: item[0], label: item[1] };
  return item;
}

/** Creates a segmented control (group or tablist) of mutually exclusive options. */
export function segmented(opts = {}) {
  const {
    items = [],
    value,
    role = 'group',
    label,
    className,
    onChange,
  } = opts;

  const isTablist = role === 'tablist';
  const activeAttr = isTablist ? 'aria-selected' : 'aria-pressed';
  const normalized = items.map(normalizeItem);
  const buttons = [];

  const selectIndex = (idx, event) => {
    const item = normalized[idx];
    if (!item || item.disabled) return;
    buttons.forEach((btn, i) => {
      btn.setAttribute(activeAttr, String(i === idx));
    });
    if (typeof onChange === 'function') onChange(item.value, item, event);
  };

  const container = h('div', {
    class: joinClass('seg', className),
    role,
    'aria-label': label ?? null,
  });

  normalized.forEach((item, idx) => {
    const active = item.value === value;
    const btn = h(
      'button',
      {
        type: 'button',
        role: isTablist ? 'tab' : null,
        [activeAttr]: String(active),
        disabled: Boolean(item.disabled),
        dataset: { value: String(item.value) },
        onClick: (event) => selectIndex(idx, event),
        onKeydown: (event) => {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          const step = event.key === 'ArrowRight' ? 1 : -1;
          for (let offset = 1; offset <= buttons.length; offset += 1) {
            const nextIdx = (idx + step * offset + buttons.length) % buttons.length;
            if (!normalized[nextIdx].disabled) {
              buttons[nextIdx].focus();
              selectIndex(nextIdx, event);
              break;
            }
          }
        },
      },
      resolveIcon(item.icon),
      item.label,
    );
    buttons.push(btn);
    container.appendChild(btn);
  });

  return container;
}
