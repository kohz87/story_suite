// The RPG page's Custom difficulty editors for the port: a `rpg.custom.<field>` row stores that number in the Custom set (`rpgStandard`, Story Block's bucket), the key creation reads.

import { STANDARD_RANGES, STANDARD_SETTING, normalizeStandard } from '../../modules/rpg/rules.js';
import { customOf } from '../../modules/rpg/view/settings-data.js';
import { CUSTOM_FIELDS } from '../select/rpg-difficulty.js';

const BUCKET = 'story-block';
const PREFIX = 'rpg.custom.';
const FIELDS = new Set(CUSTOM_FIELDS.map(f => f.field));

/**
 * `key` `rpg.custom.<field>` and `raw` (what the row sent) → `{ ok, value }` once stored (a whole number held to the field's range), or a refusal: not a
 * number, or one that breaks lowest ≤ start ≤ highest ≤ the highest a stat can be (the engine would put all four back, so nothing is stored).
 * Any other key: null. `values()` reads the bucket.
 */
export function rpgCustomCommand(key, raw, writes, values = () => null) {
  const field = String(key).startsWith(PREFIX) ? String(key).slice(PREFIX.length) : '';
  if (!FIELDS.has(field)) return null;
  const n = Number(raw);
  if (raw === null || raw === '' || typeof raw === 'boolean' || !Number.isFinite(n)) return { ok: false, code: 'FAILED', message: 'That value is not one this setting takes.' };
  const { min, max } = STANDARD_RANGES[field];
  const value = Math.min(max, Math.max(min, Math.round(n)));
  const next = { ...customOf(values() ?? {}), [field]: value };
  if (!(next.createMin <= next.startStat && next.startStat <= next.createMax && next.createMax <= next.statMax)) {
    return { ok: false, code: 'FAILED', message: `Keep lowest ≤ stats start at ≤ highest ≤ ${next.statMax}; that number would break the order.` };
  }
  const stored = writes?.settings?.set?.(BUCKET, STANDARD_SETTING, normalizeStandard(next));
  return stored === undefined ? { ok: false, code: 'FAILED', message: 'That setting was not saved.' } : { ok: true, value };
}
