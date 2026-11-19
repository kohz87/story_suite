// Builds the Bag's "+ Add" form (name, kind, count, your note; Slot, Rarity and Stats for equipment, and Carries, with Gear in fights on) and sends it to inventory.add; the engine's refusal shows inline.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { gearAddFields } from './item-add-gear.js';
import { carryField } from './carry-field.js';

const KINDS = [['equipment', 'Gear'], ['consumable', 'Use'], ['goods', 'Goods'], ['material', 'Materials'], ['quest', 'Quest']];

const field = (label, control) => h('label', { class: 'ef' }, label, control);

/** The inventory.add payload for the typed values; null while the name is empty or the count is not a whole number of at least 1. */
export function addPayload({ name = '', kind = 'goods', qty = '1', note = '' } = {}) {
  const text = name.trim();
  const count = Number(qty);
  if (!text || !Number.isInteger(count) || count < 1) return null;
  return { name: text, kind, qty: count, ...(note.trim() ? { note: note.trim() } : {}) };
}

/**
 * Builds the form; `onSave(payload, repoint, carry)` returns the engine's result (`{ ok: false, message }` shows inline) and `onCancel()` closes it. `gear` = { on, kit }:
 * with Gear in fights on, Kind = Equipment shows Slot, Rarity and Stats (`repoint`: stats to move onto the new piece after the add, when the starting kit is closed), and
 * every kind shows Carries (`carry`: what the new item adds, set after the add by inventory.carry; null for none).
 */
export function itemAddForm({ onSave, onCancel, gear = null } = {}) {
  const name = h('input', { type: 'text', placeholder: 'Item name', 'aria-label': 'Item name' });
  const kind = h('select', { 'aria-label': 'Kind' }, KINDS.map(([value, label]) => h('option', { value, selected: value === 'goods' }, label)));
  kind.value = 'goods';
  const qty = h('input', { type: 'number', min: '1', step: '1', value: '1' });
  const note = h('textarea', { rows: 2, placeholder: 'No note' });
  const gearBox = gear?.on ? gearAddFields({ kit: gear.kit === true, nameOf: () => name.value }) : null;
  const gearOn = () => Boolean(gearBox) && kind.value === 'equipment';
  const carries = gear?.on ? carryField({ value: 0 }) : null;
  const showGear = () => { if (gearBox) gearBox.el.hidden = !gearOn(); };
  kind.addEventListener('change', showGear);
  name.addEventListener('input', () => gearBox?.refresh());
  showGear();
  const refusal = h('p', { class: 'fine err', role: 'alert', hidden: true });
  const show = text => {
    refusal.textContent = text;
    if (text) refusal.removeAttribute('hidden');
    else refusal.setAttribute('hidden', '');
  };
  let busy = false;
  const saveBtn = button({ label: 'Add', tone: 'primary', className: 'save', onClick: () => save() });
  const save = async () => {
    if (busy) return;
    const payload = addPayload({ name: name.value, kind: kind.value, qty: qty.value, note: note.value });
    if (!payload) { show('Give it a name and a count of at least 1.'); return; }
    const plan = gearOn() ? gearBox.plan() : { add: {}, repoint: null };
    if (plan.error) { show(plan.error); return; }
    const carry = carries ? carries.read() : { carry: null };
    if (carry.error) { show(carry.error); return; }
    show('');
    busy = true;
    saveBtn.disabled = true;
    try {
      const result = await onSave?.({ ...payload, ...plan.add }, plan.repoint, carry.carry || null);
      if (result && result.ok === false) show(result.message || 'The engine could not do that.');
    } finally {
      busy = false;
      saveBtn.disabled = false;
    }
  };
  return h(
    'form',
    { class: 'iedit', dataset: { form: 'item-add' }, onSubmit: event => { event.preventDefault?.(); save(); } },
    field('Name', name), field('Kind', kind), field('Count', qty), gearBox?.el ?? null, carries?.el ?? null, field('Your note', note),
    refusal,
    h('div', { class: 'brow' }, saveBtn, button({ label: 'Cancel', className: 'cancel', onClick: () => onCancel?.() })),
  );
}
