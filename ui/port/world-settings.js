// The World and time page's writes for the port: `settings.set` with a `world.*` key stores the same setting the old page stores.
import { WORLD_KEYS, WORLD_IDS, toStored } from './world-keys.js';

// The first part of a Months list that is not “Name: days” with whole days of 1 or more (null when every part reads).
function badMonth(raw) {
  const parts = String(raw ?? '').split(/[,\n]/).map(p => p.trim()).filter(Boolean);
  return parts.find(p => { const at = p.lastIndexOf(':'); const days = Number(p.slice(at + 1)); return at < 1 || !p.slice(0, at).trim() || !Number.isInteger(days) || days < 1; }) ?? null;
}

// Why the row's value cannot be stored, said under the row (Settings shows a refusal's message).
function whyNot(key, def, value) {
  if (def.kind === 'months') {
    const bad = badMonth(value);
    const how = 'Write each month as “Name: days”, split by commas, with whole days of 1 or more (for example “Frostmoon: 30, Thaw: 28”).';
    return bad ? `“${bad}” does not read as a month. ${how}` : `There is no month to keep. ${how}`;
  }
  if (def.kind === 'choice' || def.kind === 'weather') return `Choose one of: ${def.labels.join(', ')}.`;
  if (def.kind === 'scale') return key === 'world.tempo' ? 'Tempo is a number from 0.25 to 4.' : 'It takes a number.';
  if (def.kind === 'int') return 'It takes a whole number.';
  if (def.kind === 'bool' || def.kind === 'feature') return 'It is a switch: on or off.';
  return 'It takes text.';
}

/**
 * `settings.set` { key: 'world.<row>', value } stores the row's setting under story-director (the weather row flips its feature)
 * through `writes` (the host's settings and features stores) → { ok: true, value } or { ok: false, message } (a value the row cannot take says why). Any other command is not this page's: null.
 */
export async function worldCommand(type, payload, writes = null) {
  const key = String(payload?.key ?? '');
  if (type !== 'settings.set' || !key.startsWith('world.')) return null;
  const def = WORLD_KEYS[key];
  const fail = message => ({ ok: false, code: 'FAILED', message });
  if (!def) return fail('That setting cannot be changed here.');
  const next = toStored(key, payload.value);
  if (next === undefined) return fail(whyNot(key, def, payload.value));
  const stored = def.kind === 'weather' ? writes?.features?.set?.(WORLD_IDS.weather, next) : def.kind === 'feature' ? writes?.features?.set?.(def.feature, next) : writes?.settings?.set?.(WORLD_IDS.director, def.key, next);
  return stored === undefined ? fail('That setting was not saved.') : { ok: true, value: stored };
}
