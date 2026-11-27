// The meter entries as the tail names them: a namesake's entry reads Name "Nickname", every other entry is the stored one.
import { namesakes } from '../npc-meters-parts/namesakes.js';

/** → `npcs` itself when nobody listed is a namesake, else a copy with those entries' names replaced. `owners`: ownersOf over the same people. */
export function shownEntries(npcs, owners, people) {
    const shared = namesakes(people);
    if (!shared.groups.length) return npcs;
    return Object.fromEntries(Object.entries(npcs).map(([key, entry]) => {
        const label = shared.shown(owners.ownerOf(npcs, key)?.id);
        return [key, label ? { ...entry, name: label } : entry];
    }));
}
