/* NPC State roster cap: who counts toward "Maximum active NPCs". One job: derive it from the record, so replay gives what live gave. */
import { isTerminalNpcDeath } from './terminal-lifecycle.js';

const DORMANT_AFTER_DEFAULT = 30;

// Dormant: not in the scene and unseen for `dormantAfter` replies (the "Dormant after" setting, key staleArchiveAfter). Nothing is deleted or hidden; the person
// counts again the moment the story brings them back (their last-seen reply moves up, or they are present).
export function isDormantNpc(npc = {}, turn = 0, dormantAfter = DORMANT_AFTER_DEFAULT) {
    if (npc?.present || npc?.worldActive) return false;
    const limit = Math.max(1, Math.round(Number(dormantAfter) || DORMANT_AFTER_DEFAULT));
    const last = Math.max(Number(npc?.lastSeenTurn || 0), Number(npc?.lastWorldActiveTurn || 0));
    return Math.max(0, Number(turn || 0) - last) >= limit;
}

// The dead and the dormant take no slot.
export function countsTowardCap(npc, turn = 0, dormantAfter = DORMANT_AFTER_DEFAULT) {
    return Boolean(npc) && !isTerminalNpcDeath(npc) && !isDormantNpc(npc, turn, dormantAfter);
}

export function rosterCount(npcs, turn = 0, dormantAfter = DORMANT_AFTER_DEFAULT) {
    return (Array.isArray(npcs) ? npcs : []).filter(npc => countsTowardCap(npc, turn, dormantAfter)).length;
}

export const capMessage = max => `NPC State: the roster is full (${max}). Dead people and people unseen for a long while do not count toward the cap.`;
