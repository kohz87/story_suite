// The grammar lines the host sends per kind and the kinds entries built from them.
import { FEATURE_NOTES } from '../../meters/npc-meters-config.js';
import { KINDS } from './handlers.js';

// ---- the host's side: grammar lines, the label parser and the player's view ----

// One short grammar line per kind, sent only while the notes feature is on (the host leaves a kind's grammar out when its feature is off).
// {{user}} is the host's macro, filled in static parts (same bytes every reply). Each line says when to write it and gives one example in the same grammar (the live runs never saw these written from the bare templates).
const GRAMMAR = Object.freeze({
    lie: '~ lie Name | to: {{user}} | said: the false claim (write it when someone lies to {{user}}; | caught: yes once the story exposes it; e.g. ~ lie Person A | to: {{user}} | said: I was home all night)',
    know: '~ know Name | about: Other | fact: what they learned | how: saw or heard (write it when someone learns something about another person; | secret: yes if kept hidden, later | told: yes; e.g. ~ know Person A | about: Person B | fact: owns a spare key | how: heard | secret: yes)',
    taste: '~ taste Name | likes: or dislikes: an item | from: why (write it when someone shows a like or dislike; e.g. ~ taste Person A | likes: an item | from: asked for more)',
    tie: '~ tie Name | with: Other | tag: +ally, +rival or +owes (-tag drops it; write it when two people ally, rival or owe; e.g. ~ tie Person A | with: Person B | tag: +owes)',
});

/** The `kinds` entries for the host: every note kind handled by `capture` and behind the notes feature. */
export const noteKinds = capture => Object.fromEntries(Object.keys(KINDS).map(kind => [kind, { grammar: GRAMMAR[kind], apply: capture, feature: FEATURE_NOTES, after: ['time'] }]));
export const isNoteKind = kind => Object.hasOwn(KINDS, kind);
export const noteField = kind => KINDS[kind]?.field ?? null;
