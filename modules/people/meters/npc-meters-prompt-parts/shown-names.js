// Namesakes in the tail: their meter entries read Name "Nickname", and the tail says the line about a shared name it shows when nothing else sent does.
import { namesakes, sayWhich } from '../npc-meters-parts/namesakes.js';

/** → `npcs` itself when nobody listed is a namesake, else a copy with those entries' names replaced. `owners`: ownersOf over the same people. */
export function shownEntries(npcs, owners, people) {
    const shared = namesakes(people);
    if (!shared.groups.length) return npcs;
    return Object.fromEntries(Object.entries(npcs).map(([key, entry]) => {
        const label = shared.shown(owners.ownerOf(npcs, key)?.id);
        return [key, label ? { ...entry, name: label } : entry];
    }));
}

/**
 * → the lines for the shared names `lines` (the tail's, strings or { text }) show that `sentText()` (NPC State's own prompt for this reply: the dossier
 * text and the one-pass context) does not already say. `sentText` is asked only when a namesake is shown.
 */
export function unsaidWhich(lines, people, sentText) {
    const shared = namesakes(people);
    const text = lines.map(line => line?.text ?? line).join('\n');
    const shown = shared.groups.filter(group => group.members.some(member => text.includes(shared.shown(member.id))));
    if (!shown.length) return [];
    const sent = String(sentText() ?? '');
    return shown.map(sayWhich).filter(line => !sent.includes(line));
}
