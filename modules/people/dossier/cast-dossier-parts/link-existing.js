// Linking a dossier that was made BEFORE its cast person was met (a "+ npc Sister Temiwa" line, a scan, a manual add) to that person's pack entry.
// Without `castFrom` such a dossier never got the pack's picture. Only `castFrom` is added (its `first` words only where the dossier still holds
// them) and, by the portrait rules, the pack picture where the dossier has none: no field the story wrote is touched. Pure: no host, no clock.

import { applyCastEntry } from './apply-entry.js';
import { dossierFor } from './dossier-lookup.js';
import { isObject } from './shared-text.js';

const sameWords = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The dossiers that should be linked to a met cast person now: [{ npc, person }]. A dossier qualifies when it has no `castFrom`, answers by name or
 * alias to exactly one met cast person, and no other dossier answers to that person. `dismissed(person)` says the reader removed that person.
 */
export function castLinkTargets(npcs, people, dismissed = () => false) {
    const list = Array.isArray(npcs) ? npcs : [];
    const out = [];
    for (const npc of list) {
        if (!isObject(npc) || npc.castFrom || npc.archived) continue;
        const matches = (Array.isArray(people) ? people : []).filter(person => person?.entry && dossierFor([npc], person));
        if (matches.length !== 1 || dismissed(matches[0])) continue;
        const person = matches[0];
        if (list.filter(other => dossierFor([other], person)).length !== 1) continue;
        if (list.some(other => other?.castFrom?.key === person.key)) continue;
        out.push({ npc, person });
    }
    return out;
}

/** The dossier with `castFrom` of the person's entry (a new object; the name, aliases and every other field are the dossier's own). */
export function linkToCast(npc, person, options = {}) {
    const filled = applyCastEntry(npc, person, options);
    if (!filled?.castFrom) return npc;
    const first = Object.fromEntries(Object.entries(filled.castFrom.first ?? {}).filter(([field, words]) => sameWords(npc[field], words)));
    return { ...npc, castFrom: { ...filled.castFrom, first } };
}
