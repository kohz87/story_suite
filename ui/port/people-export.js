// The Tools page's Chat data › Export for the port: this chat's people (dossiers and portraits) as NPC State's own file, made by NPC State's export.
import { pageHandles } from '../../modules/people/runtime/handles.js';
import { decodeNpcStateBundle } from '../../modules/people/bundle/bundle.js';

const NO = message => ({ ok: false, code: 'FAILED', message });
// How many people the file holds, read back from the file itself (null when it cannot be read).
const countOf = bytes => { try { const npcs = decodeNpcStateBundle(bytes)?.state?.npcs; return Array.isArray(npcs) ? npcs.length : null; } catch { return null; } };
const said = n => (n === null ? 'Exported this chat’s people.' : n === 0 ? 'Exported: this chat has no people yet.' : `Exported ${n} ${n === 1 ? 'person' : 'people'}.`);
const chatOf = api => { try { return String(api?.uiStatus?.()?.chatKey ?? ''); } catch { return ''; } };

/**
 * `settings.action` with key `tools.people.export` → { ok: true, bytes, name, message } (the file to save: NPC State's bundle of this chat's people; the message says how many it holds) or
 * a failure that says why. The chat is the one open when the button was pressed; a chat change while it is made exports nothing.
 * `api` is NPC State's public handle (default `pageHandles.deltaApi`). Any other command is not ours: null.
 */
export async function peopleExportCommand(type, payload, api = pageHandles.deltaApi) {
  if (type !== 'settings.action' || payload?.key !== 'tools.people.export') return null;
  if (typeof api?.exportBytes !== 'function') return NO('NPC State is not running, so there are no people to export.');
  const chat = chatOf(api);
  if (!chat || chat === 'no-chat') return NO('Open a chat first.');
  try {
    if (typeof api.ensureFresh === 'function' && !(await api.ensureFresh({ reason: 'dossier-export' }))) return NO('The chat changed before the export; nothing was exported.');
    const bytes = await api.exportBytes({ chatKey: chat });
    if (!bytes) return NO('NPC State gave nothing to export.');
    if (chatOf(api) !== chat) return NO('The chat changed during the export; nothing was exported.');
    return { ok: true, bytes, name: `npc-state-${Date.now()}.npcstatedelta`, message: said(countOf(bytes)) };
  } catch (error) {
    return NO(`The export did not work: ${error?.message ?? error}`);
  }
}
