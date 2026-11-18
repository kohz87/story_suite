// Draws one list editor under a Settings row: a line of labelled fields per item (the Journal editor's .ef fields: label over control),
// a Remove button on each, a note under an item the engine does not use, and the Add button.
import { h } from '../../kit/dom.js';

const num = raw => {
  const text = String(raw ?? '').trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

// One field's control: `txt` a text box, `num` a whole-number box, `sel` a choice of `options` (the stored value kept when it is not one).
function control(field, value, label, tag, onValue) {
  if (field.kind === 'sel') {
    const all = field.options.includes(value) || !value ? field.options : [value, ...field.options];
    const el = h('select', { 'aria-label': label, dataset: { f: tag } }, all.map(o => h('option', { value: o, selected: o === value }, o)));
    el.addEventListener('change', () => onValue(el.value));
    return el;
  }
  if (field.kind === 'num') {
    const el = h('input', { type: 'number', step: '1', value: value ?? '', placeholder: field.placeholder ?? null, 'aria-label': label, dataset: { f: tag } });
    el.addEventListener('change', () => { const n = num(el.value); if (n !== undefined) onValue(n); });
    return el;
  }
  const el = h('input', { type: 'text', value: value ?? '', placeholder: field.placeholder ?? null, 'aria-label': label, dataset: { f: tag } });
  el.addEventListener('change', () => onValue(el.value));
  return el;
}

/**
 * The editor's nodes. `spec`: { fields: [{ f, label, kind: 'txt'|'num'|'sel', options?, placeholder?, size?: 'grow'|'wide' }], noun, addLabel,
 * notUsed (the note under an unused item) }; `list`: { items, unused, note }; `max`: most items; `error`: the last save's failure or null;
 * `on`: { edit(i, f, value), remove(i), add() }.
 */
export function listEditorNodes(spec, list, { max = Infinity, error = null, on }) {
  const unused = new Set(list.unused ?? []);
  const rows = (list.items ?? []).map((item, i) => h('div', { class: ['erow', unused.has(i) && 'unused'], dataset: { i } },
    spec.fields.map(field => h('label', { class: ['ef', field.size] }, h('span', field.label),
      control(field, item[field.f], `${spec.noun} ${i + 1}: ${field.label}`, `${i}.${field.f}`, value => on.edit(i, field.f, value)))),
    h('button', { type: 'button', class: 'btn2', 'aria-label': `Remove ${spec.noun.toLowerCase()} ${i + 1}`, onClick: () => on.remove(i) }, 'Remove'),
    unused.has(i) ? h('small', { class: 'eun' }, spec.notUsed) : null));
  const full = (list.items ?? []).length >= max;
  return [
    list.note ? h('p', { class: 'fine' }, list.note) : null,
    ...rows,
    spec.addLabel ? h('button', { type: 'button', class: 'btn2 eadd', disabled: full, onClick: () => on.add() }, spec.addLabel) : null,
    error ? h('p', { class: 'fine eerr', role: 'status' }, error) : null,
  ].filter(Boolean);
}

/**
 * Brings an editor drawn by listEditorNodes up to `list` without drawing it again: each item's unused mark and note, every field's value
 * (not the focused one), a choice's options (`spec.fields`), and the error line. Returns false when it cannot (another number of items, a changed note, a value a choice
 * does not offer); the caller then draws the editor again.
 */
export function patchEditorNodes(box, spec, list, error) {
  const rows = [...box.children].filter(c => c.classList.contains('erow'));
  const items = list.items ?? [];
  const note = [...box.children].find(c => c.classList.contains('fine') && !c.classList.contains('eerr'));
  if (rows.length !== items.length || (note?.textContent ?? null) !== (list.note ?? null)) return false;
  const unused = new Set(list.unused ?? []);
  const active = globalThis.document?.activeElement;
  for (const [i, row] of rows.entries()) {
    if (unused.has(i)) row.classList.add('unused'); else row.classList.remove('unused');
    const mark = row.querySelector('.eun');
    if (unused.has(i) && !mark) row.appendChild(h('small', { class: 'eun' }, spec.notUsed));
    if (!unused.has(i) && mark) mark.remove();
    for (const el of row.querySelectorAll('[data-f]')) {
      const name = el.dataset.f.split('.')[1];
      const value = items[i][name];
      const text = value === null || value === undefined ? '' : String(value);
      const field = spec.fields.find(x => x.f === name);
      if (field?.kind === 'sel') {
        const all = field.options.includes(text) || !text ? field.options : [text, ...field.options];
        if ([...el.querySelectorAll('option')].map(o => o.textContent).join('\n') !== all.join('\n')) el.replaceChildren(...all.map(o => h('option', { value: o, selected: o === text }, o)));
      }
      if (el === active || el.value === text) continue;
      el.value = text;
      if (el.value !== text) return false;
    }
  }
  const shown = box.querySelector('.eerr');
  if (error && shown) shown.textContent = error;
  else if (error) box.appendChild(h('p', { class: 'fine eerr', role: 'status' }, error));
  else shown?.remove();
  return true;
}
