/* NPC State Delta hosted tastes (role: hosted-tastes). A Refresh's answered tastes sent to the host as npc.taste. Moved from
   runtime-hosted.js without change; the factory takes the closures it read there. */
import { replayScope } from '../runtime-scan-helpers.js';
import { npcMatchesLabel } from '../core.js';

export function createTastes({ storySuiteV2Meters, chatHeadUnchanged, latestMessageId }) {
    // A Refresh's answered tastes (the target's row of `rows`: { tastes: [{ sign, item, from }] }) → npc.taste on the head reply the Refresh read, once the
    // chat is known not to have moved (as forwardSecretEventsToHost). Nothing while replaying.
    function forwardTastesToHost(npc, rows, head = null) {
        if (replayScope()) return;
        const adapter = storySuiteV2Meters();
        const list = Array.isArray(rows) ? rows : [];
        const row = list.find(item => String(item?.id || '') === npc?.id || (item?.name && npcMatchesLabel(npc, String(item.name)))) || (list.length === 1 ? list[0] : null);
        if (!adapter || !npc || !Array.isArray(row?.tastes) || !row.tastes.length) return;
        if (!chatHeadUnchanged(head)) return;
        const reply = latestMessageId(true);
        void adapter.tastes({ name: npc.name, tastes: row.tastes, ...(reply >= 0 ? { reply } : {}) });
    }

    return { forwardTastesToHost };
}
