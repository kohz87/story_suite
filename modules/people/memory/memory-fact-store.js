// Memory facts (design MEMDESIGN2 §6, §7): the identity-aware memory pipeline for a dossier that carries a `memoryFacts` sidecar, and the
// one place the five-slot order is decided. A dossier without a sidecar and without new fact candidates never comes here: its callers run the
// original normalize/merge/stamp functions byte for byte (core-record-merge.js, core-record-shared.js).
//   Priority (total): 1 reader pins > 2 proven first meeting (M) > 3 class A facts > 4 class O facts > 5 ordinary memories.
//   Newest source reply first within a class, ties by key. Model `memoryRetention` orders only the ordinary slots.
//   Amendment 6: the approved order stands, so enough automatic facts CAN take every non-pinned slot and starve model memories; the
//   owner signs that off (see MEMBUILD.REPORT.md). Exactly-equal normalized text is the only thing that suppresses an ordinary memory against a fact.
// Public face: re-exports its parts.
export { chooseSlots } from './memory-fact-store-parts/slots.js';
export { normalizeFactMemories } from './memory-fact-store-parts/normalize.js';
export { admitCandidates } from './memory-fact-store-parts/admit.js';
export { mergeFactMemories, isFactKey } from './memory-fact-store-parts/merge.js';
