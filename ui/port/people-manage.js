// The dossier's Edit, ⋯ › Delete and "Mark alive": answered through NPC State's public handle (its editor and its dossier tools), as Portrait and Refresh are.
// Merge is not here: NPC State has no merge to call, so the ⋯ menu leaves it out (port.can says no).

import { pageHandles } from '../../modules/people/runtime/handles.js';

const NO = message => ({ ok: false, code: 'FAILED', message });

/** The command names this file answers. */
export const MANAGE_NAMES = Object.freeze(['npc.edit', 'npc.delete', 'npc.markAlive']);

/** `npc.edit | npc.delete | npc.markAlive { personId, name? }`. `api` is NPC State's public handle (default `pageHandles.deltaApi`, set once NPC State is running). */
export async function manageCommand(type, payload, api = pageHandles.deltaApi) {
  const id = String(payload?.personId ?? payload?.name ?? '').trim();
  if (!id) return NO('Say which person.');
  const method = { 'npc.edit': 'openEditor', 'npc.delete': 'deleteNpc', 'npc.markAlive': 'updateLifeState' }[type];
  if (!method || typeof api?.[method] !== 'function') return NO('NPC State is not running, so this cannot be done now.');
  try {
    if (type === 'npc.edit') return api.openEditor(id) ? { ok: true } : NO('That person has no NPC State dossier to edit.');
    if (type === 'npc.delete') return (await api.deleteNpc(id)) ? { ok: true } : NO('That person could not be deleted (they may already be gone).');
    const chatKey = api.uiStatus?.()?.chatKey;
    return chatKey && (await api.updateLifeState(id, 'alive', { chatKey })) ? { ok: true } : NO('That person could not be marked alive.');
  } catch (error) {
    return NO(String(error?.message || 'That did not work.'));
  }
}
