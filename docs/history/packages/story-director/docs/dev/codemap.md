# Story Director Source Codemap

This map describes selected source files and the recent file splits. The project's main documentation
also maps the broader source directories.
Generated 2026-11-07.

## src/v2/
- `../../modules/rpg/fights.js`: Detects whether another module registers combat commands, requiring it to be ready when lifecycle status is available.
- `../../modules/world/hash.js`: Pure SHA-256 and canonical JSON helpers used for contract hashes and policy fingerprints.
- `../../modules/rpg/rare.js`: Decides which rare Chronicle, route and map grammar the story currently needs.
- `../../modules/rpg/slot.js`: Slot helpers that store rewrite-prone bookkeeping whole to avoid breaking later replay when a reply is deleted.

## ../../modules/arc/
- `../../modules/arc/commands.js`: Arc reader commands: accept a reviewed plan, update tracked threads, and end the current arc.
- `../../modules/arc/controller.js`: Browser-side arc planner using `callModel`, draft persistence, auto-accept and turn-triggered planning.

## ../../modules/atlas/atlas/
- `../../modules/atlas/atlas/canonical.js`: Resolves pack and atlas places to stable canonical IDs, holding ambiguous or unbound identities for binding.
- `../../modules/atlas/atlas/map.js`: Builds `ss.map` and atlas widget props: icons, places, routes, layers, current place and discovery status.
- `../../modules/atlas/atlas/parent.js`: A story place's parent from its name ("X / Y", "X (Y)", "Y in X", a known-name prefix), child offsets on a ring, region anchors and the "Town · Spot" place line.
- `../../modules/atlas/atlas/policy.js`: Region, place-binding and danger policies plus canonical/candidate queries and policy hashes.

## ../../modules/cast/cast/
- `../../modules/cast/cast/apply.js`: Applies cast sync, advance, meet, withdraw and rumor steps to the cast draft; notes why people moved.

## ../../modules/rpg/checks/
- `../../modules/rpg/checks/commands.js`: Standalone check actor settings and evidence-backed d20 rolls with modifiers and outcome logging.
- `../../modules/rpg/checks/roll.js`: Builds and caps standalone and NPC social modifiers for checks.

## ../../modules/world/chronicle/
- `../../modules/world/chronicle/digest.js`: Note and digest commands that turn fresh change receipts into daily Chronicle facts and tail lines.
- `../../modules/world/chronicle/thread-outcome.js`: Records a thread's outcome text in the Chronicle quest log for the committing reply.
- `../../modules/world/chronicle/backlog.js`: Pure Journal helpers: `classify` / `bucketDay` / `trimCats` (a day's lines by kind, by receipt type with a text fallback; a short day's compact kept list) and `backlogBlock` (the `[Earlier days]` tail: up to six relevant past-day lines, last two days always, code-counted "N days ago").

## ../../modules/cast/names/
- `../../modules/cast/names/index.js`: The names part (feature `story-director.names`: the `person` line, the `names` domain, `names.seen`/`names.told`, the rename cue, the tail's suggestions and profiles, query `names.profile`, settings) on a pure core: name keys and titles, the banned and overused lists, `checkName` (taken, same given name, near-miss, banned, overused), `pickSuggestions` (deterministic unused names from a pack's `names` lists), and the one-line profile (`parseProfile`, `profileText`, 160-character cap) with `capMinor` (80 minor people, oldest evicted).

## ../../modules/world/ripples/
- `../../modules/world/ripples/index.js`: Hidden sway per named power from quests, world events, standing and fights: validates the pack's `ripples` table, scores with caps, picks the leader, and is the part (queries `ripples.sway` / `ripples.leader`, no stored state).

## ../../modules/world/pulse/
- `../../modules/world/pulse/tables.js`: World pulse tables (Standard and Duo d20 rows), the table choice by real counts, the fixed draw order (d20, actor, line), place groups by atlas kind, flavour lines per group and weather, and the step-down past an entry that cannot happen here; plus the version-2 intensity (around / noticed / intrusive), the quiet-mode spread and the narrator brief; pure.
- `../../modules/world/pulse/flavour-more.js`: the extra fixed fallback lines per flavour kind and place group (pulse step version 2 and later only); pure data.
- `../../modules/world/pulse/effects.js`: the World pulse part (feature `story-director.pulse`): the `director.pulse` roll step, quiet-scene command, hook, optional tail line, settings and the skip check; effect builders (rumour, chance meeting, ENTER_CHECK arrival, TASK_SHIFT step shift) and agenda step progress.

