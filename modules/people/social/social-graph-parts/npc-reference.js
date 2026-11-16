/* NPC State Delta: finds a dossier by id, name or alias and lists its labels. */
import { clean, norm, uniq } from '../social-primitives.js';

// (ONEPASSCAP-3) A dossier id as a model may write it: the exact id, else the one dossier whose id matches with '-', '_' and case folded
// ("npc_sister_temiwa" for npc_sister-temiwa); null when none or several do.
const idFold = value => String(value || '').trim().toLowerCase().replace(/[-_\s]+/g, '_');
export function resolveNpcId(npcs = [], id = '') {
    const raw = clean(id, 120);
    if (!raw) return null;
    const byId = (npcs || []).filter(npc => String(npc?.id || '') === raw);
    if (byId.length === 1) return byId[0];
    const folded = (npcs || []).filter(npc => npc?.id && idFold(npc.id) === idFold(raw));
    return folded.length === 1 ? folded[0] : null;
}

export function resolveNpcReference(npcs = [], labelOrId = '', { historicalRead = false } = {}) {
    const raw = clean(labelOrId, 120);
    if (!raw) return null;
    const byId = historicalRead ? (npcs || []).find(npc => npc?.id === raw) : resolveNpcId(npcs, raw);
    if (byId) return byId;
    const key = norm(raw);
    if (!key) return null;
    const matches = (npcs || []).filter(npc => [npc?.name, ...(npc?.aliases || [])].some(value => norm(value) === key));
    return matches.length === 1 ? matches[0] : null;
}

export function npcLabels(npc) {
    return uniq([npc?.name, ...(npc?.aliases || [])]);
}
