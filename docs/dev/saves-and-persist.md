# Saves and persistence

Where state lives, how it is replayed and how it reaches the chat file. Detail: SPEC §2.2 (records,
checkpoints, replay rules a–d, counters), §2.4 receipts, §3.3 saving; PERFORMANCE.md ("Storage tuning",
"Checkpoint rule", "Saves"); REVIEW.md risky part §1.

## Rules

- Only **carriers** hold state (greeting, assistant and system replies): `message.extra.storySuite =
  { v: 2, checkpoint?, ops, receipts, narrated, sid, swipe, mark, spans, rev, covers? }`. User messages hold nothing.
- **State at N** = latest checkpoint that still holds (`covers` matches) + every carrier's ops through N,
  replayed block by block (`spans`). A block that no longer applies is skipped and reported alone.
- Checkpoints: the greeting always; then every `CHECKPOINT_EVERY` (100) carriers, or when ops exceed
  `CHECKPOINT_BYTES` (128 KB) and twice the last checkpoint, at least `CHECKPOINT_MIN_GAP` (10) after it.
- **Counters** (`counters` paths, e.g. `wallets/*/coin`, `stacks/*/qty`) keep `was`; on replay a moved count
  adds its change. `ctx.absolute(domain, path)` stores a set without `was` (`~ time <date>`).
  `ctx.ifThere(domain, path)` stores writes `within` a thing, passed over when it is gone (rule d).
  `ctx.unique(domain, path)` stores appends to a list as `unique`, passed over when the list holds the item (rule e).
- Per-reply bookkeeping under `ctx.carrier.sid` with `add`; domains may name `scratch` fields. Never a
  positional append or a `replace` of a field another reply created.
- Receipt `data` older than `RECEIPT_KEEP` (200) carriers is dropped, except `data.v2` (a guarded block's guard,
  source and result); keep what you need in your own state.
- **Guarded blocks** (`ctx.replayGuard`, REPLAY.md): the span carries the block's id, source, guard, claims and more;
  replay applies the ops and claims together only while the owner's `hooks.replayGuard` holds, else the block stays
  stored and inactive (`REPLAY_PREREQUISITE`). Spans without an `id` are legacy blocks and replay as ever.
- **Proof** (`ctx.proof`, EVIDENCE.md): a block keeps what it gave in `span.evidence` and pins it in `meta.proofs` with
  the same ops, so a skipped block, a deleted reply or another swipe leaves nothing active; `story.evidence` shows only
  pinned, validated proof whose parents are shown. `store.proofs()` lists what is stored, not what is active.
- **Records Story Block does not own are kept:** a first record that is a future version's or damaged is never written
  or repaired; the head is an empty read-only state (`store.readOnly()`) and writers throw (REPLAY.md "Preserved records").
- **Checkpoints stop at a gap:** the first `covers`/`coverHash` window that fails ends trust (a checkpoint without
  `covers` after it is not trusted, and there is no fallback to the latest one); `head()` is `null` until
  `ensureInitial` starts the chat again.
- A copied swipe record is ignored (`sid` + `swipe` + `mark`); Story Block mirrors the shown swipe's copy only
  where SillyTavern reads it back (`keepsCopy`, `mirrorCopy`, `dropCopy`).
- Rebuilding replays stored ops only, never a handler. The head cache is checked against the chat on each read.
- **Saving:** the turn's save goes 1.5 s after the last change (`IDLE_MS`), never later than 8 s
  (`IDLE_MAX_MS`); a generation starting folds it into the reply's save. In SillyTavern Story Block writes the
  chat file itself (`chat-file.js`, `/api/chats/save`); without one (testkit) it saves at once via `ctx.saveChat`.
- A save checks the open chat in the same tick; a change made in another chat goes to that chat's file
  (rescue). Refused saves retry (1, 2, 4, 8, 15 s); 20 s without an answer counts as refused and marks the
  chat suspect: rising `chat_metadata.storySuiteSave` stamps and read-backs over about five minutes.
- A rescue carries a record onto the message read back only when that message has no record of its own or the same record id. A stale pre-reopen change is dropped (newest wins) when the reopened message took a newer write.
- Page hidden or closed with unsaved changes: keepalive send at once, within `KEEPALIVE_MAX` (60 KiB of UTF-8
  bytes); bigger, `beforeunload` asks first.
- Not covered: two tabs on one chat (last writer wins).

## Sealed history