## ../../ui/legacy/director/screens/
- `../../ui/legacy/director/screens/behind.js`: the Director screen's plan cards (widget `story-director.plan`: Beats, hooks with Next, Off-screen, Secrets, Problems, "+N more") and the older Reveal-locked Behind widget. The Ripples card (widget `story-director.ripples`: sway bars and top reasons) is drawn here too.
- `../../ui/legacy/director/screens/dom.js`: Shared text-only DOM helpers for Director widgets: elements, buttons, plurals and spacing.
- `../../ui/legacy/director/screens/quest-cards.js`: Read-only Quests widget drawing active, offered and finished threads as expandable cards.
- `../../ui/legacy/director/screens/status-card.js`: Inline reply card showing time, place, weather, travel, hero state and current goal from that reply's state.
- `../../ui/legacy/director/screens/style.js`: Shared `BASE_CSS` layout tokens and styles for Story Director screens, built on Story Block classes.

## ../../modules/time/
- `../../modules/time/line-gap.js`: How many replies have passed since the story last moved the clock, and the tail's reminder at three.
- `../../modules/time/records.js`: Time-part settings, calendar defaults, and read-only v1 record adapters for lapse, relevance and note rules.

## ../../modules/time/tracker/
- `../../modules/time/tracker/convert.js`: Converts director threads to and from v1 tracker records and compares/canonicalizes records for replay-safe writes.
- `../../modules/time/tracker/hash.js`: Synchronous canonical JSON/SHA-256 for public thread hashes, matching Story Block replay hashes.
- `../../modules/time/tracker/quiet.js`: Read-time set of threads that stop counting as open: a beat the Chronicle's quest log shows fired, and a dead person's own agenda (a beat that names them stays) (NPC State Delta `lifeState: deceased`, or the story's recorded death: a pinned person, or anyone on a reply with the `diedAny` rule mark).
- `../../modules/time/tracker/thread-shape.js`: Validators for thread IDs, metadata, text, hashes, source stamps and replay cursors.

## scripts/
- `scripts/check.mjs`: Syntax-checks `index.js` and every `.js` file under `src/` (`npm run check`), printing "syntax ok".

## Split files (7 Nov: files over 450 lines split into small parts; each original keeps its path and public names)
- `../../modules/atlas/planner.js` → `../../modules/atlas/planner/`: `prompt.js` prompt, summary and messages; `parse.js` answer parsing; `relative.js` relative dates; `validate.js` findings and ops; `auto.js` automatic planning; `note.js` the accepted note; `shared.js` helpers.
- `../../modules/time/tracker/tracker.js` → `../../modules/time/tracker/tracker-records.js` record shape, copy-on-write helpers and constants; `../../modules/time/tracker/tracker-apply.js` applying change lines (`applyOps`); `../../modules/time/tracker/tracker-replay.js` mention marks and replay from chat entries; `../../modules/time/tracker/tracker-queries.js` corrections, quest outcomes and record queries.
- `../../modules/world/note.js` → `../../modules/world/note-text.js` fixed note instructions, cues and Pacing text; `../../modules/world/note-format.js` word limits, field trimming and parts; `../../modules/world/note-items.js` Due now, Arriving, record and While-away lines; `../../modules/world/note-extra.js` note header, no-weekday line and distance lines.
- `../../ui/legacy/director/module.js` → `../../ui/legacy/director/module/`: `parts.js` identity and parts; `shared.js` host access and helpers; `host.js` fight detection; `settings.js` namespacing and reads; `contexts.js` ctx, view and tools; `merge.js` merge rules; `create.js` the module builder.
- `../../modules/arc/plan.js` → `../../modules/arc/plan/`: `shared.js` constants and text; `prompt.js` prompt and summary; `read.js` plan read and write; `auto.js` auto-plan rules.
- `../../modules/atlas/atlas/widget.js` (render coordinator) → `widget-dom.js` the DOM, `widget-places.js` place details, search and moves, `widget-pointer.js` pointer input, for the Map widget.
- `../../modules/world/chronicle/capture.js` → `../../modules/world/chronicle/capture/`: `text.js`, `world.js`, `faction.js`, `commands.js`: chronicle change lines and reader commands.
- `../../modules/world/chronicle/days.js` → `../../modules/world/chronicle/days/`: `shared.js` constants and text; `state.js` state, settings and receipts; `facts.js` day facts; `summary.js` summary lines and output; `validate.js` validation.
- `../../modules/world/world/events-widget.js`: The Journal's "Show all N events" button (widget `story-director.journal-events`): loads one day's whole event list on tap, folds on the next.
- `../../modules/world/world/elsewhere.js`: the World screen's Leads data (heard hooks) and the shared section fold (widget `story-director.fold`: chevron, count, open state remembered per chat on this device).

## ../../tests/director/module/
- `../../tests/director/module/merge-isolation.test.js`: the merged beforeGenerate and afterCapture hooks keep the other parts' answers when one part throws, flag `suite.isolatedApply` on; off, they reject as before.
