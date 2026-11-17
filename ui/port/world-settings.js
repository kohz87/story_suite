// The World and time page's writes for the port: `settings.set` with a `world.*` key stores the same setting the old page stores.
import { WORLD_KEYS, WORLD_IDS, toStored } from './world-keys.js';

/**
 * `settings.set` { key: 'world.<row>', value } stores the row's setting under story-director (the weather row flips its feature)
 * through `writes` (the host's settings and features stores) → { ok: true, value } or { ok: false, … }. Any other command is not this page's: null.
 */
export async function worldCommand(type, payload, writes = null) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.set' || !key.startsWith('world.')) return null;
  const def = WORLD_KEYS[key];
  const fail = message => ({ ok: false, code: 'FAILED', message });
  if (!def) return fail('That setting cannot be changed here.');
  const next = toStored(key, payload.value);
  if (next === undefined) return fail('That value cannot be saved.');
  const stored = def.kind === 'weather' ? writes?.features?.set?.(WORLD_IDS.weather, next) : writes?.settings?.set?.(WORLD_IDS.director, def.key, next);
  return stored === undefined ? fail('That setting was not saved.') : { ok: true, value: stored };
}
