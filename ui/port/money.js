// The Money page's commands for the port: each row writes the same Story Block setting the old view's Money page writes, and Reset puts the six back.

import { MONEY_KEYS, SHOW } from '../select/money-rows.js';
import { readCoins } from '../select/money-lines.js';
import { CORE_SETTINGS } from '../../modules/scene/domains/core/constants-parts/settings.js';

const FAILED = { ok: false, code: 'FAILED' };
export const MONEY_RESET = 'Reset Money to defaults';

// A row's value → the stored value (null for one that cannot be stored).
function toStored(key, value) {
  if (key === 'money.coins') { const read = readCoins(value); return read.ok ? { value: read.items } : { message: read.message }; }
  if (key === 'money.show') return Object.hasOwn(SHOW, value) ? { value: SHOW[value] } : { message: 'That is not a way to show money.' };
  if (key === 'money.priceScale') { const n = Number(value); return Number.isFinite(n) ? { value: String(n) } : { message: 'The price scale is a number.' }; }
  return { value: String(value ?? '') };
}

/**
 * `settings.set` with key `money.<row>` → `settings.set('story-block', <stored key>, value)` (the store cuts text and keeps numbers in range);
 * `settings.action` with key `settings.reset` and the Money page's reset label stores the six defaults. Any other command: returns null.
 */
export function moneyCommand(type, payload, writes = null) {
  const key = String(payload?.key ?? '');
  const set = (name, value) => writes?.settings?.set?.('story-block', name, value);
  if (type === 'settings.action' && key === 'settings.reset' && payload?.value === MONEY_RESET) {
    const stored = Object.values(MONEY_KEYS).map(name => set(name, structuredClone(CORE_SETTINGS.defaults[name])));
    return stored.includes(undefined) ? { ...FAILED, message: 'Money was not reset.' } : { ok: true };
  }
  if (type !== 'settings.set' || !Object.hasOwn(MONEY_KEYS, key)) return null;
  const parsed = toStored(key, payload.value);
  if (!Object.hasOwn(parsed, 'value')) return { ...FAILED, message: parsed.message };
  const stored = set(MONEY_KEYS[key], parsed.value);
  return stored === undefined ? { ...FAILED, message: 'That setting was not saved.' } : { ok: true, value: stored };
}
