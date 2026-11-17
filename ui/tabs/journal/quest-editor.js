// Opens the quest editor in a sheet and sends the changed fields (or give up, or delete) to the port.
import { openSheet } from '../../kit/sheet.js';
import { questSheet } from './quest-sheet.js';
import { can } from '../../runtime/can.js';

/**
 * Opens the editor for `quest`; ctx = { port | command, doc, backStack, refresh }; opts.rpg is false for tasks. Returns the sheet handle.
 * Save sends `quest.edit` with only the changed fields (nothing is sent when nothing changed); the ⋯ buttons send `quest.giveup` and `quest.delete`.
 */
export function openQuestEditor(ctx = {}, quest, { rpg = true } = {}) {
  const send = ctx.command ?? (ctx.port ? ctx.port.command.bind(ctx.port) : () => {});
  const sheet = openSheet(ctx, { id: 'quest-editor', label: `Edit ${rpg ? 'quest' : 'task'}` });
  const finish = async (type, payload) => {
    if (type) await send(type, payload);
    sheet.close();
    ctx.refresh?.();
  };
  sheet.body.appendChild(questSheet(quest, {
    rpg,
    onSave: patch => finish(Object.keys(patch).length ? 'quest.edit' : null, { id: quest.id, patch }),
    onGiveUp: () => finish('quest.giveup', { id: quest.id }),
    onDelete: () => finish('quest.delete', { id: quest.id }),
    onClose: () => sheet.close(),
    allow: { edit: can(ctx, 'quest.edit'), giveUp: can(ctx, 'quest.giveup'), del: can(ctx, 'quest.delete') },
  }));
  return sheet;
}
