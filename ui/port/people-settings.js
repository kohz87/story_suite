// The People page's commands for the port: a row's change is stored under the NPC State setting the old panel's control stored, cut the same way.
import { peopleSpec, peopleResets } from '../select/people-settings/index.js';
import { peopleEnv } from '../select/people-settings/catalog.js';

const MODULE = 'npc-state-delta';
const FAILED = { ok: false, code: 'FAILED' };

function store(writes, pairs) {
  for (const [key, value] of pairs) if (writes?.settings?.set?.(MODULE, key, value) === undefined) return { ...FAILED, message: 'That setting was not saved.' };
  return { ok: true };
}

// The old panel's Dormant box moved "Auto-delete after" up when it fell at or under it.
function coupled(pairs, bucket) {
  const hit = pairs.find(p => p[0] === 'staleArchiveAfter');
  if (!hit || !(Number(bucket.staleDeleteAfter ?? 50) <= hit[1])) return pairs;
  return [...pairs, ['staleDeleteAfter', Math.min(1000, hit[1] + 1)]];
}

/**
 * `settings.set` with a `people.<row>` key stores that row's NPC State setting (`writes.settings.set`); `settings.action` with key `settings.reset`
 * and a label starting "Reset People" stores every writable row's default. `bucket()` reads the stored NPC State settings.
 * `presets()` reads the packs' meter preset records (Meter presets picks by name). A list row's button sent as an action (from search) is
 * answered with where to edit it. Any other command is not the People page's: returns null.
 */
export function peopleCommand(type, payload, writes, bucket = () => ({}), presets = () => []) {
  const key = String(payload?.key ?? '');
  if (type === 'settings.set' && key.startsWith('people.')) {
    const spec = peopleSpec(key);
    const pairs = spec?.write ? spec.write(payload.value, bucket(), peopleEnv({ presets: presets() })) : null;
    return pairs ? store(writes, coupled(pairs, bucket())) : { ...FAILED, message: 'That setting cannot be changed here.' };
  }
  if (type === 'settings.action' && key === 'settings.reset' && /^Reset People\b/.test(String(payload?.value ?? ''))) return store(writes, coupled(peopleResets(), {}));
  if (type === 'settings.action' && peopleSpec(key)?.view) return { ...FAILED, message: 'Edit this list on Settings › People.' };
  return null;
}
