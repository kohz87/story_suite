// A plug-in's Rules page write for the port: `settings.set` with a `plugin.<module id>.<field>` key stores the value in that module's own setting.
import { pluginKey } from '../select/plugin-pages.js';

const fail = message => ({ ok: false, code: 'FAILED', message });

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
  const done = writes?.settings?.set?.(found.id, found.field, value);
  return done === undefined ? fail('That setting was not saved.') : { ok: true, value: done };
}