Long chats keep only the newest replies step by step (owner, 21 Nov: the last 50, sealed in steps of 25; RETENTION design C). Code:
`core/persist/sealed.js` (the sealed record), `core/store/sealed-base.js` (the base and whether a chat may use it), `core/store/write/seal.js`
and `seal-check.js` (the seal and its check), `core/turn/seal-idle.js` (when), `core/strings/history.js` (what the reader is told).

- **A sealed record** is `{ v: 3, sealed: 1, ... }`: it keeps its sid, swipe, mark, rev, source, narrated, rule marks and receipts (their display data
  and `data.v2` too; only a guarded receipt's `seed` and `replan` go), and loses `ops`, `spans` and every checkpoint field. `readRecord` returns it
  (its receipts stay on the line of history: `store.receipts()` and `untold()` start at the first sealed record), replay passes over it, and every
  store write onto it is refused (`write()` is the one choke point). Older builds read v3 as a newer version's record and keep the chat read-only.
- **The base** lives in `chat_metadata.storySuite.base` = `{ v: 1, through, count, sealedDigest, integrity, chat, state, carried, proofs, anchors: { chain,
  bare, spine }, guarded, window, step, at }`: the state after the last sealed reply, the Problems and the proof of the blocks before it, and the three
  chain hashes as they were in front of the first reply after it. `chain()` starts there (a checkpoint after it is trusted by the usual rules, with
  `history` set when the sealed replies held guarded blocks); `chainHash`, `bareHash`, `spineBefore` and the prefix memo's spine run go on from the
  anchors, so **a seal changes no hash in the window**: guarded boundaries, checkpoint prefixes and timeline witnesses stay as they were. (This differs
  from RETENTION §3.2–3.3, which re-derived the window's prefixes; only a kept checkpoint's `covers`/`coverHash` are re-derived.)
- **Which chat may use it:** the digest of the sealed replies' sids, and the file: the chat id (`chat`, SillyTavern's `getCurrentChatId()`) and
  `chat_metadata.integrity`. Same digest: used (a branch made inside the window, or a renamed file, takes its chat id and integrity at the next rebuild).
  Other digest, same chat id and same integrity: the same file lost a sealed reply; its changes stay, the reader is told once (`store.settleHistory()`
  → `'deleted'`, and a save is asked for). Any other: a branch or copy cut before the edge; read-only (`readOnly().kind === 'sealed'`), nothing is
  written. The chat id matters because before SillyTavern 1.19 a branch or checkpoint kept its parent's `integrity` (1.19 mints a new one). Sealed
  replies with no base: read-only; "sealed" is read from the first message that holds a record (a system note or an older greeting in front of it holds
  none).
- **Known limit, older builds:** an older build sees a sealed chat as a newer version's only from the chat's first non-user message; a chat whose first
  non-user message holds no record (a system note above the greeting) is not fenced there and may read on from the initial state. Rare: Story Suite
  always stamps the greeting.
- **The seal** (`store.seal()`, at most once per step, at a quiet moment after a reply or after a chat is opened: no generation, hold, pending save or read-only chat; host
  setting `sealHistory`, default on, the test host starts with it off): seal count = step × ⌊(replies − window) ÷ step⌋. The base is the store's own
  replay to the last sealed reply. The seal is staged in place and the chat read again; it is kept only when the head, Problems, replan point (it may
  move to the edge), both proof lists, receipts and untold (less what a sealed receipt drops), the window's chain hashes and boundary Problems, and each
  checkpoint left in the window read as before. A replan still waiting before the edge puts the seal off to a later quiet moment. Else every object is put back synchronously and the chat is not tried again in this session. A window
  checkpoint that does not hold the state in front of it (made before a delete) is dropped by the seal.
