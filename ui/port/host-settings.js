// The Look and Tools pages' writes for the port: `settings.set` with a `host.*` key stores the host's own setting (the place the old view's Look and budgets write).
import { HOST_SETTINGS_SCHEMA } from '../../core/sdk/constants.js';
import { BUDGETS, LOOK, hostKey } from '../select/host-keys.js';

const KEYS = new Map([...LOOK, ...BUDGETS].map(name => [hostKey(name), name]));
const fail = message => ({ ok: false, code: 'FAILED', message });

// The row's value → the stored value: a choice row shows the option's label, a number or switch is stored as it is (the store holds it to the schema's range).
function toStored(field, value) {
  if (field.type === 'choice') return (field.options ?? []).find(o => o.label === value)?.value;
  if (field.type === 'int') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (field.type === 'bool') return typeof value === 'boolean' ? value : undefined;
  return undefined;
}

// Why the row's value cannot be stored, said under the row.
function whyNot(field) {
  if (field.type === 'choice') return `Choose one of: ${(field.options ?? []).map(o => o.label).join(', ')}.`;
  if (field.type === 'int') return Number.isInteger(field.min) && Number.isInteger(field.max) ? `It takes a whole number, ${field.min}-${field.max}.` : 'It takes a whole number.';
  if (field.type === 'bool') return 'It is a switch: on or off.';
  return 'That value cannot be saved.';
}

/**
 * `settings.set` { key: 'host.<name>', value } stores that host setting (`writes.settings.set(null, name, stored)`) → { ok: true, value, range? } (a whole
 * number's schema range, so a held number says it) or { ok: false, message } (a value the row cannot take says why).
 * Any other command is not these pages': returns null.
 */
export function hostCommand(type, payload, writes = null) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.set' || !key.startsWith('host.')) return null;
  const name = KEYS.get(key);
  if (!name) return fail('That setting cannot be changed here.');
  const field = HOST_SETTINGS_SCHEMA[name];
  const stored = toStored(field, payload.value);
  if (stored === undefined) return fail(whyNot(field));
  const done = writes?.settings?.set?.(null, name, stored);
  if (done === undefined) return fail('That setting was not saved.');
  return field.type === 'int' && Number.isInteger(field.min) && Number.isInteger(field.max) ? { ok: true, value: done, range: { min: field.min, max: field.max } } : { ok: true, value: done };
}
