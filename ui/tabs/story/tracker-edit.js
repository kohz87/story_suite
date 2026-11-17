// Builds the Edit tracker form: the fields that can be changed by hand, Save (only what changed), Cancel and Remove for a tracker this chat made.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

function control(f) {
  if (f.edit === 'choice') {
    const select = h('select', null, (f.options ?? []).map(v => h('option', { value: v, selected: v === f.raw }, v)));
    select.value = f.raw;
    return select;
  }
  const attrs = f.edit === 'number' ? { type: 'number', step: 1, ...(Number.isFinite(f.min) ? { min: f.min } : {}), ...(Number.isFinite(f.max) ? { max: f.max } : {}) } : { type: 'text', ...(Number.isFinite(f.max) ? { maxlength: f.max } : {}) };
  return h('input', { ...attrs, value: f.raw });
}

/** Returns { fields } holding only the values that differ, or { error } naming the first number outside its limits. */
export function trackerPatch(tracker, values) {
  const fields = {};
  for (const f of tracker.fields ?? []) {
    if (!f.edit || !(f.key in values)) continue;
    const raw = String(values[f.key]).trim();
    if (f.edit === 'number') {
      const n = Number(raw);
      if (raw === '' || !Number.isInteger(n) || (Number.isFinite(f.min) && n < f.min) || (Number.isFinite(f.max) && n > f.max)) return { error: `${f.label} must be a whole number${Number.isFinite(f.max) ? ` from ${Number.isFinite(f.min) ? f.min : 0} to ${f.max}` : ''}.` };
      if (String(n) !== f.raw) fields[f.key] = n;
    } else if (raw !== f.raw) fields[f.key] = f.edit === 'text' ? values[f.key] : raw;
  }
  return { fields };
}

/** Builds the form; `onSave(fields)`, `onRemove()` and `onClose()` are called by its buttons (Save with nothing changed just closes). */
export function trackerSheet(tracker, { onSave, onRemove, onClose } = {}) {
  const editable = (tracker.fields ?? []).filter(f => f.edit);
  const inputs = new Map(editable.map(f => [f.key, control(f)]));
  const note = h('p', { class: 'fine', role: 'status' }, editable.length ? 'Changes are kept as written by you.' : 'None of this tracker’s fields can be changed by hand.');
  const confirm = h('div', { class: 'cfm', hidden: true }, h('b', `Remove ${tracker.name}?`), h('small', 'Its values leave this chat. Replies already told keep what they used.'),
    h('span', { class: 'ctl' }, button({ label: 'Remove', tone: 'danger', className: 'remove-yes', onClick: () => onRemove?.() }), button({ label: 'Keep it', onClick: () => confirm.setAttribute('hidden', '') })));
  const save = () => {
    const { fields, error } = trackerPatch(tracker, Object.fromEntries([...inputs].map(([key, el]) => [key, el.value])));
    if (error) { note.textContent = error; return; }
    if (Object.keys(fields).length) onSave?.(fields); else onClose?.();
  };
  return h('div', { class: 'qsheet trksheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Edit ${tracker.name}`, dataset: { tracker: tracker.id } },
    h('div', { class: 'qeh' }, h('div', { class: 'dn' }, `Edit ${tracker.name}`), button({ label: '×', icon: h('span', null, '×'), tone: 'icon', ariaLabel: 'Close', className: 'x qclose', onClick: () => onClose?.() })),
    editable.map(f => h('label', { class: 'ef', dataset: { field: f.key } }, f.label, inputs.get(f.key))),
    note,
    tracker.removable ? button({ label: 'Remove this tracker', tone: 'danger', className: 'remove', onClick: () => confirm.removeAttribute('hidden') }) : null,
    confirm,
    h('div', { class: 'brow' }, button({ label: 'Save', tone: 'primary', className: 'save', disabled: !editable.length, onClick: save }), button({ label: 'Cancel', className: 'cancel', onClick: () => onClose?.() })));
}
