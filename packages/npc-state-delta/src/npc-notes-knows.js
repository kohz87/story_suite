// NPC notes, "knows about others" (the `~ know` line): the stored list of what a person knows about someone else (one JSON text
// leaf per record, each entry keyed by its reply `r` so a Re-read of the same reply replaces its own entries), the input check, the
// secret redaction (a secret fact shows as "a secret about X · hidden" until the story opens it with openKnow, or the caller asks
// to show it), the one optional tail line per present person, and the dossier rows. Pure: no storage, no host, and it never imports
// npc-meters.js, so it runs alone in tests. The host decides who is present and what is optional.
// Public face: re-exports its parts.
export { KNOWS_MAX, KNOW_FACT_MAX, KNOW_ABOUT_MAX, KNOWS_TEXT_MAX } from './npc-notes-knows-parts/shared-limits.js';
export { KNOWS_TAIL_PER_NPC, KNOWS_TAIL_MAX, KNOW_HOW, KNOW_RULE } from './npc-notes-knows-parts/shared-marks.js';
export { readHow } from './npc-notes-knows-parts/how.js';
export { readKnows } from './npc-notes-knows-parts/read.js';
export { addKnow } from './npc-notes-knows-parts/add.js';
export { knowRuleFor, markKnowResult } from './npc-notes-knows-parts/rule.js';
export { openKnow } from './npc-notes-knows-parts/open.js';
export { knowFact, knowsView, knowsTail } from './npc-notes-knows-parts/view.js';
