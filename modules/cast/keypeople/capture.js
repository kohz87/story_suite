// Story Director v2, part **keypeople**: the change lines and the commands that write the `keypeople` domain.
//
// Kinds (feature `story-director.key-people`):
// - `away`: `+ away Ren — scouting the north road | back: Goldwane 18` (a key person leaves for a while; `~` changes what
//   they do or when they are due back), `! away Ren — reached Wolfmere Outpost` (a step on the timeline; `back:` may move
//   the date), `- away Ren` (they are back). Only a pinned person may be away.
// - `key`: `- key Ren | died` (the story records a death: the pin goes, with its reason). Nothing else takes someone off
//   the list from the story: the reader unpins. A person who is not pinned is recorded as dead too (a `gone` record with reason `died`, no pin
//   to take off) when the reply carries Story Block's `diedAny` rule mark (`ctx.carrier.rules`); on a reply without it the line finds nobody, as before.
//
// Commands:
// - `keypeople.pin { name, aliases?, nsd? }` and `keypeople.unpin { name }` (cause `ui`: the reader's, on the latest reply).
// - `keypeople.sync { who?, known? }` (cause `system`, from the hook before a reply, nsd.js): the people NPC State Delta says are
//   archived or dead are unpinned with that reason. Nothing is ever written to NPC State Delta. The step is stored on the reply before the
//   one being written, so its card line is not written here: the pin goes at once (the narrator must not be told of them) and the
//   `gone` record is marked `owed`.
// - `keypeople.tell { who }` (cause `system`, from the hook after the reply's lines, index.js): the card line of those removals, written on
//   the reply that was being written when they were decided, so it is that reply's card that says it.
//
// Replay: every record is added whole under its key; a change inside an away record is marked `ctx.ifThere` (so it is
// passed over when the reply that made the record was deleted); what a reply tells its card goes in `notes`, one new key
// per note (never changed after), the oldest replies' dropped.
// Public face: re-exports its parts.

export { capOf, pin, unpin } from './capture-parts/pin-commands.js';
export { applyAwayLine } from './capture-parts/away-line.js';
export { applyKeyLine } from './capture-parts/key-line.js';
export { sync, tell } from './capture-parts/sync-commands.js';
