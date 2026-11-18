/* NPC State supporting tools: the active chat key and NPC lookup. */
import { plain } from './values.js';
import { api } from './host-api.js';

export function activeChatKey() {
    try { return plain(api()?.uiStatus?.()?.chatKey); } catch { return ''; }
}
export function npcById(id, options) {
    try { return api()?.getNpc?.(id, options) || null; }
    catch { return null; }
}
