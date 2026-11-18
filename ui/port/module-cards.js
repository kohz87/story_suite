// The Settings module cards' commands for the port: a card's module switch, its feature switches and "Reset to Standard" (Story Block, Story Director and NPC State).

import { presetSwitches } from '../../core/features.js';
import { EXTRAS_FEATURES, EXTRAS_MODULE } from '../select/extras-keys.js';
import { isRpgFeature } from '../select/rpg-features.js';

const NO = message => ({ ok: false, code: 'FAILED', message });
const KEY = /^modules\.([A-Za-z]+)\.([^.]+)(?:\.(.+))?$/;
const isOn = feature => feature?.default !== false;
const extras = new Set(Object.values(EXTRAS_FEATURES));
const memoryKey = module => `cardSwitches.${module}`;

/**
 * `settings.set` with key `modules.chat.<module>` switches the module's features (off: all off; on: the ones that start on, or all when none does), `modules.chat.<module>.<feature id>`
 * one feature, both through `writes.features.set` (the store the old view's switches write); `settings.action` `modules.reset` answers with the Standard preset's own switches
 * (a feature outside the presets keeps its value). A module switch acts only on the card's own drawn switches (Story Block's Choices, Inner chatter and Your look belong to the Chat extras card, and Pick what you take, Encumbered and Gear in fights to Settings › RPG and fights; they are left as they are); off keeps
 * what was on (`writes.settings.keep`) and on puts that back, or the ones that start on when nothing was kept.
 * Switches apply to every chat (per-chat sets are not built), so another scope is refused. `features()` is the feature list. Any other command: returns null.
 */
export function moduleCardCommand(type, payload, writes = null, features = () => []) {
  const set = (id, on) => writes?.features?.set?.(id, on) !== undefined;
  const list = () => (features() ?? []).filter(f => typeof f?.id === 'string');
  if (type === 'settings.action' && payload?.key === 'modules.reset') {
    return [...presetSwitches(features(), 'standard')].every(([id, on]) => set(id, on)) ? { ok: true } : NO('The switches were not reset.');
  }
  const match = type === 'settings.set' ? KEY.exec(String(payload?.key ?? '')) : null;
  if (!match) return null;
  const [, scope, module, id] = match;
  if (scope !== 'chat') return NO('Switches apply to every chat; per-chat sets are not built.');
  const own = list().filter(f => String(f.moduleId ?? 'story-block') === module && !(module === EXTRAS_MODULE && (extras.has(f.id) || isRpgFeature(f.id))));
  const value = payload.value === true;
  if (id !== undefined) {
    if (!own.some(f => f.id === id)) return NO('That switch is not on this page.');
    return set(id, value) ? { ok: true, value } : NO('That switch was not saved.');
  }
  if (!own.length) return NO('That module has no switches.');
  const keep = writes?.settings;
  if (!value && own.some(f => f.on === true)) keep?.keep?.(memoryKey(module), Object.fromEntries(own.map(f => [f.id, f.on === true])));
  const before = value ? keep?.kept?.(memoryKey(module)) : null;
  const starts = own.some(isOn);
  const want = f => (!value ? false : before && typeof before[f.id] === 'boolean' ? before[f.id] : !starts || isOn(f));
  return own.every(f => set(f.id, want(f))) ? { ok: true, value } : NO('That module was not saved.');
}
