// A plug-in's Rules page write for the port: `settings.set` with a `plugin.<module id>.<field>` key stores the value in that module's own setting.
import { pluginKey } from '../select/plugin-pages.js';

const fail = message => ({ ok: false, code: 'FAILED', message });

const TEXT_MAX = 200;
const PROMPT_MAX = 2000;
// The message for a value that does not fit the field's type (bool, int within min/max, text up to the field's max or 200 characters), else null.
function typeProblem(spec, value) {
  if (spec.type === 'bool') return typeof value === 'boolean' ? null : 'This setting is on or off.';
  if (spec.type === 'int') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'Enter a whole number.';
    if (Number.isFinite(spec.min) && value < spec.min) return `Enter a number of at least ${spec.min}.`;
    if (Number.isFinite(spec.max) && value > spec.max) return `Enter a number of at most ${spec.max}.`;
    return null;
  }
  if (spec.type === 'text' && spec.form === 'prompt') {
    const max = Number.isFinite(spec.max) ? Math.min(spec.max, PROMPT_MAX) : PROMPT_MAX;
    return typeof value !== 'string' ? 'Enter text.' : value.length > max ? `Keep it to ${max.toLocaleString('en-US')} characters or fewer.` : null;
  }
  if (spec.type === 'text') {
    const max = Number.isFinite(spec.max) ? spec.max : TEXT_MAX;
    return typeof value !== 'string' ? 'Enter text.' : value.length > max ? `Keep it to ${max} characters or fewer.` : null;
  }
  return null;
}

/**
 * `modules`: () => sdk.modules(). `settings.set` { key: 'plugin.<module>.<field>', value } (a choice row: the label shown) → `writes.settings.set(module, field, stored)`:
 * { ok: true, value } or { ok: false, message }. Any other command is not these pages': returns null.
 */
export function pluginCommand(type, payload, writes, modules = () => []) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.set' || !key.startsWith('plugin.')) return null;
  let found = null;
  for (const m of modules() ?? []) for (const field of Object.keys(m?.settingsPage?.schema ?? {})) if (pluginKey(m.id, field) === key) found = { id: m.id, field, spec: m.settingsPage.schema[field] };
  if (!found) return fail('That setting is not on this page.');
  let value = payload.value;
  if (found.spec.type === 'choice') {
    const option = (found.spec.options ?? []).map(o => (o !== null && typeof o === 'object' ? { value: o.value, label: o.label ?? o.value } : { value: o, label: o })).find(o => o.label === value);
    if (!option) return fail('Choose one of the listed options.');
    value = option.value;
  }
  else {
    const bad = typeProblem(found.spec, value);
    if (bad) return fail(bad);
  }
  const done = writes?.settings?.set?.(found.id, found.field, value);
  return done === undefined ? fail('That setting was not saved.') : { ok: true, value: done };
}
