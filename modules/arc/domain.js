// Story Director v2, part **arc**: the `arc` domain, its validator, its query and its tail line (pure).
//
// arc = {
//   arcs: { [arcId]: { id, key, desc, rev, minutes, reason, note } },  // one per accepted plan, never changed
//   ends: { [arcId]: { rev, reason } },                                 // an arc ended (End arc, or every beat played)
// }
// Bookkeeping later replies write (WAVE rule 2): each arc and each ending is added whole under its own
// key and never written into again. The current arc is the newest one (by `rev`); a newer plan
// supersedes the one before it without touching it, and it is over once `ends` has its id. Deleting the
// reply that holds an accepted plan takes its arc (and its new threads) away; an ending whose arc went
// with a deleted reply is passed over. The oldest arcs past ARC_ROOM are removed by key (Story Block
// passes over the removal of a key a deleted reply had made).
// The arc's beats, agendas, hooks, clocks and secrets are the tracker's own threads (`director`), each
// tagged with the arc's id (`track.arc`), so the Director note, lapses and the screens treat them as any
// other thread.
//
// Public face: re-exports its parts.

export { ARC_ROOM, FEATURE, initialArc } from './domain-parts/shared-records.js';
export { validateArc } from './domain-parts/validate.js';
export { arcList, currentArc, threadsWithArc, arcQuery } from './domain-parts/query.js';
export { ARC_TAIL_BUDGET, arcTail } from './domain-parts/tail.js';
