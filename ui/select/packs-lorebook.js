// The job: the lorebook row of each installed world pack with lore on Settings › Packs, in the reader's words (Create, Update, Up to date; the tick).

import { stLorebooks, stSettings } from '../../packs/st-adapter.js';
import { lorebookRows } from '../../packs/lorebook-make/run.js';

const books = stLorebooks();
const BUTTON = Object.freeze({ create: 'Create the lorebook from this pack', update: 'Update the lorebook' });

/** The rows as SillyTavern has things now (its book names, the chat's character and its lorebooks) for `list` = the `packs.list` answer. */
export function liveLorebookRows(list) {
  try { return lorebookRows({ list: Array.isArray(list) ? list : [], books, settings: stSettings() }); } catch { return []; }
}

/**
 * A row (packs/lorebook-make/plan.js lorebookRow with its pack id) → what the page draws:
 * `{ id, name, state, button, desc, upToDate, attach, linked, move, use: { on, disabled, note } }` (`button` '' when Up to date; `attach` the
 * "Use with this character" button of an up-to-date book not yet with the character; `move` the line moving it from this chat's lorebook).
 */
export function lorebookView(row) {
  const made = row.madeFrom ? `made from ${row.madeFrom}` : '';
  const desc = row.state === 'create' ? 'The pack’s lore as a SillyTavern lorebook the narrator reads (hidden lore stays out).'
    : row.state === 'update' ? `${row.name} · ${made || 'made from a version not known'}` : `${row.name} · ${made}`;
  return {
    id: row.id, name: row.name, state: row.state, button: BUTTON[row.state] ?? '', desc, upToDate: row.state === 'current',
    attach: row.state === 'current' && !row.linked && !row.use.disabled, linked: row.linked === true, move: row.move === true, use: { ...row.use },
  };
}
