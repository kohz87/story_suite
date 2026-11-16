// Finding the dossier that stands for a cast person, and the short pack name for the badge.

import { clip, labelKey } from './shared-text.js';

/** Whether a dossier already stands for this person: one made from this key, or one that answers to their name or an alias. */
export function dossierFor(npcs, person) {
    if (!person) return null;
    const mine = [person.name, person.entry?.name, ...(person.aliases ?? []), ...(person.entry?.aliases ?? [])].map(labelKey).filter(Boolean);
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        if (npc?.castFrom?.key === person.key) return npc;
    }
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        const theirs = [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])].map(labelKey).filter(Boolean);
        if (theirs.some(label => mine.includes(label))) return npc;
    }
    return null;
}

/** A pack's name as the badge says it: "Ersveil (open world)" → "Ersveil" (a bracketed note or a subtitle after a dash or colon is left off). */
export function shortPackName(name) {
    const text = clip(name, 80).replace(/\s*[([{][^)\]}]*[)\]}]/g, ' ').split(/\s+[-–—]\s+|:\s/)[0];
    return clip(text, 40);
}
