// The dossier's ⋯ › Portrait: opens NPC State's portrait manager (view, upload, generate, remove) for that person.
// A page dialog, not an engine command: nothing is recorded, so replay never sees it.

import { pageHandles } from '../../modules/people/runtime/handles.js';

const NO = message => ({ ok: false, code: 'FAILED', message });

/** `npc.portrait { name }` from a dossier. `api` is NPC State's public handle (default `pageHandles.deltaApi`, set once NPC State is running). */
export function portraitCommand(payload, api = pageHandles.deltaApi) {
  const name = String(payload?.name ?? '').trim();
  if (!name) return NO('The portrait manager needs a person.');
  if (typeof api?.openPortraitTools !== 'function') return NO('NPC State is not running, so its portrait manager cannot open.');
  try {
    return api.openPortraitTools(name) ? { ok: true } : NO(`${name} has no NPC State dossier to put a portrait on.`);
  } catch (error) {
    return NO(String(error?.message || 'The portrait manager did not open.'));
  }
}
