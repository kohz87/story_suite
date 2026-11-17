// The dossier's ⋯ › Refresh: re-reads the recent story for one person through NPC State's own Refresh (the rolling catch-up's call, the one-pass default).

import { pageHandles } from '../../modules/people/runtime/handles.js';

const NO = message => ({ ok: false, code: 'FAILED', message });

/** `npc.refresh { name }` from a dossier: runs NPC State's Refresh for that person and says what happened. `api` is NPC State's public handle (default `pageHandles.deltaApi`, set once NPC State is running). */
export async function refreshCommand(payload, api = pageHandles.deltaApi) {
  const name = String(payload?.name ?? '').trim();
  if (!name) return NO('Refresh needs a person.');
  if (typeof api?.refreshFromChat !== 'function') return NO('NPC State is not running, so there is nothing to re-read with.');
  try {
    const done = await api.refreshFromChat(name);
    return done ? { ok: true, message: `Re-read the recent story for ${name}.` } : NO(`Could not re-read the story for ${name} now (a scan is running, or there is no recent story text).`);
  } catch (error) {
    return NO(String(error?.message || `Refresh failed for ${name}.`));
  }
}
