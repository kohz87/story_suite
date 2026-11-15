/* NPC State Delta label matching: whether a dossier answers to a name or alias. */
import { normalizeName } from '../core-text.js';

export function npcMatchesLabel(npc, label) {
    const key = normalizeName(label);
    if (!key || !npc) return false;
    return [npc.name, ...(npc.aliases || [])].some(value => normalizeName(value) === key);
}
