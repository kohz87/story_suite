// The Bag item forms' Carries field (Edit and + Add): what the item adds to carrying, the reader's own (inventory.carry, 0 to 500);
// read-only with the engine's reason for a pack's item or a bound piece. The Party Bag slot's note points here ("Edit › Carries").
import { h } from '../../kit/dom.js';
import { STRINGS, fill } from '../../../core/strings.js';
import { READER_CARRY_MAX } from '../../../modules/inventory/state.js';

export const CARRIES = 'Carries';

/** The new carry from the typed text, compared with `was`: { carry } (null: unchanged) or { error }. Empty means 0. */
export function carryChange(raw, was = 0) {
  const text = String(raw ?? '').trim();
  const n = text === '' ? 0 : Number(text);
  if (!/^\d*$/.test(text) || !Number.isSafeInteger(n) || n > READER_CARRY_MAX) return { error: fill(STRINGS.editMessages.carryRange, { max: READER_CARRY_MAX }) };
  return { carry: n === was ? null : n };
}

/** Builds the field; `why` (the engine's reason) makes it read-only. Returns { el, read() → { carry } | { error } }. */
export function carryField({ value = 0, why = '' } = {}) {
  const input = h('input', { type: 'number', min: '0', max: String(READER_CARRY_MAX), step: '1', value: String(value), dataset: { field: 'carry' }, disabled: Boolean(why) });
  const el = h('div', { dataset: { carry: why ? 'fixed' : 'own' } },
    h('label', { class: 'ef' }, `${CARRIES} (load it adds, 0–${READER_CARRY_MAX})`, input),
    why ? h('p', { class: 'fine', dataset: { why: 'carry' } }, why) : null);
  return { el, read: () => (why ? { carry: null } : carryChange(input.value, value)) };
}
