// Renders one settings schema row (label, hint, marks and the control for its type) and groups rows into cards.
import { h } from '../kit/dom.js';
import { toggle, segmented } from '../kit/controls.js';

const TAGS = {
  merged: ['merged', 'Was set in several places before'],
  replaced: ['replaced', 'Replaces an older mechanism'],
  cost: ['cost', 'Costs an extra call or prompt space'],
  chat: ['this chat', 'Kept per chat; the rest are your defaults for every chat'],
};

/** Builds the small marks after a setting's label from tags like `merged:D4`, `cost:model call` or `chat`. */
export function tagNodes(tags = []) {
  return tags.map((tag) => {
    const [kind, detail] = String(tag).split(':');
    const known = TAGS[kind];
    if (!known) return null;
    const text = kind === 'cost' && detail ? detail : known[0];
    const klass = kind === 'replaced' ? 'merged' : kind;
    const title = detail && kind !== 'cost' ? `${known[1]} (${detail})` : known[1];
    return h('span', { class: ['tg2', klass], title }, text);
  }).filter(Boolean);
}

function parseNumber(raw) {
  const text = String(raw).trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isNaN(n) ? undefined : n;
}

function numInput(label, value, onValue) {
  const el = h('input', { type: 'number', value: value ?? '', 'aria-label': label });
  el.addEventListener('change', () => {
    const n = parseNumber(el.value);
    if (n !== undefined) onValue(n);
  });
  return el;
}

function controlFor(row, emit, labelId) {
  const { type, label, value, options } = row;
  const list = Array.isArray(options) ? options : [];
  if (type === 'sw') return toggle({ checked: Boolean(value), labelledBy: labelId, onChange: emit });
  if (type === 'seg') {
    return segmented({ items: list.map(o => [o, o]), value, label, className: 'sseg2', onChange: emit });
  }
  if (type === 'num') {
    return h('span', { class: 'num' }, numInput(label, value, emit), row.unit ? h('span', row.unit) : null);
  }
  if (type === 'multi') {
    const current = { ...(value && typeof value === 'object' ? value : {}) };
    return h('span', { class: 'multi' }, Object.keys(current).map(name => h(
      'label',
      name,
      numInput(`${label}: ${name}`, current[name], (n) => { current[name] = n; emit({ ...current }); }),
    )));
  }
  if (type === 'sel') {
    const all = list.includes(value) || value === null || value === undefined ? list : [value, ...list];
    const el = h('select', { class: 'sel2', 'aria-label': label },
      all.map(o => h('option', { value: o, selected: o === value }, o)));
    el.addEventListener('change', () => emit(el.value));
    return el;
  }
  if (type === 'txt') {
    const el = h('input', { type: 'text', class: 'txt2', value: value ?? '', placeholder: '—', 'aria-label': label });
    el.addEventListener('change', () => emit(el.value));
    return el;
  }
  if (type === 'chips') {
    const on = new Set(Array.isArray(value) ? value : []);
    return h('span', { class: 'chips3' }, list.map((o) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(on.has(o)) }, o);
      b.addEventListener('click', () => {
        if (on.has(o)) on.delete(o); else on.add(o);
        b.setAttribute('aria-pressed', String(on.has(o)));
        emit(list.filter(x => on.has(x)));
      });
      return b;
    }));
  }
  if (type === 'btn') {
    return list.map(o => h('button', { type: 'button', class: 'btn2', onClick: () => emit(o) }, o));
  }
  return h('span', { class: 'sinfo' }, value === null || value === undefined ? '' : String(value));
}

function isWide(row) {
  if (row.wide || row.type === 'txt' || row.type === 'chips') return true;
  return row.type === 'seg' && Array.isArray(row.options) && row.options.join('').length > 26;
}

/** Builds one `.srow` for a schema row; ctx = { onChange(key, value, row), onAction(key, label, row) }. */
export function renderRow(row, ctx = {}) {
  const labelId = `sf-${row.key}`;
  const isSwitch = row.type === 'sw';
  const emit = row.type === 'btn'
    ? label => ctx.onAction?.(row.key, label, row)
    : value => ctx.onChange?.(row.key, value, row);
  const tags = tagNodes(row.tags);
  const el = h(
    'div',
    { class: ['srow', isWide(row) && 'wide', isSwitch && 'swrow'], dataset: { key: row.key, type: row.type } },
    h('span', { class: 'lb' }, h('b', { id: labelId }, row.label, tags), row.hint ? h('small', row.hint) : null),
    h('span', { class: 'ctl' }, controlFor(row, emit, labelId)),
  );
  if (isSwitch) {
    el.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.closest && target.closest('button,input,select,a,textarea')) return;
      const sw = el.querySelector('.sw');
      if (sw && !sw.hasAttribute('disabled')) sw.click();
    });
  }
  return el;
}

/** Builds `.sgrp` cards from rows, one per `row.group` in first-seen order, each headed by the group name. */
export function renderGroups(rows, ctx = {}) {
  const order = [];
  const byGroup = new Map();
  for (const row of rows ?? []) {
    const name = row.group ?? '';
    if (!byGroup.has(name)) { byGroup.set(name, []); order.push(name); }
    byGroup.get(name).push(row);
  }
  return order.map(name => h(
    'div',
    { class: 'sgrp' },
    name ? h('div', { class: 'gt' }, name) : null,
    byGroup.get(name).map(row => renderRow(row, ctx)),
  ));
}
