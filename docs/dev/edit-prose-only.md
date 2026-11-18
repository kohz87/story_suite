# A prose-only edit skips the reconcile (perf PB8)

A reader edits a reply's story text, and the reply's change block and stray change lines stay as they were.
Before PB8 every edit ran the full path: `rebuild`, then `reconcileNow`, which plans every guarded `replan`
step again from the first one in the chat to the head. At 201 messages, an early edit blocked for 0.9–1.0 s,
and 92–95 % of that was this reconcile (perf PB6). After PB8 such an edit still rebuilds, but skips the
reconcile. Every other change runs the full path as before: a block edit, a user message edit, a delete, a
swipe, a Re-read and a chat change.

Code: `core/turn/events.js` (`onTimelineChanged`) and `core/turn/edit-prose.js` (the detection).
Tests: `tests/core/edit-prose-only.test.js` (the skip and the full path) and `tests/core/edit-replay-fuzz.test.js`
(replay == live, and the same state as the full path).

## What the reconcile did for a prose edit

- **An edit never captures.** REPLAY.md ("Source map and ids"): an edit changes the payload hash, "that does not
  by itself take a block back: Re-read is how an edit reaches the story". `state-fuzz-run.js` asserts it for every
  edit, including a block edit.
- **`reconcileNow` plans every guarded `replan` step again** from `store.replansFrom()` to the head
  (`replay-blocks.js` `replanned` → `rerunBlock` → `planAgain`). It does this whatever the boundaries say:
  `blockIntact` does not read `prefixHash`. An early edit costs more because the edited reply's text is part of
  the chain (`chains.js`: the text of a record with guarded blocks). The checkpoints after the reply then stop
  matching their `prefix`, so the rebuild replays from the checkpoint before the edit, and that replay sets
  `replansFrom` to an early carrier. A last-reply edit replays from a checkpoint near the head, and the walk is
  short.
- **For a prose edit each step comes out as stored.** A step planned again is run with:
  - the state at its place;
  - the payload and seed its span saved;
  - the receipts before it;
  - its reply's position.

  `planAgain` passes no `chat`, so `ctx.chat` is null. The prose is not state. So, on the state the rebuild
  replayed, the step gives the same ops, guard, claims, evidence and result (`sameness`). What changes is only
  where it stands: the boundary's `prefixHash` and `payloadHash` (from the text), and the checkpoints the walk
  rewrites (`prefix`, `covers`, `coverHash`). These are bookkeeping hashes. The head state and the Problems are
  the same.

## Detection (exact; anything else runs the full path)

**Before anything changes** (`proseOnly(index)`, from the text alone):

1. `MESSAGE_EDITED` gives a message index. SillyTavern passes a number; a string is read with `Number()`. If
   there is no index, or it is not a whole number inside the chat, the full path runs.
2. The text the message had before the edit is known. A snapshot of every message's `mes` and `swipe_id`
   (references only, nothing copied) is taken when the turn is installed, and again on every `head`, `turn` and
   `committed` event. These are the events after which Story Suite or the reader may have changed a message.
   The verdict is taken by a listener that runs before every other listener of the edit (SillyTavern's
   `makeFirst`). Another extension's edit listener, such as NPC State's, may publish a head, and the snapshot
   would then already hold the new text. The edit must find:
   - the same message object in the snapshot;
   - the same `swipe_id`;
   - the same chat length.

   Otherwise the full path runs.
3. The message is a carrier holding a record. A user message edit runs the full path. A Re-read of the next
   reply reads the user text (`ctx.chat.lastUser`).
4. Capture-relevant text is unchanged, by exact string equality:
   - **The block region:** the text from the first `<Changes` or `<!-- STORY_SUITE_V2` (the same cut as
     `payloadText`) to the end, trailing space ignored. SillyTavern trims a message on save when
     `trim_spaces` is on.
   - **The stray change lines** in the prose (`capture/stray.js` `strayLines` with the turn's change heads):
     both the lines taken and the lines kept.
   - **No v1 envelope** in either text (`adoptLegacy`).
   - **No word a capture reads is added or removed** (`core/turn/edit-words.js`, names from `edit-names.js`). The words of the two
     texts are compared as a multiset; any changed word that is a real-world day or month name (read by the calendar-names
     check), a `#N`, or a word of any cast person's name or alias (packs, NPC State, the cast store, key people) sends the
     edit to the full path. This is conservative: a word that only shares a part of a name counts, and a name list that
     cannot be built means the full path. A plain prose edit adds none of these and still skips.

**After the rebuild:**

5. Every block of the edited reply applied: `store.problems()` lists nothing at that index.

   A guard is given the text's hash as it was stored and as it is now (`askGuard`'s `payload`). So a guard that
   reads it could turn a block of the edited reply off. The full path would then plan that reply's `replan`
   steps again with the new hash. No shipped guard reads `payload`; the test module's `strict` guard does.
   Requiring that every block of the edited reply applied covers that case. A block that was off before the edit,
   for any reason, also takes the full path. One case is not caught. A guard that reads `payload` could turn a
   block of the edited reply back *on* (an edit that restores the text). The state before later steps would
   change, and the full path would plan those steps again on it. The skip is exact for guards that do not read
   `payload`, which is every shipped guard.

If the snapshot is stale, the edit takes the full path whenever the block region it remembers differs from the
text now. There is one exception: a change to the block region that no event announced, which the edit then
undoes. That edit can skip, which is still safe: the reconcile never reads the block region. A Re-read is how it
reaches the story.

## What still runs

