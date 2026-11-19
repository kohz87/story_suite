// The Bag › Transport mount form: + Add (mounts.add, the `+ mount` line's fields) and a mount's Edit (mounts.edit, the `~ mount` line's,
// with the reader's own Carries). Kind is picked from the engine's kinds; Pace starts at the kind's usual one and follows a new kind until typed.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { KIND_PACE, paceOfKind, MAX_COUNT, MAX_PACE, MAX_CARRY } from '../../../modules/scene/mounts.js';
import { KIND_CARRY } from '../../../modules/inventory/gear/carry.js';

/** The kinds the engine knows a pace or a load for (horse, mule, cart…), in that order, each once. */
export const MOUNT_KINDS = Object.freeze([...new Set([...Object.keys(KIND_PACE), ...Object.keys(KIND_CARRY)])]);

const field = (label, control) => h('label', { class: 'ef' }, label, control);
const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : text);
const wholeIn = (text, min, max) => {
  const n = Number(String(text ?? '').trim());
  return /^\s*\d+\s*$/.test(String(text ?? '')) && Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
};

/**
 * The command payload for the typed values: { add } for a new mount (mounts.add), { edit } for `asset` (mounts.edit, changed fields only; null when
 * nothing changed), or { error }. `values` = { name, kind, count, pace, where, condition?, carry? } as typed.
 */
export function mountPayload(values, asset = null) {
  const name = String(values.name ?? '').trim();
  if (!name) return { error: 'Give the mount a name.' };
  const count = wholeIn(values.count, 1, MAX_COUNT);
  if (count === null) return { error: `How many is a whole number from 1 to ${MAX_COUNT}.` };
  const pace = wholeIn(values.pace, 1, MAX_PACE);
  if (pace === null) return { error: `Pace is a whole number of km a day, 1 to ${MAX_PACE}.` };
  const carryText = String(values.carry ?? '').trim();
  const carry = carryText === '' ? 0 : wholeIn(carryText, 0, MAX_CARRY);
  if (carry === null) return { error: `Carries is a whole number from 1 to ${MAX_CARRY}, or empty for the kind's usual.` };
  const typed = { name, kind: String(values.kind ?? '').trim(), count, pace, where: String(values.where ?? '').trim(), condition: String(values.condition ?? '').trim() };
  if (!asset) {
    const { condition, ...rest } = typed;
    return { add: { ...rest, ...(condition ? { condition } : {}) } };
  }
  const was = { name: asset.name, kind: asset.kindLabel, count: asset.count ?? 1, pace: asset.pace ?? 0, where: asset.where ?? '', condition: asset.condition ?? '' };
  const edit = Object.fromEntries(Object.entries(typed).filter(([key, value]) => value !== was[key]));
  if (carry !== (asset.carry ?? 0)) edit.carry = carry;
  return { edit: Object.keys(edit).length ? { mount: asset.name, ...edit } : null };
}

/** Builds the form for a new mount (`asset` null) or for `asset`'s Edit; `onSave(payload)` returns the engine's result (`{ ok:false, message }` shows inline). */
export function mountForm(asset = null, { onSave, onCancel } = {}) {
  const name = h('input', { type: 'text', value: asset?.name ?? '', placeholder: 'Grey Mare', 'aria-label': 'Mount name' });
  const known = asset && asset.kindLabel && !MOUNT_KINDS.includes(asset.kindLabel) ? [...MOUNT_KINDS, asset.kindLabel] : MOUNT_KINDS;
  const kind = h('select', { 'aria-label': 'Kind', dataset: { field: 'kind' } }, [...(asset && !asset.kindLabel ? [h('option', { value: '' }, 'None')] : []), ...known.map(k => h('option', { value: k }, cap(k)))]);
  kind.value = asset ? asset.kindLabel : 'horse';
  const count = h('input', { type: 'number', min: '1', max: String(MAX_COUNT), step: '1', value: String(asset?.count ?? 1), dataset: { field: 'count' } });
  const pace = h('input', { type: 'number', min: '1', max: String(MAX_PACE), step: '1', value: String(asset ? asset.pace ?? '' : paceOfKind(kind.value)), dataset: { field: 'pace' } });
  // (the pace left at the old kind's usual one follows a new kind, as the engine does for `~ mount | kind:`)
  let usual = paceOfKind(kind.value);
  kind.addEventListener('change', () => {
    if (String(pace.value).trim() === String(usual)) pace.value = String(paceOfKind(kind.value));
    usual = paceOfKind(kind.value);
  });
  const where = h('input', { type: 'text', value: asset?.where ?? '', placeholder: 'With the party, or: ridden by Mara', dataset: { field: 'where' } });
  const condition = asset ? h('input', { type: 'text', value: asset.condition ?? '', placeholder: 'Fine', dataset: { field: 'condition' } }) : null;
  const carry = asset ? h('input', { type: 'number', min: '0', max: String(MAX_CARRY), step: '1', value: asset.carry ? String(asset.carry) : '', placeholder: 'The kind\'s usual', dataset: { field: 'carry' } }) : null;
  const refusal = h('p', { class: 'fine err', role: 'alert', hidden: true });
  const show = text => {
    refusal.textContent = text;
    if (text) refusal.removeAttribute('hidden');
    else refusal.setAttribute('hidden', '');
  };
  let busy = false;
  const saveBtn = button({ label: asset ? 'Save' : 'Add', tone: 'primary', className: 'save', onClick: () => save() });
  const save = async () => {
    if (busy) return;
    const plan = mountPayload({ name: name.value, kind: kind.value, count: count.value, pace: pace.value, where: where.value, condition: condition?.value, carry: carry?.value }, asset);
    if (plan.error) { show(plan.error); return; }
    if (asset && !plan.edit) { onCancel?.(); return; }
    show('');
    busy = true;
    saveBtn.disabled = true;
    try {
      const result = await onSave?.(plan.add ?? plan.edit);
      if (result && result.ok === false) show(result.message || 'The engine could not do that.');
    } finally {
      busy = false;
      saveBtn.disabled = false;
    }
  };
  return h(
    'form',
    { class: 'iedit', dataset: { form: asset ? 'mount-edit' : 'mount-add' }, onSubmit: event => { event.preventDefault?.(); save(); } },
    field('Name', name), field('Kind', kind), field('How many', count), field('Pace (km/day)', pace),
    field('Where or who rides it (optional)', where),
    condition ? field('Condition', condition) : null,
    carry ? field('Carries (load each, empty: the kind\'s usual)', carry) : null,
    refusal,
    h('div', { class: 'brow' }, saveBtn, button({ label: 'Cancel', className: 'cancel', onClick: () => onCancel?.() })),
  );
}
