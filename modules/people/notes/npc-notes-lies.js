// NPC notes, lies told (phase 2 item 1): the slice record's `lies` leaf (one JSON text: [{ id, to, said, day, r, caught? }],
// at most six entries), its reader (readLies), adding a lie the story told (addLie), catching one (catchLie: stamps it and
// returns the trust change to run at a tier), the optional tail line for a present NPC's latest uncaught lie (lieTail), the
// dossier rows (lieRows: a `hidden` flag on every uncaught lie, and a `redact` option) and the caught receipt (caughtSummary).
// Pure: never imports npc-meters.js. The host writes the returned text inside the line's own op; nothing here touches storage.
// Public face: re-exports its parts.
export { LIES_MAX, LIE_TO_MAX, LIE_SAID_MAX, LIES_TEXT_MAX } from './npc-notes-lies-parts/shared-limits.js';
export { CAUGHT_TIER, CAUGHT_DROP, caughtChange } from './npc-notes-lies-parts/caught-rule.js';
export { readLies } from './npc-notes-lies-parts/read.js';
export { addLie } from './npc-notes-lies-parts/add.js';
export { catchLie } from './npc-notes-lies-parts/catch.js';
export { lieTail, lieRows, caughtSummary } from './npc-notes-lies-parts/view.js';
