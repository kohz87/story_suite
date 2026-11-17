/* NPC State one-pass lines builder: the context part (changes every reply). Sent by runtime-injection in hosted one-pass mode (N7).
   NSD14 (approved, plain header): the people the model may name, once each, then the story events to look for (NSD12, G8).
   `existingNpcs` the dossiers; `turn`, `dormantAfter` decide who is active (roster-count.js: not dead, not dormant); `namedNpcIds` the ids the player's
   message names, so an archived, dead or long-unseen person is listed only then; `eventWatch` [{ key (a note id), name, event }]. The list shape is the approved id, name, aliases only (a role-label person too); no lead line or reminder beyond the header. No registryState,
   no candidates, no live or stable context (the dossier injection already describes each present person). */
import { hiddenNoteEventLinesParagraph } from '../core-prompts-capture-parts/hidden-notes.js';
import { countsTowardCap } from '../roster-count.js';

export const PEOPLE_HEADER = 'People you know about (match by these names):';

/** The listed people: active ones (not archived, dead or dormant), plus any the player's message names. */
export function listedPeople({ existingNpcs = [], turn = 0, dormantAfter, namedNpcIds = [] } = {}) {
    const named = new Set(namedNpcIds);
    return existingNpcs.filter(npc => npc && (named.has(npc.id) || (!npc.archived && countsTowardCap(npc, turn, dormantAfter))));
}

export function buildLinesContext({ eventWatch = null, existingNpcs = [], turn = 0, dormantAfter, namedNpcIds = [] } = {}) {
    const events = hiddenNoteEventLinesParagraph(eventWatch);
    const people = listedPeople({ existingNpcs, turn, dormantAfter, namedNpcIds }).map(npc => ({
        id: npc.id,
        name: npc.name,
        aliases: (npc.aliases || []).slice(0, 8),
    }));
    return `${PEOPLE_HEADER}\n${JSON.stringify(people)}${events}`;
}
