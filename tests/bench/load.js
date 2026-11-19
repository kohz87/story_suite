// Story Suite v2 storage benchmark (docs/v2/PERFORMANCE.md): a whole host from the testkit with the core
// module plus a synthetic module shaped like RPG Battle and Story Director, driven through a long chat.
//
// The load, per the performance brief: a party of 4, 60 inventory stacks, 40 Director threads, 5 change
// lines per reply (an item, a coin, an HP change, a thread change, the clock) and 3 UI commands every 4
// replies. Everything is deterministic (fixed IDs, fixed text), so two runs store the same bytes; only
// the timings vary.
//
// What it measures (`runScenario`): the chat's JSON size as SillyTavern would write it, the bytes the
// storySuite records add per reply, checkpoints, how many saves each reply costs, the time of a head
// rebuild after a chat load and after a swipe of the last reply, the time of each capture and each UI
// command, and the memory the store's caches hold. `relayout` and `compactOps` replay a finished chat
// under other checkpoint and op rules, for the tuning tables; they change nothing in the runtime.
//
// tests/bench/smoke.test.js runs a short version in `npm test`; scripts/core/bench-v2.mjs runs the full one.

// Public face: re-exports its parts.

export { MODULE_ID, PARTY_SIZE, STACKS, THREADS, CHANGES_PER_REPLY, UI_EVERY, UI_COMMANDS, V1_BLOCK_CHARS, actorId, threadId, threadTitle, itemName, createBenchModule } from './load-module.js';
export { replyText, changeLines, userText, uiCommands } from './load-text.js';
export { stats, chatBytes, breakdown, bareChat, v1Block, v1Size, measureLoad, measureSwipe } from './load-measure.js';
export { CONTEXT_MESSAGES, sendFast, runScenario } from './load-run.js';
export { relayout, compactCarrierOps, compactOps, stripOldReceipts, singleCopy, everyCopy, sameHead } from './load-relayout.js';
