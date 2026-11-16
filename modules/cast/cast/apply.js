// Story Director v2, part **cast**: how the three steps change the `cast` domain (pure: they change the draft they are given).
//
// * `sync`: the packs' cast entered, changed or left. New people join the world at the current story minute, at their start.
//   An unmet person whose entry changed takes the new words (name, aliases) and keeps where they are and what they do; a met
//   person keeps their dossier (it was made from the entry once; the pack never overwrites it); an entry that left the pack
//   takes an unmet person with it, quietly, and leaves a met one in the world.
// * `advance`: the planner's batch after a day change or a time skip: where people are and what they do now, a death where it is
//   allowed, the story minute the cast was moved to.
// * `meet`: the party and a person cross paths for the first time (no dice): `met` is set and the narrator is told this reply.
//
// The hook (index.js) runs the same functions on a copy of the state to know the world a step will leave, so what it decides and
// what the step does cannot differ. `env`: { now, rev, touch(key) (marks a change inside a person that a deleted reply may have
// made, `ctx.ifThere`), note(entry) (adds a note for the reply's card; absent on a copy), packName(pack) }.
//
// Public face: re-exports its parts.

export { planSync, syncEmpty, syncPayload } from './apply-parts/sync-plan.js';
export { applySync, newcomer } from './apply-parts/sync-apply.js';
export { applyAdvance } from './apply-parts/advance.js';
export { applyMeet, whyNarrator, whyText } from './apply-parts/meet.js';
export { applyJourney, applyRumor, applyWithdraw } from './apply-parts/travel.js';
