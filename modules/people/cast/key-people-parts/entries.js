// Reading a key-people entry: is it current, is it away, whose names it carries, which entry names a dossier.

import { labelKey } from './shared-text.js';

/** Whether the entry is a current key person (pinned, not removed). */
export const isKey = entry => Boolean(entry) && !entry.removed;
/** Whether the entry is a current key person who is away now. */
export const isAway = entry => isKey(entry) && Boolean(entry.away);

/** The comparison keys of an entry's name and aliases. */
export const labelsOf = entry => [entry?.name, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])].map(labelKey).filter(Boolean);

/** The entry of `list` that names the dossier (by its name or an alias, either side), or null. */
export function findKeyEntry(list, npc) {
    if (!Array.isArray(list) || !list.length || !npc) return null;
    const mine = [npc.name, ...(Array.isArray(npc.aliases) ? npc.aliases : [])].map(labelKey).filter(Boolean);
    if (!mine.length) return null;
    return list.find(entry => labelsOf(entry).some(label => mine.includes(label))) ?? null;
}
