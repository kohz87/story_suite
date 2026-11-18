// The Director page's write for the port: `settings.set` with a `director.*` key stores the value in the same module setting the old view's page writes.
import { DIRECTOR_ROWS, SCENE_SPOILERS } from '../select/director-rows.js';

const FAILED = { ok: false, code: 'FAILED', message: 'That setting was not saved.' };

/**
 * `settings.set` with key `director.<row>` and `value` (a choice row: the label shown) → `writes.settings.set(module, field, stored)`:
 * The Scene spoilers row (`director.sceneSpoilers`, on = hidden) is this chat's own pref: `chat.set('scene', shown)` (the mounted view writes it through its own prefs first, so Now follows).
 * { ok: true, value } or { ok: false, … } when the host did not take it. Any other command is not the Director page's: returns null.
 */
export function directorCommand(type, payload, writes, chat = null) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.set' || !key.startsWith('director.')) return null;
  if (key === SCENE_SPOILERS.key) return chat?.set?.('scene', payload.value !== true) === true ? { ok: true, value: payload.value === true } : FAILED;
  const spec = DIRECTOR_ROWS.find(r => r.key === key);
  if (!spec) return { ...FAILED, message: 'That setting is not on this page.' };
  let value = payload.value;
  if (spec.labels) {
    const stored = Object.keys(spec.labels).find(k => spec.labels[k] === value);
    if (stored === undefined) return { ...FAILED, message: `Choose one of: ${Object.values(spec.labels).join(', ')}.` };
    value = stored;
  }
  const done = writes?.settings?.set?.(spec.module, spec.field, value);
  return done === undefined ? FAILED : { ok: true, value: done };
}
