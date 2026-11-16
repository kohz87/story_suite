/* NPC State one-pass lines builder: the context part (changes every reply). Sent by runtime-injection in hosted one-pass mode (N7).
   NSD14 (approved, plain header): the people the model may name, once each, then the story events to look for (NSD12, G8).
   `existingNpcs` the dossiers; `turn`, `dormantAfter` decide who is active (roster-count.js: not dead, not dormant); `namedNpcIds` the ids the player's
   message names, so an archived, dead or long-unseen person is listed only then; `eventWatch` [{ key (a note id), name, event }]. No registryState,
   no candidates, no live or stable context (the dossier injection already describes each present person). */
import { hiddenNoteEventLinesParagraph } from '../core-prompts-capture-parts/hidden-notes.js';
import { isInterimNpcLabel } from '../core-identity.js';
import { cleanText } from '../core-text.js';
import { countsTowardCap } from '../roster-count.js';

export const PEOPLE_HEADER = 'People you know about (match by these names):';
export const PEOPLE_NOTE = '(active people only; archived and long-unseen people are listed by name only when the reply names them; no registryState; each present person described once in the prompt.)';

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
        ...(isInterimNpcLabel(npc.name, npc.identityKind) ? { identityKind: 'role_label', role: cleanText(npc.role, 120), location: cleanText(npc.location, 120) } : {}),
    }));
    if (!existingNpcs.length && !events) return '';
    return `${PEOPLE_HEADER}\n${JSON.stringify(people)}\n${PEOPLE_NOTE}${events}`;
}
