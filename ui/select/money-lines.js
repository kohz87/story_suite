// The coins as one text line ("copper: 1, silver: 10") and back: the old Money page's text form (`listToLines` / `linesToList`) on one comma-joined line.

import { CORE_SETTINGS } from '../../modules/scene/domains/core/constants-parts/settings.js';
import { listToLines, linesToList } from '../legacy/host-ui/controls-parts/list-lines.js';

const FIELD = CORE_SETTINGS.schema.coins;

/** The stored coin rows → "copper: 1, silver: 10" (empty for none). */
export function coinsText(rows) {
  return listToLines(FIELD, rows).split('\n').filter(Boolean).join(', ');
}

/** The text read back → { ok: true, items } or { ok: false, message } naming the part that does not read (the old page's own words). */
export function readCoins(text) {
  const parts = String(text ?? '').split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
  const done = linesToList(FIELD, parts.join('\n'));
  return done.ok ? { ok: true, items: done.items } : { ok: false, message: `Coin ${done.line} ("${done.text.slice(0, 40)}"): ${done.error} Kept as it was until every coin reads.` };
}