- `prepare` (the RPG code, when the chat needs it).
- **The whole `rebuild`.** After an edit it is needed:
  - `settleAll` stamps the swipe mark again (the mark hashes the reply's opening, `persist/marks-parts/mark.js`);
  - the checkpoint trust and the memos are worked out again over the new text;
  - the guards are asked again with the new text;
  - the archive and `ensureInitial` run.

  A reduced rebuild was not taken: what it would save (about 106 ms at 201 messages) is not needed to meet
  the line.
- The held fight board's resume and restore, `timeline.settle()`, the timeline's recovery, and the `head` event
  with reason `edit` (the UI and the public API see the edit as before).
- NPC State's own `MESSAGE_EDITED` listeners. They are its own, and not the core reconcile.

## What is skipped

`timeline.carryBoundaries()` and `reconcileNow()`. The carry is a no-op for a prose edit. The bare hash it
compares includes the text, so no mapping after the edited reply matches before or after. Nothing is written,
and nothing is saved by Story Suite. SillyTavern saves the edited text itself.

## What is deferred, not lost

- **Stale stamps.** Later guarded blocks keep their old `prefixHash`, and the edited reply's `replan` steps keep
  their old `payloadHash`. This is the state the edited reply's other guarded blocks were already in after an
  edit. `store.boundaryProblems()` lists them, and nothing in production reads it. The next swipe, delete or
  Re-read stamps them again. Nothing is planned again: no restamp by hash.
- **Checkpoint trust.** The checkpoints after the edited reply keep a `prefix` that no longer matches, so they
  are passed over. Later rebuilds, including a reload, replay from the checkpoint before the edit. That is the
  same cost as the edit's own rebuild. New replies write checkpoints with the prefix as it is now. The next swipe
  or delete reconciles from the early carrier: the walk this edit skipped is paid there once, and it rewrites the
  checkpoints.
- **Catch-up with outside facts.** A full reconcile plans each step again against the settings, packs and module
  versions as they are now. If one of them changed since the last reconcile, today's edit incidentally applied
  that change to the steps. With the skip it waits for the next swipe, delete or Re-read, exactly as after a
  reload (`onChatChanged` never reconciles). The same goes for blocks that wait to be numbered on (a swipe shown
  after an earlier reply was read again).

## Replay == live

After a skipped edit, the live state is the rebuild of the stored records over the chat as it now reads. That is
exactly what a reload computes: `onChatChanged` rebuilds and does not reconcile. No record is written. What
follows is the same as before PB8:

- **Swipe and swipe back, middle delete:** the full path. Its reconcile starts at the first carrier with a
  `replan` step, at or before every stale step, and plans each of them again. Planning is deterministic (same
  state, saved seed, saved payload). So it ends where the edit's reconcile followed by this one would have ended.
- **Edited Re-read, grown or shrunk:**
  - `replaceStory` replays from the state before the reply. The checkpoint trust is the same in both paths, so
    it gets the same state.
  - It stamps that reply's kept blocks again, and plans the later `replan` steps again.
  - Guarded blocks between the edited reply and the Re-read reply keep their stale stamps until the next
    reconcile. Those are bookkeeping hashes, not state.
- **Rewind** (`sdk.rewind`) and **reload / chat change:** they read the stored records as they are. The state is
  the same in both paths.

The fuzz (`tests/core/edit-replay-fuzz.test.js`) runs this on twin hosts. Each has the guarded test module, so
there are real `replan` steps (`gt.attempt`, `gt.collect`) and clock lines (`! tick`). One host is sent the edit
index, so it takes the skip. The other is sent no index, so it takes the full path, as main does. The steps are
random: prose edits, block edits, swipes, swipe back, middle and last deletes, grown and shrunk Re-reads,
rewinds, reloads and chat changes. After every step:

- the two heads are equal, and so are their Problems;
- the skip host equals a fresh host that loads its chat;
- after the next reconcile (a swipe or a delete), the stored records of the two hosts are equal too, so the
  deferred stamps land as main's would.

**Checked under the full boot** (the perf rig, 201 messages, with every module and NPC State's own edit
listeners): three prose edits were skipped (messages 6, 40 and 200), with the head and the Problems unchanged.
Then a full-path edit with no index ran on the text as it stood. It planned 0 steps differently and took 0
back. It only restamped, from carrier 2, and the head and the Problems were unchanged. A block edit of message 8
then reached the reconcile. (`scratch/perfaudit/rig-pb8/check-equiv.mjs`, with its output in
`scratch/perfaudit/pb8-logs/check-equiv.json`.)

## Measured

The perf rig's `run-edit` ran at 201 messages with the World tab open, as back-to-back pairs against main
(`a68919033`). Each figure is the blocking task.

| Edit | main | PB8 |
|---|---|---|
| Message 6 (an early edit) | 922–938 ms | **126–136 ms** |
| The last reply | 166–218 ms | **28–44 ms** |
| A user message, next (full path) | 150–168 ms | 969–1,017 ms |

- **Conditions.** These are the final tree's two pairs, at load 1.5–2.2. Two earlier pairs on the first commit,
  at load 10–26, gave 1,607–2,171 ms against 133–400 ms for message 6.
- **Profiles.** In PB8's prose-only edits, `reconcileNow`, `walkSuffix` and `replanned` do not appear.
- **The deferred walk.** The user-message edit takes the full path. After the skipped edits, it does the walk
  they skipped. Main had already done that walk during the early edits.
- **The whole sequence** (two early edits, then the user-message edit): main blocked 2.0 s and PB8 1.2–1.3 s.