- **At the edge:** `at()` of a sealed reply is null (its state cards show nothing), except the last sealed one, whose state is the base; a chat cut
  back to its sealed replies (SillyTavern's delete-below) reads the base as its head and goes on from it; a delete or edit of one keeps its changes; Return in time and Re-read
  past the edge are refused before anything is done; a save point is its own file and unaffected.
- **Old NPC State files** (pre-merge data, recovery and checkpoint files in SillyTavern's user files folder): SillyTavern gives a page no way to list that
  folder, so the clean-up is `node scripts/people/old-files.mjs <user files folder>` (lists with sizes and dates, flags with "!" a file changed after
  the merge, Story Suite 0.1.0, or after `--since <date>`; `--delete` asks and deletes only on "yes"; portraits stay).
- Tests: `tests/core/seal*.test.js`, `sealed-record.test.js`, `sealed-chain.test.js`, `seal-edge.test.js`, `tests/suite/qa/seal-fuzz.test.js`,
  `tests/scripts/old-npc-files.test.js`.

## Key files and functions

- `core/persist.js`: `KEY`, `isCarrier`, `readRecord`, `writeRecord`, `restamp`, `swipeMark`, `markFits`,
  `keepsCopy` / `mirrorCopy` / `restoreCopy` / `dropCopy`, `trimReceipts`, `carryRecord`, `createSaver`,
  `IDLE_MS`, `IDLE_MAX_MS`, `RECHECK_MS`.
- `core/store.js` (`core/store-parts/create.js`): `createStore` (`head`, `at`, `append`, `replaceStory`, `rebuild`, `scheduleSave`,
  `saveSoon`, `flush`, `saveIdle`, `truncate`, `work`), re-exporting the checkpoint constants and `deepFreeze` that now live in
  `core/store/constants.js`; `core/store/digest.js`: the pure hashes (`payloadHashOf`, `hasMeta`). `store/tombs.js` (kept-as-they-are records, the id archive and index), `store/sources.js` (the carrier source map, occurrences), `store/guards.js` (asking and replaying guarded blocks), `store/walk.js` (the chain of checkpoints, `step`, `stamp`, the Re-read / reconcile walk, the copies a rebuild settles), `store/replay-blocks.js` (replay block by block, the head's key, the proof of the blocks that applied), `store/memo.js` (the head cache, the state at an earlier carrier, the memos and when they are forgotten, the timeline witness memo, the record helpers a write builds on), `store/read.js` (the reads of `api`: `head`, `at`, `problems`, `proofs`, `boundary`, the reader's repairs, `prefixWitness` and `witnessScope`), `store/write.js` (the writes of `api`: `append`, `before`, `replaceStory`, `reconcile`, `setNarrated`, `truncate`, `untold`, `rebuild`, `batch`, `renamed`, `touch`, `saveIdle`): factories `createTombs/createSources/createGuards/createWalk/createReplayBlocks/createMemo/createRead/createWrite(s, deps)` that `createStore` wires with its state holder `s`.
- `core/store/chat-file.js`: `createChatFile`, `utf8Bytes`, `KEEPALIVE_MAX` (mirrors SillyTavern 1.19's save body).
- `core/runtime.js`: `storeSaving`, `saveOnUnload`, `markUsed`, `SAVE_SEQ_KEY`, `MEMO_PREFIX`.
- `core/ops.js`: `diff`, `apply`, `checkOps`. `core/timeline/rewind.js`: rewinds and save points (ST branches).
- `core/replay.js`: `sha256`, `hashJson`, `deriveId`, `spanProblem`, `guardProblem`, `claimKeys` (guarded replay,
  docs/v2/REPLAY.md); `store.sourceAt`, `payloadHashAt`, `attachGuard`, `reconcile`.

## Tests that guard it

- `tests/v2/store.test.js`, `persist.test.js`, `saving.test.js`, `storage-once.test.js`, `store-head-cache.test.js`,
  `counters.test.js`, `replay-fit.test.js`, `long-chat.test.js`, `rewind.test.js`, `savepoints.test.js`, `ops.test.js`.
- `tests/v2/replay-guard.test.js`, `replay-source.test.js`, `replay-chain.test.js` (guarded blocks, source map,
  checkpoint gaps, Re-read replan; the test-only owner is `tests/v2/helpers/guarded.js`).
- `tests/v2/qa/state-fuzz-1..4.test.js` (shards of `helpers/state-fuzz-run.js`) (replay equals rebuild wherever checkpoints fall), `qa/delete-fuzz.test.js`,
  `qa/state-directed.test.js`.
- Break findings: `b2-timeline-*`, `b6-record-stored-once`, `b6-saves-per-reply`, `c1-*`, `c4-rename-midsave`,
  `c4-rescue-*`, `c4-save-hang`, `a1-late-save-*`, `a1-late-rescue-write`, `a1-unload-behind-hung-save`,
  `a3-keepalive-counts-chars-not-bytes`, `f1-late-save-overwrites-newer`, `final-stale-*`, `final-unload-big-chat`,
  `replay-new-key`, `r2-b3-*`.
- Benchmarks (not in `npm test` beyond `tests/v2/bench/smoke.test.js`): `scripts/bench-v2.mjs`,
  `scripts/bench-long.mjs`, see PERFORMANCE.md "How to run it".

## When you change it

- Any new op shape or bookkeeping: add it to the fuzz generator and prove replay == live after swipe,
  middle delete, rewind and reload. Old chats must still read (checkpoints are read wherever they are).
- Re-check `chat-file.js` against SillyTavern's own `saveChat` body on each SillyTavern release.
