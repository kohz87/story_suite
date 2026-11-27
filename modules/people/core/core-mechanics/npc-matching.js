// Matches a scan row to an NPC by id, name or alias, and finds the earlier records that are that NPC.
import { npcMatchesLabel } from '../core-record.js';

// A scan row or profile update is about this NPC: the same id, its name, or one of its aliases. A row tied to one namesake (`settledId`,
// ../core-merge-namesakes.js) is about that id alone.
export function scanRowMatchesNpc(raw = {}, npc = {}) {
    if (raw?.settledId) return String(raw.settledId) === String(npc?.id);
    if (raw?.id && String(raw.id) === String(npc?.id)) return true;
    if (raw?.name && npcMatchesLabel(npc, raw.name)) return true;
    return Array.isArray(raw?.aliases) && raw.aliases.some(alias => npcMatchesLabel(npc, alias));
}

// The records in `source` (the people before a merge or command) that are this NPC: its own id, and the ids the merge folded into it
// (`folded`: report.deduplicated, in order). A record that shares a name or alias and keeps its own id is another person: nothing of it is carried.
export function ownNpcRecords(npc, source = [], folded = []) {
    const ids = new Set([String(npc?.id || '')]);
    for (let i = (folded || []).length - 1; i >= 0; i -= 1) if (ids.has(String(folded[i].keptId))) ids.add(String(folded[i].removedId));
    return (Array.isArray(source) ? source : []).filter(item => item && ids.has(String(item.id || '')));
}
