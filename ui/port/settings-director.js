// The Director page's write for the port: `settings.set` with a `director.*` key stores the value in the same module setting the old view's page writes.
import { DIRECTOR_ROWS } from '../select/director-rows.js';

const FAILED = { ok: false, code: 'FAILED', message: 'That setting was not saved.' };

/**
 * `settings.set` with key `director.<row>` and `value` (a choice row: the label shown) → `writes.settings.set(module, field, stored)`:
 * { ok: true, value } or { ok: false, … } when the host did not take it. Any other command is not the Director page's: returns null.
 */
export function directorCommand(type, payload, writes) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.set' || !key.startsWith('director.')) return null;
  const spec = DIRECTOR_ROWS.find(r => r.key === key);
  if (!spec) return { ...FAILED, message: 'That setting is not on this page.' };
  let value = payload.value;
  if (spec.labels) {
    const stored = Object.keys(spec.labels).find(k => spec.labels[k] === value);
    if (stored === undefined) return FAILED;
    value = stored;
  }
  const done = writes?.settings?.set?.(spec.module, spec.field, value);
  return done === undefined ? FAILED : { ok: true, value: done };
}
