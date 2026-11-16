// Story Suite v2: the state store (SPEC §2, §12). State lives in carriers; this module replays it.
//
// * State at carrier N = the latest checkpoint at or before N, then every carrier's `ops` from there
//   through N. Head state = state at the last carrier. Rebuilding replays stored ops only; it never runs a
//   command handler.
// * A carrier that gets its first record also gets a checkpoint (the state before its own ops) when 100
//   carriers have passed since the last checkpoint, or the ops since then exceed 128 KB of JSON. Older
//   chats have them every 20 carriers / 32 KB: a checkpoint is read wherever it is.
// * Writes go to the head carrier (actions after reply N belong to reply N, so swiping or deleting reply N
//   takes them back) and only ever touch `extra.storySuite` and the matching `swipe_info` extra.
// * Each record is kept once (persist.js): the shown swipe's copy in `swipe_info` only on the last
//   carrier and on carriers with more than one swipe. When a reply gets its first record, the carrier
//   before it drops that copy, and the carrier `receiptKeep` back drops its receipts' `data`; a rebuild
//   does the same over the whole chat (so an older chat shrinks with its next save) and gives the last
//   carrier its copy back. Neither changes any state: replay reads `message.extra` only.
// * Told and untold (§4.1 step 2): a receipt is told once a carrier at or after its own lists its ID in
//   `narrated`. Untold receipts are the `narrate: true` ones that no such carrier lists, oldest first. "At
//   or after" rather than "after" so a cue committed on the head carrier while it is being re-generated
//   (a swipe) counts as told by that same carrier.
// * Replay goes block by block (`spans`: one block per stored receipt, one for a Re-read's story changes):
//   a block that no longer applies (a middle reply deleted, a hand-edited chat) is skipped and reported
//   alone; its receipts' revs still count. Everything stored before and after it still applies, so a
//   command committed onto such a carrier survives the next rebuild, and so does its claim.
// * Guarded blocks (docs/v2/REPLAY.md, contract §6): a block a module attached a guard to (ctx.replayGuard)
//   has a span with more than `{ n, story }`: its id, module, source, guard, claims, boundaries, operation,
//   recorded inputs, result and replan. On replay such a block is applied only when its source still
//   matches its carrier, its claims are the ones its ops make and the owner's `hooks.replayGuard` says
//   yes on the state before it; then its ops and its claims go in together, else neither (it stays stored
//   and inactive, REPLAY_PREREQUISITE). A span without an `id` is a legacy block and replays as before.
// * Proof (docs/v2/EVIDENCE.md, contract §6): a block that gives proof keeps it on its span (`evidence`) and pins
//   it in `meta.proofs` with the same ops; the span must hold exactly the proof its ops pin, or it is not
//   applied. `store.proofs()` lists the stored proof of the chat in source order; which of it is active is what
//   the state pins (evidence.js), so a skipped block, a deleted reply or another swipe publishes nothing.
// * The carrier source map (`record.source`, contract §4): each record carries the canonical pair of its
//   logical message and swipe, worked out from its stored `sid` and persisted with it.
// * Every state handed out is deep-frozen. The head and the checkpoints are cached; the cache is checked
//   against the chat on each read, and `rebuild()` drops it.

//
// Public face: re-exports its parts.
export { createStore } from './store-parts/create.js';
export { CHECKPOINT_EVERY, CHECKPOINT_BYTES, CHECKPOINT_MIN_GAP, NO_LONGER_DONE, deepFreeze } from './store/constants.js';
