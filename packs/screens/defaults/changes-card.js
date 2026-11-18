// `story-block/changes-card` (SPEC §13.1, §13.4): the inline card under a reply, "Changed this reply".
// The card mount gives it **that reply's** state and the JSON Pointers that reply's ops touched, so the
// template lists only what `changed()` says moved: the stacks touched (with what is held now), the
// wallet, the place and who is present, and the loot the reply laid out (`? loot`) as chips to tick
// with a "Take selected" button (`inventory.lootTake`; once taken, "Taken.").
//
// The card's collapsed header is one line from the mount's `summary` hook. `changesSummary` (below)
// writes it from the reply's state and the state before it, so it can say what was gained and lost:
// "+1 Moonveil Trout, −1 Rope · +30 gold · to Bluewatch Village · Fenna arrived". A stack used up
// completely is gone from the reply's state, so only the header (which sees the state before) names it.
//
// Modules add their own lines (MODULES §F125): a module's `hooks.replyCard({ index, state, before, changes })`
// answers [{ text, summary?, flag?, note?, icon? }] for that reply (an example module: the checks it rolled, the die,
// the modifiers and the total against the difficulty). `replyCardLines` cleans them (one line each, cut by
// code points, at most REPLY_LINES_MAX per module, a Font Awesome icon name or a default); the host puts them in
// the card's scope as `moduleLines` (ui-host.js) and their `summary` (else their `text`) in the header line.
// Plain text only: the template prints them escaped.
// Pure: no DOM.
// Public face: re-exports its parts.
export { CHANGES_CARD_SCREEN_ID, changesCardScreen } from './changes-card-parts/screen.js';
export { changesDigest } from './changes-card-parts/digest.js';
export { replyCardLines, REPLY_LINES_MAX, mergeRpgLines } from './changes-card-parts/reply-lines.js';
export { changesSummary } from './changes-card-parts/summary.js';
