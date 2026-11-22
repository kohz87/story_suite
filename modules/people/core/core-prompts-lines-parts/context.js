/* NPC State one-pass lines builder: the context part (changes every reply). Sent by runtime-injection in hosted one-pass mode (N7).
   NSD14 (approved, plain header): the people the model may name, once each, then the story events to look for (NSD12, G8).
   `existingNpcs` the dossiers; `turn`, `dormantAfter` decide who is active (roster-count.js: not dead, not dormant); `namedNpcIds` the ids the player's
   message names, so an archived, dead or long-unseen person is listed only then; `eventWatch` [{ key (a note id), name, event }]. The list shape is the approved id, name, aliases only (a role-label person too); no lead line beyond the header. No registryState,
   no candidates, no live or stable context (the dossier injection already describes each present person). */
import { hiddenNoteEventLinesParagraph } from '../core-prompts-capture-parts/hidden-notes.js';
import { countsTowardCap } from '../roster-count.js';

export const PEOPLE_HEADER = 'People you know about (match by these names):';
// (owner-approved 22 Nov: the narrator wrote mood lines for people in the background but skipped their memory: and goal:, so their dossiers waited for a
// Refresh; the reminder names who is in the scene, last in the context, so it sits close to where the lines are written. Owner-approved the same day: it is
// always sent, since the people of a reply often arrive in it (a scene empty before the reply had no names), and it names who the player's message calls too;
// owner-approved later that day: it asks for status: too, since an arrival's old status is cleared and "Right now" stayed empty; and a meter line when what
// happened changed how they feel, so someone who arrives in the reply is not left out of a meter move)
const PRESENT_MAX = 12;
const REMINDER = 'For each person in this reply (anyone who arrives too) who did or saw something that mattered, write their memory:, and status: and goal: if they changed (someone who arrives is always doing something new). If what happened changed how they feel about Astra, write that meter line too.';
export const presentReminder = names => `\n${names.length ? `People in this scene: ${names.join(', ')}. ` : ''}${REMINDER}`;

/** The listed people: active ones (not archived, dead or dormant), plus any the player's message names. */
export function listedPeople({ existingNpcs = [], turn = 0, dormantAfter, namedNpcIds = [] } = {}) {
    const named = new Set(namedNpcIds);
    return existingNpcs.filter(npc => npc && (named.has(npc.id) || (!npc.archived && countsTowardCap(npc, turn, dormantAfter))));
}

/** `present`: the names of the people in the scene now and those the player's message calls (never the dead); with none, the reminder is sent without names. */
export function buildLinesContext({ eventWatch = null, existingNpcs = [], turn = 0, dormantAfter, namedNpcIds = [], present = [] } = {}) {
    const events = hiddenNoteEventLinesParagraph(eventWatch);
    const people = listedPeople({ existingNpcs, turn, dormantAfter, namedNpcIds }).map(npc => ({
        id: npc.id,
        name: npc.name,
        aliases: (npc.aliases || []).slice(0, 8),
    }));
    const here = [...new Set((Array.isArray(present) ? present : []).map(name => String(name ?? '').trim()).filter(Boolean))].slice(0, PRESENT_MAX);
    return `${PEOPLE_HEADER}\n${JSON.stringify(people)}${events}${presentReminder(here)}`;
}
