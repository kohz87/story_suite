# Chronicle: world events and a pack's lasting changes

The chronicle keeps the wider world's lasting situations (a war, a plague, a calamity) and the factions that shape
them. Detail: the header comments of `src/v2/chronicle/domain.js` (the shape and caps), `capture.js` (the change
lines and commands), `pick.js` (which events the next reply is reminded of) and `days.js` (the day digest).

## Rules

- A world event is `{ id, name, summary, state, since, updated, place, factions, aka, rev }`; `state` is looming,
  ongoing or resolved. `since` and `updated` are story minutes from the Director's clock, never the model's.
- The story writes events with `world` lines; the reader edits them (`chronicle.edit`, `chronicle.remove`).
- Swipe, delete, rebuild and reload give the same chronicle: everything is written by commands whose ops replay.

## A pack's lasting changes: `chronicle.lasting`

A pack event's `then` step may call `chronicle.lasting` (Story Block runs steps with `ctx.cause === 'system'` and
`ctx.caller === 'event:<id>'`; nothing else may call it: a button, a change line or another command is REFUSED):

```json
{ "command": "chronicle.lasting", "payload": { "name": "Seventh seal failed", "state": "ongoing",
  "summary": "The seal over Auvoth has failed.", "place": "Auvoth", "factions": ["Adventurer Guild", "Sealwardens"], "keep": true } }
```

- Payload: `name` (at most 80 characters) and `state` (looming, ongoing or resolved) are required; `summary` (at most
  240), `place` (80), `factions` (at most 4 names of 80) and `keep` (true or false) are optional, and what is left out
  stays as it is. Anything else is INVALID.
- It adds the world event, or updates the one with that name (any case) or a name it had (`aka`); a rename by the
  reader is kept. `since` is stamped when it is added, `updated` on every change, from the Director's clock.
  **While the clock is not set the command fails** (`NOT_YET`: "The story has no date yet; this world event waits for
  one."). The pack event is then not claimed and is tried again on the next reply, so it happens once the story has a
  date (its `since` is that time) and a delay counted from it can come due. A pack that starts without a calendar
  start therefore fires its lasting events on the first reply after the story gets a date.
- It is an ordinary world event otherwise: News on the World screen, the Chronicle screen, the Journal's world line
  on the story day of the event that wrote it, the same hidden-names rules, taken back by a swipe or delete of the
  reply that carries the event's receipt.

### The lock

The entry records the event that wrote it (`by: "event:<id>"`, only on entries a pack event wrote). A `world` line
naming it keeps whatever it adds to the summary (after the words that are there), the place and the factions, but
not a state: the change card says "Seventh seal failed stays ongoing (set by the world's timeline)". The reader's
`chronicle.edit` and another `chronicle.lasting` may change anything; the reader can clear the lock with
`chronicle.edit { id, locked: false }` (only a pack event sets it).

### Keep in mind

`keep: true` holds an open entry in every reply's tail. At most two entries are held (`MAX_KEPT`; the two most recently
updated, id breaking ties); they take their seats first in the tail's pick of three and the other seats go by the
existing score. A resolved entry is not held (its flag stays and counts again if it reopens). The reader sets or clears
it with `chronicle.edit { id, keep }`. The static prompt does not change.

### "N days after"

The condition language has no sums (`since + 86400` does not parse), so a pack event asks the chronicle:
`query('chronicle.passed', { name: 'Cracks in the seventh seal', minutes: 86400 })` is true once the clock is that many
story minutes past the event's `since`, and false when there is no such event or either time is missing (an entry
saved by an older version, or written by a `world` line before the story had a date, can have no `since`: it never
comes due).

### Older chats

`by`, `keep` and `fire` are written only by `chronicle.lasting`. An entry without them validates and behaves exactly as
before, and the queries add `locked` / `keep` to an answer only when the entry has them.

### The Journal

The day's world line for a lasting change is found by the receipt of the event that fired, not by the entry's current
revision: the entry keeps `fire: { rev, by }` (the last pack event that changed it), written with its other fields, so a
`world` line of the story or an edit of the reader after the fire does not hide the change on the day it happened.

## The day facts and quest history the note keeps

Before each reply, `chronicle.note` (`src/v2/chronicle/digest-parts/note.js`) keeps what the receipts since the last note
hold: the day facts (`dayFacts["<day>.<rev>"]`) and the quest history (`questLog["<rev>"]`). It reads from the last
note's own receipt, in chat order (`noted.through`, its receipt ID; `chronicle.noteFacts { through }`), not from a
revision: a Re-read renumbers the receipts after the edited reply but keeps a note's receipt ID and moves it after the
reply's new receipts, so the next note never reads again what an earlier note kept, nor files a reply's receipts under
a later note. An older state (no `through`), or a note whose receipt is gone, reads by revision (`noted.rev`) as before;
the digest's gap (`noted.gap`) keeps the same mark. A thread's outcome (`chronicle.threadOutcome`, inside a capture) is
kept under its reply key (`<sid>.<n>`, `src/v2/reply-keys.js`) with its revision (`rev`), and the history is put in order
by revision, never by a reply key (`days-parts/quest-log-order.js`).

