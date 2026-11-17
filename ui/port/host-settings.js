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

/**
 * `settings.set` { key: 'host.<name>', value } stores that host setting (`writes.settings.set(null, name, stored)`) → { ok: true, value } or { ok: false, … }.
 * Any other command is not these pages': returns null.
 */
export function hostCommand(type, payload, writes = null) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.set' || !key.startsWith('host.')) return null;
  const name = KEYS.get(key);
  if (!name) return fail('That setting cannot be changed here.');
  const stored = toStored(HOST_SETTINGS_SCHEMA[name], payload.value);
  if (stored === undefined) return fail('That value cannot be saved.');
  const done = writes?.settings?.set?.(null, name, stored);
  return done === undefined ? fail('That setting was not saved.') : { ok: true, value: done };
}
