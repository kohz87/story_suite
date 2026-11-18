// Settings › Tools › NPC State data: Back up, Restore and Diagnostics open NPC State's own data dialogs. Page dialogs, not engine commands: nothing is recorded, so replay never sees them.

import { pageHandles } from '../../modules/people/runtime/handles.js';

const NO = message => ({ ok: false, code: 'FAILED', message });
const KINDS = { 'tools.npcdata.backup': 'backup', 'tools.npcdata.restore': 'restore', 'tools.npcdata.diagnostics': 'diagnostics' };

/** Returns true when `key` is one of the three data actions (what `dataCommand` answers). */
export const isDataKey = key => Object.hasOwn(KINDS, String(key ?? ''));

/** `settings.action` with a `tools.npcdata.*` key → { ok: true } once the dialog (or the download) was started, else a failure that says why. `api` is NPC State's public handle (default `pageHandles.deltaApi`). */
export function dataCommand(key, api = pageHandles.deltaApi) {
  if (typeof api?.openDataTool !== 'function') return NO('NPC State is not running, so its data tools cannot open.');
  try {
    return api.openDataTool(KINDS[key]) ? { ok: true } : NO('That data tool is not there.');
  } catch (error) {
    return NO(String(error?.message || 'The data tool did not open.'));
  }
}
