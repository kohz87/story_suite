// The Story › Trackers commands for the port: Show on Now, a value changed by hand, remove, and adding a tracker from a template.

import { BLOCK_STARTERS } from '../../modules/data-modules/block-starters.js';
import { buildBlock } from '../../modules/data-modules/block-builder.js';

const NO = (message) => ({ ok: false, code: 'FAILED', message });
const copy = (value) => JSON.parse(JSON.stringify(value));

function rowOf(sdk, id) {
  const rows = sdk?.query?.('dataModules.setup', {});
  return (Array.isArray(rows) ? rows : []).find((row) => row?.module === id && row.pinned === true) ?? null;
}

// The pinned definition without the ids the engine writes itself, as the old Blocks page sent it back.
function rawOf(row) {
  const definition = copy(row.pinnedDefinition ?? row.definition);
  delete definition.id;
  delete definition.pack;
  return definition;
}

async function pin(sdk, { id, on }) {
  const row = rowOf(sdk, id);
  if (!row) return NO('That tracker is not in this chat.');
  const definition = rawOf(row);
  const was = definition.show ?? { tabName: [...definition.name].slice(0, 24).join(''), icon: 'ph-bookmark-simple' };
  definition.show = { ...was, tab: Boolean(was.tab), card: on === true };
  return sdk.command('dm.redefine', { module: id, definition });
}

// A starter is a draft like one the reader typed: built under a slug of its own when the chat already has that name.
async function add(sdk, { template }) {
  const starter = BLOCK_STARTERS.find((item) => item.id === template);
  if (!starter) return NO('That template does not exist.');
  const rows = sdk?.query?.('dataModules.setup', {});
  const used = (Array.isArray(rows) ? rows : []).map((row) => row.module);
  const draft = starter.draft();
  const built = buildBlock({ ...draft, show: { ...draft.show, tab: false, card: false } }, { used });
  if (!built?.ok) return NO(built?.errors?.[0]?.message ?? 'That template could not be made.');
  return sdk.command('dm.define', { definition: built.definition });
}

/**
 * `tracker.pin` { id, on } sets the block's Show on Now; `tracker.set` { id, fields: { key: value } } writes values by hand in one action;
 * `tracker.remove` { id } removes a block this chat made; `tracker.add` { template } makes one from a starter template (not shown on Now until you switch it on).
 * Any other command is not the Trackers': returns null. Every change goes through the engine's own dm.* commands, so replay sees what live saw.
 */
export async function trackerCommand(sdk, type, payload) {
  if (typeof sdk?.command !== 'function') return type.startsWith('tracker.') ? NO('The engine has no command.') : null;
  if (type === 'tracker.pin') return pin(sdk, payload ?? {});
  if (type === 'tracker.set') return sdk.command('dm.set', { module: payload?.id, fields: payload?.fields ?? {} });
  if (type === 'tracker.remove') return rowOf(sdk, payload?.id)?.packId === 'chat' ? sdk.command('dm.remove', { module: payload.id }) : NO('Only a tracker made in this chat can be removed here.');
  if (type === 'tracker.add') return add(sdk, payload ?? {});
  return null;
}
