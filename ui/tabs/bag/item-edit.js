// Builds the item sheet's Edit form (name, count, the reader's note; weight of any item and soak of armour when RPG is on; rarity and slot of a hand-made piece) and the patch Save sends to inventory.edit.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const SLOTS = ['weapon', 'body', 'off-hand', 'head', 'cloak', 'feet', 'accessory'];
const countOf = item => (Number.isInteger(item.count) ? item.count : item.qty);
const rarityOf = item => item.realRarity ?? item.rarity;
const cap = text => text[0].toUpperCase() + text.slice(1);

// What one unit weighs (any item the engine gave a weight); the soak of a piece whose slot protects (the engine says how much it may give: `soakMax`).
const hasWeight = item => Number.isInteger(item.weight);
const hasSoak = item => item.kind === 'gear' && Number.isInteger(item.soakMax) && item.soakMax > 0;

const field = (label, control) => h('label', { class: 'ef' }, label, control);

/** The inventory.edit payload for the changed fields only; null when nothing changed. A count change sends `group` so unstacked pieces are counted together. */
export function itemPatch(item, values, rpg = false) {
  const patch = {};
  const name = (values.name ?? '').trim();
  if (name && name !== item.name) patch.name = name;
  const qty = Number(values.qty);
  if (values.qty !== '' && Number.isInteger(qty) && qty >= 1 && qty !== countOf(item)) Object.assign(patch, { qty, group: true });
  const note = (values.note ?? '').trim();
  if (note !== (item.note ?? '').trim()) patch.note = note;
  if (rpg && hasWeight(item)) {
    const weight = Number(values.weight);
    if (values.weight !== '' && values.weight !== undefined && Number.isInteger(weight) && weight >= 0 && weight !== item.weight) patch.weight = weight;
  }
  if (rpg && hasSoak(item)) {
    const soak = Number(values.soak);
    if (values.soak !== '' && values.soak !== undefined && Number.isInteger(soak) && soak >= 0 && soak !== (item.soak ?? 0)) patch.soak = soak;
  }
  if (rpg && item.hand) {
    if (values.rarity && values.rarity !== rarityOf(item)) patch.rarity = values.rarity;
    if ((values.slot ?? '') !== (item.slot ?? '')) patch.slot = values.slot ?? '';
  }
  return Object.keys(patch).length ? { stack: item.stack, ...patch } : null;
}

/** Builds the form; `onSave(payload)` returns a result (`{ ok:false, message }` shows inline), `onCancel()` changes nothing. Weight shows for any item and Soak for armour, with RPG on; Rarity and Slot only for a hand-made piece. */
export function itemEditForm(item, { rpg = false, onSave, onCancel } = {}) {
  const name = h('input', { type: 'text', value: item.name });
  const qty = h('input', { type: 'number', min: '1', step: '1', value: String(countOf(item)) });
  const note = h('textarea', { rows: 2, value: item.note ?? '', placeholder: 'No note' });
  const gear = rpg && item.hand === true && item.kind === 'gear';
  const rarity = gear ? h('select', null, RARITIES.map(r => h('option', { value: r, selected: r === rarityOf(item) }, cap(r)))) : null;
  if (rarity) rarity.value = rarityOf(item);
  const slotWords = item.slot && !SLOTS.includes(item.slot) ? [...SLOTS, item.slot] : SLOTS;
  const slot = gear ? h('select', null, [h('option', { value: '' }, 'None'), ...slotWords.map(s => h('option', { value: s, selected: s === item.slot }, cap(s)))]) : null;
  if (slot) slot.value = item.slot ?? '';
  const weight = rpg && hasWeight(item) ? h('input', { type: 'number', min: '0', max: '99', step: '1', value: String(item.weight) }) : null;
  const soak = rpg && hasSoak(item) ? h('input', { type: 'number', min: '0', max: String(item.soakMax), step: '1', value: String(item.soak ?? 0) }) : null;
  const refusal = h('p', { class: 'fine err', role: 'alert', hidden: true });
  const show = text => {
    refusal.textContent = text;
    if (text) refusal.removeAttribute('hidden');
    else refusal.setAttribute('hidden', '');
  };
  let busy = false;
  const saveBtn = button({ label: 'Save', tone: 'primary', className: 'save', onClick: () => save() });
  const save = async () => {
    if (busy) return;
    const payload = itemPatch(item, {
      name: name.value, qty: qty.value, note: note.value, ...(weight ? { weight: weight.value } : {}), ...(soak ? { soak: soak.value } : {}), ...(rarity ? { rarity: rarity.value, slot: slot.value } : {}),
    }, rpg);
    if (!payload) { onCancel?.(); return; }
    show('');
    busy = true;
    saveBtn.disabled = true;
    try {
      const result = await onSave?.(payload);
      if (result && result.ok === false) show(result.message || 'The engine could not do that.');
    } finally {
      busy = false;
      saveBtn.disabled = false;
    }
  };
  return h(
    'form',
    { class: 'iedit', dataset: { form: 'item-edit' }, onSubmit: event => { event.preventDefault?.(); save(); } },
    field('Name', name),
    field('Count', qty),
    field('Your note', note),
    weight ? field('Weight each', weight) : null,
    soak ? field(`Soak (up to ${item.soakMax})`, soak) : null,
    rarity ? field('Rarity', rarity) : null,
    slot ? field('Slot', slot) : null,
    h('p', { class: 'fine' }, 'Changes are kept as written by you. A signature piece keeps its name and count.'),
    refusal,
    h('div', { class: 'brow' }, saveBtn, button({ label: 'Cancel', className: 'cancel', onClick: () => onCancel?.() })),
  );
}
