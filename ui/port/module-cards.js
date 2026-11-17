// The Settings module cards' commands for the port: a card's module switch, its feature switches and "Reset to Standard" (Story Block, Story Director and NPC State).

const NO = message => ({ ok: false, code: 'FAILED', message });
const KEY = /^modules\.([A-Za-z]+)\.([^.]+)(?:\.(.+))?$/;
const isOn = feature => feature?.default !== false;

/**
 * `settings.set` with key `modules.chat.<module>` switches the module's features (off: all off; on: the ones that start on, or all when none does), `modules.chat.<module>.<feature id>`
 * one feature, both through `writes.features.set` (the store the old view's switches write); `settings.action` `modules.reset` puts every feature back to its default.
 * Switches apply to every chat (per-chat sets are not built), so another scope is refused. `features()` is the feature list. Any other command: returns null.
 */
export function moduleCardCommand(type, payload, writes = null, features = () => []) {
  const set = (id, on) => writes?.features?.set?.(id, on) !== undefined;
  const list = () => (features() ?? []).filter(f => typeof f?.id === 'string');
  if (type === 'settings.action' && payload?.key === 'modules.reset') {
    return list().every(f => set(f.id, isOn(f))) ? { ok: true } : NO('The switches were not reset.');
  }
  const match = type === 'settings.set' ? KEY.exec(String(payload?.key ?? '')) : null;
  if (!match) return null;
  const [, scope, module, id] = match;
  if (scope !== 'chat') return NO('Switches apply to every chat; per-chat sets are not built.');
  const own = list().filter(f => String(f.moduleId ?? 'story-block') === module);
  const value = payload.value === true;
  if (id !== undefined) {
    if (!own.some(f => f.id === id)) return NO('That switch is not on this page.');
    return set(id, value) ? { ok: true, value } : NO('That switch was not saved.');
  }
  if (!own.length) return NO('That module has no switches.');
  const starts = own.some(isOn);
  return own.every(f => set(f.id, value && (!starts || isOn(f)))) ? { ok: true, value } : NO('That module was not saved.');
}
