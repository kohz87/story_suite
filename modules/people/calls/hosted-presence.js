/* NPC State hosted one-pass presence (role: hosted-presence). With one-pass lines on, no scan runs on an ordinary reply, so nothing marked who the story
   brought on stage: every record kept `present false`, `lastSeenTurn 0` and its old `location` (SOAKPEOPLE F7, F23, F45). After each live reply the scene's
   own list (Story Block's `scene.present` through the meters adapter's scenePresent(): the head's scene, which is this reply's; names resolved as
   scenePresenceView resolves them, the dead never) stamps the cache the way
   a scan's merge does (core-merge-incoming.js): present, last seen at this turn, seen once more; someone who arrives has their old "away" place cleared
   (unless the reader locked it). The cache's change is then stored for that reply by NPC State's own people.write, as a scan's is. */

import { resolveDossierTarget } from '../npc-api/dossier-target.js';
import { isTerminalNpcDeath } from '../core/terminal-lifecycle.js';
import { storyBlockIsV2 } from '../npc-api/host-probe.js';

const locked = npc => Array.isArray(npc?.manualProfileFields) && npc.manualProfileFields.includes('location');

/** The names in the host's scene now (`adapter`: adapterMeters()), or null when there is no v2 host or it cannot answer. */
export function sceneNames(adapter) {
    if (!adapter || !storyBlockIsV2()) return null;
    try { const names = adapter.scenePresent?.(); return Array.isArray(names) ? names : null; } catch { return null; }
}

/** Stamps `state.npcs` from the scene's `names` at `state.turn` → the ids present, or null when nothing was stamped (no scene answer). */
export function stampScenePresence(state, names) {
    const npcs = Array.isArray(state?.npcs) ? state.npcs : [];
    if (!Array.isArray(names)) return null;
    const here = new Set(names.map(name => resolveDossierTarget(npcs, name)).filter(Boolean).map(String));
    const turn = Number(state.turn || 0);
    const ids = [];
    for (const npc of npcs) {
        if (!npc?.id) continue;
        if (!here.has(String(npc.id)) || npc.archived || isTerminalNpcDeath(npc)) { if (npc.present) npc.present = false; continue; }
        if (!npc.present && npc.location && !locked(npc)) npc.location = '';
        npc.present = true;
        npc.worldActive = false;
        if (npc.lastSeenTurn !== turn) npc.seenCount = Number(npc.seenCount || 0) + 1;   // (once a turn: a second look at the same reply counts nothing)
        npc.lastSeenTurn = turn;
        ids.push(npc.id);
    }
    return ids;
}
