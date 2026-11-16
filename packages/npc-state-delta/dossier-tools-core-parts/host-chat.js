/* NPC State Delta supporting tools: the active chat key, NPC lookup, the selected NPC and the dossier refresh request. */
import { plain } from './values.js';
import { api, uiRoot } from './host-api.js';

export function activeChatKey() {
    try { return plain(api()?.uiStatus?.()?.chatKey); } catch { return ''; }
}
export function npcById(id, options) {
    try { return api()?.getNpc?.(id, options) || null; }
    catch { return null; }
}
export function selectedNpcId() {
    const root = uiRoot();
    const selected = root?.__npcStateDeltaStage1Ui?.selectedNpcId || '';
    return plain(selected);
}
export function stage1Refresh() {
    try { uiRoot()?.__npcStateDeltaStage1Ui?.scheduleRefresh?.(); } catch {}
}