Known limit: an edited reply is never noted again. Its note is a kept block (it replays as stored), so what a Re-read of
an edited reply adds is not in the day facts, the written digest or the quest history, and what it removed stays; the
World screen's lists, read from the domains, show the edit. Tests: `tests/v2/chronicle/note-cursor.test.js` (the real
host, compared with a fresh telling), `note-outcome.test.js` (an accepted goal's outcome on the real host),
`note-cursor-units.test.js`, `note-cursor-clock.test.js` (an edit that adds a scene change, and one that adds a clock change, real host),
`note-cursor-clock-moves.test.js` (an edit that adds or removes a day, a middle delete, a swipe, a rewind and the "heard" stamps, each compared with a fresh telling), `clock-step.test.js` (the stepper) and
`note-cursor-start.test.js`.

The walk starts from the scene the receipts up to and including the cursor say (`since()` in `queries-parts/receipts.js`,
shared by the note, its gap path and the Journal's "today so far"), so a scene change an edit added is followed by the
replies after it; where those receipts say nothing (data trimmed) it starts from the note's stored `minutes` and `present`.
A `gap.through` naming a reply that was deleted falls back to `gap.rev`. The cursor never re-notes, and survives trimming,
swipes, deletes and Continue. The walk follows a clock change an edit or delete makes
as Story Block replays it (`days-parts/clock-step.js`, the one stepper `walkDays` and the World screen's `heard.js` share): a **move** (a duration,
`director.advance`; receipt `data.kind` `move`, with `data.from` the clock before the command) adds `minutes - from` to the clock walked so
far; a **set** (a date, a clock face, a skip, the reader's `director.clock`, the seed; `data.kind` `set`) takes its stored `minutes`; a
`time.settle` only starts a clock that is not started and moves nothing after that. A line "(not used)" moves nothing. A receipt with no
`kind` (told before) is a set, as it was read before. **Older-chat limit:** in a chat told before this update, after an edit or delete that moved the clock, later durations can stay a day off until the next set line (a settle no longer resets the walk); F1 and F3 are right there, the mixed case is not (pinned in `tests/v2/chronicle/walk-older-chat.test.js`). A fresh chat has no kind-less receipts. The time part's settle jump (`walk.settle`) is the walked clock at the settle before it
to the walked clock now, and `since()` hands on the walked clock of the last settle in the prefix (`settleAt`), so the "While away" skip test in the
digest command reads the same clock. A joined line (`~ time <date> · ! time +2h`) writes one clock op, so its one receipt has `from` the clock
before the command and `kind` `set` if any part set it. **Clock faces and skips (step 2b):** in a reply under the `clockFace` rule a `~` clock face is stored as an anchored set (`ctx.anchored`, Story Block rule `h`, roll `same`: today's time, never below the clock) and a skip or a bare `!` clock time as roll `after` (after the clock), period one day, so an edit or delete before it moves it as a fresh telling would; a refused `~` face keeps the mark with the face it asked for (`data.to`) and the clock stays until a change moves the clock before it. The receipt's `data.kind` is `same` / `after` and the stepper (`clock-step.js`) applies the same arithmetic (`anchoredMinutes`, a copy of Story Block's `ops/anchored.js`), so the walk equals the state. A date, a held jump, an early face on the day a jump opened (`openDay`), a line read from the reply's start after a duration of the same stretch, and a joined line (`~ time <date> · ! time +2h`: one op, plain sets) stay plain sets; dates stay exact when an earlier reply is deleted. A reply told before 2b has plain sets (kind `set`) and is read as it was. **Known limits (F6 of the CHRONCLOCK plan):** a bare `! time <clock>` told before a change that moves the clock past that time of day lands a day away from a fresh telling (not taught); a face's Problem is as told (a face refused when told keeps its Problem after a change lets it land; one accepted when told gets none when a change makes it refused); `director.time.openDay` is a stored day, so after an edit or a delete that moved a skip an early `~` face right after it is refused where a fresh telling sets it, and the other way round: after an edit or a delete that adds a jump before it, or removes the line that cleared `openDay`, a later `~` face (or duration) of the same stretch does not clear a stale `openDay` as a fresh telling does, so the next early `~` face moves the clock back where a fresh telling refuses it (a duration told there has the same gap on main, and after a delete so does the face case; both pinned in `clock-anchored-probes.test.js`); and what the notes already stored, and digests already written, for replies between the edited reply and the newest one keep their day (re-filing them
is the planned notes follow-up). A kept `time.settle` also still gives one extra settle after an edit (state, harmless to the chronicle). The walk mirrors an op only where a
receipt does: a `director.advance` a module calls through `ctx.call` has no receipt (none does today), and Story Block's restore (a same-chat restore installs every domain absolutely, including `director.time.minutes`, and leaves no Story Director clock receipt; nothing calls a restore today, so it is dormant) is the same kind of clock write without a receipt. Also: a thread's outcome line after
a grown Re-read of the reply that resolved the goal takes a new revision, so a paid turn-in settled later could sort before
it in that thread's history, unlike a fresh telling (rare; nothing else reads the order).

## Tests

`tests/v2/chronicle/lasting.test.js` (the command, the lock, keep, replay, the Journal) and `lasting-host.test.js` (on the
Story Block host: a pack's two events, `chronicle.passed`, an event that waits for a date, the `chronicle-lasting`
capability, swipe, delete, rebuild and a fresh load). The delete fuzzes (`tests/v2/break/fuzz-delete*.test.js`) run a
pack of lasting events from `tests/v2/chronicle/helpers/lasting-pack.js`.
