# Pack Studio build: dispatcher jobs (18 Nov 2026, task STUDIOJOBS)

This is read-only planning. No code was changed and no model was called.

**Inputs:**
- `scratch/design/studio-plan.md`, including the owner's 18 Nov 08:40 note: the Studio uses the current Story Suite UI design (mock v7 / Glass v5, the settings overlay frame);
- `scratch/design/pack-format-4.md` (world and game kinds, pairing, and its §6 jobs);
- the `studio/` skeleton on `origin/main` (637f2c18e);
- `origin/pack/format4` (1b3038ae8).

**Paths:** every existing path below was checked with `git cat-file` on both refs, and every "(new)" path was checked to be absent on both.

**Job ids:** they carry an `ST-` prefix, because format 4 already has jobs called S1 and S2. The "Was" column gives the old `studio-plan.md` §6 id (S-n).

---

## 0. Facts that change the plan's §6

| Fact (checked 18 Nov) | Consequence |
|---|---|
| `pack/format4` has P1–P6, F1, M1, M2, N1–N4 and S2. It does **not** have C1, C2, T1, T2, W1, R1, R2, S1, X1, X2 or D1. | The pieces the Studio reads are all there: <ul><li>`validatePack` dispatches on `kind`, and `checkPairing` exists (P4);</li><li>`CONTENT_KEYS` (per kind), `PACK_KINDS`, `PACK_FIELDS_V4`, `MOVED_TOP_FIELDS`, `CLIMATES`, `PLACE_CLASSES` and `ROUTE_CLASSES` are exported;</li><li>`readPackZip` returns `game` (P6);</li><li>N2's seeding map exists.</li></ul> **Every Studio job that reads pack shapes can build now.** |
| `studio/` on `pack/format4` is byte-identical to main (`git diff origin/main origin/pack/format4 -- studio tests/packs/studio tests/ui/studio` is empty). | <ul><li>The Studio builds on an integration branch, **`studio/f4`**, cut from `origin/pack/format4`. It merges `pack/format4` in as that branch moves.</li><li>It reaches main in one merge **after** `pack/format4` has.</li><li>Only ST-AIR1 and ST-AIR2 go straight to main.</li></ul> |
| `modules/world/daily/step.js` (`runDays`) is on main and on format4. | <ul><li>The dry run is no longer blocked by "the engine not on main". It waits only for format 4's W1, which changes how the engine reads the selected world and edits `start-world.js` (imported by `step.js`).</li><li>ST-DRY starts now and is re-checked when W1 lands. There is no Studio file clash.</li></ul> |
| No format 4 world pack exists yet. `examples/packs/ersveil` on format4 is still `format: 3`, and C1 (the converter) is not built. | The editors are written for format 4 fields (climate, birthday, `start.date`), so **a format 3 pack opens read-only**, with a "Convert" card (§5). **C1 is therefore on the owner's loop:** it is the job that produces a format 4 Ersveil to edit. C1 needs only P4 (done), so it can start now in the format 4 lane. |
| `ui/tabs/world/map.js` exports `fitBox`, `placeGlyph` and `mapCard`; `ui/css/world.css` has `.mapbox` (from mock v7 `world.html`). | The Studio map reuses the World tab's map pieces. Only the **editing** affordances need a mock addition (MK-3). |
| N2's `apply-entry.js` imports `getActiveCalendarConfig` from `modules/people/legacy/calendar.js`, which holds a module-level active config. | ST-SEED first checks that this import graph loads in the page with no settings. If it does not, the fix is in people-lane files: a format 4 follow-up after N4, not a Studio edit. |
| `checkPairing(world, game)` takes **normalized** packs, and a failed `validatePack` returns none. | Pairing runs only when both packs pass. Otherwise the Pairing page says which pack still has problems and links to them. |
| The skeleton's hub files are `app.js` (`pageFor`), `parts.js`, `shell.js`, `load.js`, `export.js`, `check.js`, `keys.js`, `index.html`, `studio.css`, `views/records.js` and `tests/ui/studio/studio-page.test.js`. In plan §6, every editor would touch them. | Under the same-file rule, plan §6 collapses into one lane. §1 adds one seam (ST-K, then ST-WIRE) so that each later job owns only its own files. |

## 1. The seam: how the jobs run in parallel

1. **The core lane owns the hub files.** Only the `core` lane (ST-K → ST-WIRE → ST-WIDE → ST-X1FIX) edits these files:
   - `studio/{app,parts,shell,load,export,check,keys}.js`, `studio/index.html`, `studio/studio.css`;
   - `studio/views/records.js`, `studio/views/overview.js`, `studio/views/route.js` (new);
   - `tests/ui/studio/studio-page.test.js`, `tests/packs/studio/parts-check.test.js`, `tests/packs/studio/zip-export.test.js`.

   No other row lists them.

2. **ST-K creates every slot once.** `studio/views/route.js` has two tables:
   - `EDITORS`: content key → editor file;
   - `PAGES`: page id → page file, for the pages that are not one content key.

   Where each page mounts:

   | Page | File | Where it mounts |
   |---|---|---|
   | Map | `views/map.js` | A segment ("List · Map") at the top of the Places & routes part |
   | Graph | `views/graph.js` | A segment ("List · Graph") at the top of the Events part |
   | Dry run | `views/timeline.js` | A part in the Check group (world packs only) |
   | Pairing | `views/pairing.js` | A part in the Check group (when a world is open) |
   | Convert | `views/convert.js` | A card at the top of Overview for a format 3 pack |
   | Start page | `views/start.js` | Open, New world, New game |

   Each slot file starts as a **stub**: a few lines that draw today's read-only view. A later job replaces one stub's body.

   Two more pieces move or are created here:
   - **CSS slots.** `studio/css/{edit,map,graph,timeline}.css` (new) are linked from `index.html` once.
   - **Shared server.** The rendered tests' static server moves to `tests/ui/studio/serve.js` (new). Each lane adds its own rendered test file and leaves `studio-page.test.js` alone.

3. **The contract.** ST-K's stubs follow it; ST-WIRE implements `ctx`.

   ```js
   // studio/edit/<x>.js: export function editSection(section, ctx) → Node[]      (at most 4 exports per file)
   // studio/views/<x>.js: export function renderPage(ctx) → Node[]
   // section: { key, where: 'content'|'top', value, count }
   // ctx: {
   //   doc, kind: 'world'|'game', other /* the other open pack's doc or null */, refs, problems /* this key's, with path */,
   //   focus: { rec: 'cast.3', path: ['secrets',1,'gate'] } | null,
   //   commit(patches) → { ok, refusal? },         // patches: [{ op: 'set'|'insert'|'remove'|'move', path, value?, to? }]
   //   setPortrait(name, bytes | null) → { ok, refusal? },   // portraits sit beside the JSON; one history step like a patch
   //   openDoc({ text?, doc?, portraits?, kind }),  // New world / New game / Convert: opens a document as if picked
   //   go(partId, rec, path?), portrait(name) }
   ```

4. **Two packs open.**
   - The Studio holds at most one world and one game at once, each with its own history, check and draft slot (`<kind>:<id>`).
   - The header switch picks the **active** pack. `ctx.doc`, `ctx.kind` and `commit` act on the active pack, and `ctx.other` is the other one, read-only.
   - Export with a world active gives `<id>-<version>.zip`: its `pack.json`, the cast's portraits, and `game.json` when a game is open (P6). Export with a game active gives the game's `pack.json`.

5. **Pure halves and view halves are separate jobs.** The pure halves (model, references, gate parsing, seeding, pairing, dry run, convert) need no mock and **start now**. The view halves wait for their mock page.

6. **Shared files.** These are union-merged by the lead and do not count as "same files":
   - every job's rows in `docs/codemap/jobs.json` and its `CHANGELOG.md` line, as on `pack/format4`;
   - ST-AIR1's one line in `package.json` and one line in `ci.yml`, which no other Studio job touches.

7. **Rules for every job.**
   - Files are at most 450 lines including tests (aim for 300), with one job per file and at most 4 exports.
   - "NPC State" in every text a person reads.
   - Pure tests go in `tests/packs/studio/` and rendered tests in `tests/ui/studio/`; the existing globs already run both, so no `package.json` change is needed.
   - A job runs only its touched folders' tests; CI is the full gate.
   - **UI jobs:** a harness check against the job's mock page at 390/1143/1280/1920, dark and light, scoped to its own page (owner 18 Nov 16:50).

8. **Merging.** A job merges into `studio/f4` on green CI, once the lead's harness check matches the drawn mock (memory `merge-by-default`).
   - **Lane review:** runs on the merged lane at its end. Its fixes land as one fix job in the same lane.
   - **Owner's look:** gates `studio/f4` → main (§6, REV-ST-BLOCK). The lead sends the owner each mock page as it is drawn and the first build screenshot. A change the owner asks for becomes a follow-up job in that lane, so no wave waits on the owner.

9. **One validator.**
   - The Studio imports `validatePack`, `checkPairing` and the key lists from `packs/`. It never lists allowed fields.
   - `views/records.js` `SPECS` (titles and flags for display) and `studio/model/refs.js` (which fields hold ids) are display and navigation maps, not allow-lists.
   - **Coordination with format 4 D1:** its `tests/packs/one-validator.test.js` must not flag these two maps. If D1 decides it must, the ref map moves to `packs/limits-parts/world-refs.js` (new) as a format 4 P-lane follow-up, and `refs.js` imports it.

## 2. Mock additions (the lead draws them; owner rule: UI = mock v7)

All mock additions go on one new page, `scratch/design/redo/studio.html`. It uses:
- the settings overlay frame (`tpl-settings`: `.sov .shd .snav .smain .sgrp .srow .slist .sfoot`);
- the existing tokens and the ui/kit pieces (`button`, `chip`, `toggle`, `segmented`, `openSheet`, `pager`, `kvList`);
- the four widths (390/1143/1280/1920), dark and light.

Mock v7's settings rows already have `.srow` with `.txt2`, `.sel2`, `.num`, `.sw` and `.sseg2`, so plain text, number, select, toggle and segmented fields need **no** addition. That is why ST-FORM1 starts now.

**ST-K adds no new visible control.** It uses only patterns the mock already has:
- the kind goes in the header subtitle (`.shd .ttl small`: "World · Ersveil · 4.0.0");
- the Game parts get their own `.snav` group label;
- the old-format card is a settings `.note` row.

MK-6 and MK-9 draw these the same way. If the owner wants them otherwise, a core-lane follow-up changes them.

| Mock | What it adds | Gates | On the loop's path |
|---|---|---|---|
| **MK-1 Record page** | The record list for a part: rows with title, sub-line, flags and problem count; New, Duplicate, and Delete with a danger confirm.<br><br>The record form: settings rows plus a long-text row, an editable chip list (add and remove), a sub-record list (add, remove, move), an id picker sheet (search and list), a "Used by" list, a field's inline problem line, and a **JSON row** (edit one record as JSON, checked).<br><br>The header: Undo and Redo, a "Draft saved" note, the restore-draft prompt, and Export's "has errors" state.<br><br>Phone: the record opens as its own page with "‹ Lore". | ST-WIRE, ST-FORM2, every editor | **yes** |
| MK-2 Wide layout | At ≥ 1280: nav, list and record side by side | ST-WIDE | no |
| MK-3 Map editing | The World tab map in the Studio: select a place and drag it into position, draw or delete a route, region colours, realm outlines, a climate legend, and a list fallback on the phone | ST-MAPV | no |
| MK-4 Event graph | Events and conditions as nodes; edges for sets, clears, requires, after and `fired:`; a filter; tap a node to open its record | ST-GRAPH | no |
| MK-5 Dry run | A seed, tempo and days form; a timeline by day; condition holds; power and score curves; the cast's moves and deaths | ST-DRYV | no |
| MK-6 Two packs | The world/game switch in the header; the Pairing page (errors, warnings, info; "Check against the Built-in game") | ST-PAIRV | no |
| MK-7 Game tables | Table editors: calendar months, seasons, coins, a climate × season weather grid, name cultures; the rank and level-cap rows; tempo | ST-FORM4, ST-G* | no |
| MK-8 Gate builder | A hidden lore or secret gate built from anchor chips (`met:`, `fired:`, conditions, places, dates, seasons), with the gate text shown live | ST-FORM3 | no |
| MK-9 Start page | Open; New world; New game; the format 3 "Convert to format 4" card | ST-START-PAGE, ST-CONV | no |
| (format 4 S1's own mock) | The "Open Studio" row in Settings › Packs | ST-LINK | no |

**Order for the lead:** MK-1 first, because it is the only one on the critical path. Then MK-9 and MK-6, then MK-7 and MK-3, then MK-8, MK-4, MK-5 and MK-2.

## 3. Job table

**Columns:**
- **Base**: `f4` is the branch `studio/f4`; `main` is main.
- **Review**: the review group in §6.
- **After**: what must be merged first. "—" means the job can start now (on `studio/f4` once the lead has cut it).

**Lanes:** a lane is a chain of jobs run one after another. Jobs in different lanes run in parallel.

| Job | Lane | Was | Base | Files (exact) | What | Tests | After | Review |
|---|---|---|---|---|---|---|---|---|
| **ST-K** | core | S-14 (part) | f4 | **Existing:** `studio/parts.js`, `studio/app.js`, `studio/shell.js`, `studio/load.js`, `studio/export.js`, `studio/index.html`, `studio/studio.css`, `studio/views/records.js`, `studio/views/overview.js`.<br><br>**New:** `studio/views/route.js`; 26 stubs, being 20 editors `studio/edit/{overview,lore,cast,places,routes,regions,kinds,conditions,events,templates,start,powers,items,game-calendar,game-money,game-weather,game-names,game-rules,game-trackers,game-start}.js` and 6 pages `studio/views/{map,graph,timeline,pairing,convert,start}.js`; `studio/css/{edit,map,graph,timeline}.css`. | Format 4 kinds and the slots:<ul><li>Parts are built per `kind` from `CONTENT_KEYS` (no list of its own); `parts.js` keeps only order, labels and the key → part grouping.</li><li>Game parts: Calendar, Money, Weather, Names, Rules, Trackers, Start.</li><li>The two-pack state (§1.4).</li><li>Open takes a zip's `game.json`, or `pack.json` plus `game.json` picked together.</li><li>Export writes `game.json`.</li><li>A format 3 pack opens read-only with the Convert stub card.</li><li>The `route.js` tables and mounts (§1.2); `ui/css/world.css` is linked.</li></ul> | `tests/packs/studio/parts-check.test.js`, `tests/packs/studio/zip-export.test.js` (a zip with `game.json` round-trips byte for byte), `tests/packs/studio/fixtures/world4-mini.json` (new), `tests/packs/studio/fixtures/game4-mini.json` (new), `tests/ui/studio/serve.js` (new), `tests/ui/studio/studio-page.test.js` | — | CORE |
| **ST-WIRE** | core | S-1, S-10 (wiring) | f4 | `studio/app.js`, `studio/check.js`, `studio/keys.js`, `studio/shell.js`, `studio/export.js`, `studio/views/route.js`, `studio/views/records.js` | Implements `ctx`:<ul><li>`commit` → `edits.apply` → a frozen snapshot → history → a debounced check (about 300 ms; a Worker only if a measured pack takes over 50 ms) → a draft save;</li><li>`setPortrait`, `openDoc`, and `focus` down to the field.</li></ul>Export: an unedited pack is written byte for byte, and an edited one as 2-space JSON.<br><br>Undo and redo (keys and header). Go to and F8 open the editor at the field. The restore-draft prompt.<br><br>**Every record gets the JSON row** (`records.js`), so every part can be edited, roughly, before its form exists.<br><br>Export is refused while there are errors and allowed with warnings. | `tests/packs/studio/wire.test.js` (new), `tests/ui/studio/edit-loop.test.js` (new: open, edit through a JSON row, undo, F8, export) | ST-K, ST-MODEL, ST-DRAFT, MK-1 | CORE |
| ST-WIDE | core | (plan §4) | f4 | `studio/shell.js`, `studio/studio.css` | At ≥ 1280: nav, list and record side by side | `tests/ui/studio/wide.test.js` (new) | ST-WIRE, MK-2 | FORMS |
| ST-X1FIX | core | — | f4 | `tests/packs/studio/parts-check.test.js`, `tests/packs/studio/zip-export.test.js`, `tests/ui/studio/studio-page.test.js` | After format 4 X1 refuses format 3: the format 3 cases expect `FORMAT_OLD`, and the skeleton tests use the format 4 fixtures and C1's Ersveil zip | the same | format 4 X1 merged into `studio/f4` | CORE |
| **ST-MODEL** | model | S-1 | f4 | `studio/model/doc.js` (new), `studio/model/history.js` (new), `studio/model/edits.js` (new) | <ul><li>The document: the author's text until the first edit, key order kept, portraits beside it.</li><li>Frozen snapshots.</li><li>Undo and redo.</li><li>`apply(doc, patches) → doc \| refusal` for the four ops and the portrait step.</li></ul> | `tests/packs/studio/model-doc.test.js`, `model-history.test.js`, `model-edits.test.js` (new) | — | MODEL |
| ST-REFS | refs | S-1 (index) | f4 | `studio/model/refs.js` (new), `studio/model/rename.js` (new) | <ul><li>The reference index: ids of places, regions, realms, routes, cast, conditions, events, templates, powers, scores and lore, including ids inside grammar strings, read with the validator's `parseEntry`/`parseAnchor`.</li><li>"Used by".</li><li>Rename returns the patches that rewrite every reference.</li></ul> | `tests/packs/studio/model-refs.test.js`, `model-rename.test.js` (new), run on Ersveil | — | MODEL |
| ST-DRAFT | draft | S-10 | f4 | `studio/draft.js` (new) | IndexedDB drafts, one slot per `<kind>:<id>` holding `{ text, doc, portraits, at }`; a fake IndexedDB in the tests | `tests/packs/studio/draft.test.js` (new) | — | PURE |
| ST-GATE | gate | S-3 (grammar) | f4 | `studio/model/gate.js` (new) | Parse and compose a `gate` through the validator's grammar; anchor ids checked against `refs` | `tests/packs/studio/model-gate.test.js` (new) | — | PURE |
| ST-SEED | seed | S-4 (preview) | f4 | `studio/model/seed-preview.js` (new) | "What NPC State seeds" for one world cast entry, from N2's `normalizeEntry` and `applyCastEntry` (imported, not copied); first, the page-load check (§0) | `tests/packs/studio/seed-preview.test.js` (new), against a `testkit` host | — | CAST |
| ST-DRY | dry | S-9 (pure) | f4 | `studio/dryrun/run.js` (new), `studio/dryrun/worker.js` (new) | `runDays` in a Worker on the author's pack (seed, tempo, days): a port of `scratch/lorecheck/sim.mjs` without its strip step. Re-checked after W1. | `tests/packs/studio/dryrun.test.js` (new): the same seed gives the same days | — | PURE |
| ST-DRYV | dry | S-9 | f4 | `studio/views/timeline.js`, `studio/css/timeline.css` | The dry-run form and timeline | `tests/ui/studio/timeline.test.js` (new) | ST-DRY, ST-WIRE, MK-5 | GAME |
| ST-PAIR | pair | S-17 | f4 | `studio/pairing.js` (new) | Validate both open packs, then `checkPairing` (against the Built-in game when no game is open); otherwise say which pack has problems | `tests/packs/studio/pairing.test.js` (new) | — | PURE |
| ST-PAIRV | pair | S-17 | f4 | `studio/views/pairing.js` | The Pairing page, with Go to into either pack | `tests/ui/studio/pairing.test.js` (new) | ST-PAIR, ST-WIRE, MK-6 | GAME |
| ST-FORM1 | form | — | f4 | `studio/form/fields.js` (new), `studio/css/edit.css` | Text, long text, number, select, toggle and segmented rows from mock v7's settings rows; a field's inline problem | `tests/ui/studio/form-fields.test.js` (new) | ST-K (for `edit.css`) | FORMS |
| ST-FORM2 | form | — | f4 | `studio/form/list.js` (new), `studio/form/records.js` (new), `studio/form/pick.js` (new), `studio/form/gate.js` (new), `studio/css/edit.css` | The chip list; the sub-record list; the id picker sheet (`openSheet`); the gate field (checked text through ST-GATE) | `tests/ui/studio/form-lists.test.js` (new) | ST-FORM1, ST-GATE, MK-1 | FORMS |
| ST-FORM3 | form | S-3 (builder) | f4 | `studio/form/gate.js`, `studio/css/edit.css` | The gate builder replaces the text field; the editors need no change | `tests/ui/studio/form-gate.test.js` (new) | ST-FORM2, MK-8 | FORMS |
| ST-FORM4 | form | S-14 | f4 | `studio/form/table.js` (new), `studio/css/edit.css` | A table editor (rows and columns: months, coins, the weather grid) | `tests/ui/studio/form-table.test.js` (new) | ST-FORM2, MK-7 | FORMS |
| **ST-LORE** | lore | S-3 | f4 | `studio/edit/lore.js` | The lore list and form:<ul><li>keys and secondaryKeys chips, logic, constant, order;</li><li>the protected and hidden flags (hidden needs a gate);</li><li>a token count per entry, and a hidden/protected filter.</li></ul> | `tests/ui/studio/edit-lore.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-A |
| **ST-CAST** | cast | S-4 | f4 | `studio/edit/cast.js` | The cast list and core form:<ul><li>companion (all fields) or figure (light);</li><li>kind, role, aliases, look, start, birthday;</li><li>ties (a picker over cast ids).</li></ul> | `tests/ui/studio/edit-cast.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | CAST |
| ST-CAST2 | cast | S-4 | f4 | `studio/edit/cast-npc.js` (new), `studio/edit/cast-portrait.js` (new), `studio/edit/cast.js` (two imports) | <ul><li>NPC State fields: meters, stages, secrets with gates, Level, Abilities, Keepsakes.</li><li>Portrait add or replace through `setPortrait` and `packs/portrait-fit.js`, resized as at install.</li><li>The "what NPC State seeds" panel (ST-SEED).</li></ul> | `tests/ui/studio/edit-cast-npc.test.js` (new) | ST-CAST, ST-SEED | CAST |
| **ST-PLACES** | places | S-5 | f4 | `studio/edit/places.js` | Places: id, name, aliases, region (picker), kind (picker over `placeKinds`), layer, x and y, tags, note, hidden, climate (`CLIMATES`) | `tests/ui/studio/edit-places.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-A |
| ST-ROUTES | routes | S-5 | f4 | `studio/edit/routes.js` | Routes: from and to (pickers), kind, km, hours, corridor, note | `tests/ui/studio/edit-routes.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-A |
| ST-REGIONS | regions | S-5 | f4 | `studio/edit/regions.js` | Regions (with climate) and realms (a region picker); renaming an id goes through ST-REFS | `tests/ui/studio/edit-regions.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-A |
| ST-KINDS | kinds | S-5 | f4 | `studio/edit/kinds.js` | `placeKinds` and `routeKinds` (pack kind → `PLACE_CLASSES`/`ROUTE_CLASSES`); markets | `tests/ui/studio/edit-kinds.test.js` (new) | ST-WIRE, ST-FORM2 | WORLD-A |
| ST-MAPV | map | S-5 | f4 | `studio/views/map.js`, `studio/css/map.css` | The map from `ui/tabs/world/map.js` (`fitBox`, `placeGlyph`; imported, not copied): drag a place to commit its x and y; draw a route; region colours and realm outlines | `tests/ui/studio/map.test.js` (new) | ST-WIRE, MK-3 | WORLD-A |
| ST-COND | conditions | S-6 | f4 | `studio/edit/conditions.js` | The conditions form, plus "used by": the events and templates that set, clear or test each condition | `tests/ui/studio/edit-conditions.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-B |
| ST-EVENTS | events | S-6 | f4 | `studio/edit/events.js` | The `worldEvents` form, with helpers for the strict grammar (requires, after, effects, outcomes) | `tests/ui/studio/edit-events.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-B |
| ST-TEMPL | templates | S-6 | f4 | `studio/edit/templates.js` | Templates; the open-template menu (delta ranges −10..10) | `tests/ui/studio/edit-templates.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-B |
| ST-START | start | S-6 | f4 | `studio/edit/start.js` | The world `start`: `world` (set and facts), `date` (era, year, month number, day, hour, minute), `place` (a picker) | `tests/ui/studio/edit-start.test.js` (new) | ST-WIRE, ST-FORM2, ST-REFS | WORLD-B |
| ST-GRAPH | graph | S-7 | f4 | `studio/views/graph.js`, `studio/css/graph.css` | The event and condition graph, built from `refs` (it does not wait for ST-EVENTS) | `tests/ui/studio/graph.test.js` (new) | ST-WIRE, ST-REFS, MK-4 | WORLD-B |
| ST-POW | powers | S-8 | f4 | `studio/edit/powers.js` | Powers and scores; a drift preview curve | `tests/ui/studio/edit-powers.test.js` (new) | ST-WIRE, ST-FORM2 | WORLD-B |
| ST-ITEMS | items | S-8 | f4 | `studio/edit/items.js` | Items and foes | `tests/ui/studio/edit-items.test.js` (new) | ST-WIRE, ST-FORM2 | WORLD-B |
| ST-OVER | overview | S-2 | f4 | `studio/edit/overview.js` | Overview fields: id, version, name, author, description, requires, and `recommends` (world) | `tests/ui/studio/edit-overview.test.js` (new) | ST-WIRE, ST-FORM1 | GAME |
| ST-START-PAGE | overview | S-2 | f4 | `studio/views/start.js`, `studio/model/blank.js` (new) | The start page; New world and New game from blank docs, through `openDoc` | `tests/ui/studio/start-page.test.js` (new) | ST-OVER, MK-9 | GAME |
| ST-GCAL | game-calendar | S-14 | f4 | `studio/edit/game-calendar.js` | Calendar: months, era, leap years, week, seasons, holidays | `tests/ui/studio/edit-game-calendar.test.js` (new) | ST-WIRE, ST-FORM4 | GAME |
| ST-GMONEY | game-money | S-14 | f4 | `studio/edit/game-money.js` | Currency (the coins table) and the economy scale | `tests/ui/studio/edit-game-money.test.js` (new) | ST-WIRE, ST-FORM4 | GAME |
| ST-GWEATHER | game-weather | S-14 | f4 | `studio/edit/game-weather.js` | The weather style (`climate`, `tables` or `story`) and the climate × season table | `tests/ui/studio/edit-game-weather.test.js` (new) | ST-WIRE, ST-FORM4 | GAME |
| ST-GNAMES | game-names | S-14 | f4 | `studio/edit/game-names.js` | Name cultures (regions, given, family); the banned list | `tests/ui/studio/edit-game-names.test.js` (new) | ST-WIRE, ST-FORM4 | GAME |
| ST-GRULES | game-rules | S-14 | f4 | `studio/edit/game-rules.js` | `you.rank`; `rpg` (level cap, ranks, `playerRank`, `pull`); the pacing tempo | `tests/ui/studio/edit-game-rules.test.js` (new) | ST-WIRE, ST-FORM2, MK-7 | GAME |
| ST-GTRACK | game-trackers | S-14 | f4 | `studio/edit/game-trackers.js` | The `meterPresets` form; `dataModules` as a checked JSON row | `tests/ui/studio/edit-game-trackers.test.js` (new) | ST-WIRE, ST-FORM2, MK-7 | GAME |
| ST-GSTART | game-start | S-14 | f4 | `studio/edit/game-start.js` | The player's start: money, and items by name | `tests/ui/studio/edit-game-start.test.js` (new) | ST-WIRE, ST-FORM2, MK-7 | GAME |
| ST-CONV | **DROPPED (owner 18 Nov: only the owner uses packs; no format 3 conversion in the Studio)**  convert | S-18 | f4 | `studio/convert.js` (new), `studio/views/convert.js` | "Convert to format 4" calls **C1's pure converter**, then `openDoc` on the world and the game it gives. **For C1 (not yet built):** keep the conversion in a browser-safe module (e.g. `packs/convert-3to4.js`, new), with `scripts/packs/convert-3to4.mjs` (new) as a thin command line. | `tests/packs/studio/convert.test.js` (new): the converted Ersveil equals C1's | format 4 C1, ST-WIRE, MK-9 | CONV |
| ST-ZIP | convert | S-12 | f4 | `scripts/core/build-example-zip.mjs` | One zip writer: the script imports `studio/zip-write.js` and drops its own copy. `studio/zip-write.js` is unchanged. | `tests/scripts/example-zip.test.js` (new): the script's bytes equal the Studio's | format 4 C1 (it rebuilds the Ersveil zips with this script) | CONV |
| ST-LINK | release | S-11 | f4 | `ui/settings/packs.js` (one line), `scripts/release.mjs`, `scripts/release/studio.mjs` (new) | The "Open Studio" link; the release copies `studio/` into its output | `tests/scripts/release-studio.test.js` (new); `release:check` | format 4 S1 (the same file), owner call 2 | REL |
| ST-SINGLE | release | S-13 | f4 | `scripts/studio/build.mjs` (new), `scripts/release/studio.mjs` | A single-file `studio.html` (esbuild, inline CSS and fonts) that opens from `file:`; written by the release beside the extension | `tests/scripts/studio-build.test.js` (new) | ST-LINK, owner call 2 | REL |
| ST-RETIRE | release | S-16 | f4, plus the `Story_studio` repo | `Story_studio/README.md` (archive note), `authoring-kit/README.md` | Retire the old Story Studio and point the authoring kit at the new one | — | ST-SINGLE, ST-EVENTS, format 4 D1 (`authoring-kit/*`) | REL |
| ST-AIR1 | air | S-15 | **main** | `scripts/ai-readme/build.mjs` (new), `scripts/ai-readme/tables.mjs` (new), `docs/dev/ai-readme/{purpose,concepts,rules,modules,packs}.md` (new; headings only), `AI-README.md` (new, generated), `package.json` (the `codemap` script), `.github/workflows/ci.yml` (one line) | The generator plus `--check` in CI. The tables come from code: the SDK surface, commands, pack kinds and limits, the folder map. A test fails when a hand-written part names a missing export or file. The Studio part table is read from `studio/parts.js` **through its exported `PARTS` only**. When `studio/f4` (ST-K) reaches main, the regenerated table goes into that merge. | `tests/scripts/ai-readme.test.js` (new) | — | AIR |
| ST-AIR2 | air | S-15 | **main** | `docs/dev/ai-readme/{purpose,concepts,rules,modules,packs}.md`, `AI-README.md` (regenerated) | The hand-written parts, starting from `docs/history/packages/story-block/AI-README.md`. The pack section describes format 3; format 4's D1 rewrites it (D1 already lists "the AI-README pack section"). | `tests/scripts/ai-readme.test.js` | ST-AIR1 | AIR |

That is **48 jobs**: 4 core, 44 in the other lanes. They depend on these format 4 jobs: C1 (ST-CONV, ST-ZIP, and the owner's loop), S1 (ST-LINK), X1 (ST-X1FIX), D1 (ST-RETIRE, ST-AIR2's pack section) and W1 (the ST-DRY re-check).

## 4. Order (`|` = in parallel)

```
first:        lead cuts studio/f4 from origin/pack/format4; lead draws MK-1 (then MK-9, MK-6, MK-7, MK-3, MK-8, MK-4, MK-5, MK-2)
              format 4 lane: C1 now (it needs only P4)
wave 0 (now): ST-K | ST-MODEL | ST-REFS | ST-DRAFT | ST-GATE | ST-SEED | ST-PAIR | ST-DRY | ST-AIR1 (main)
wave 1:       ST-WIRE (ST-K, ST-MODEL, ST-DRAFT, MK-1) | ST-FORM1 (ST-K) → ST-FORM2 (MK-1, ST-GATE) | ST-AIR2
wave 2:       ST-LORE | ST-CAST | ST-PLACES | ST-ROUTES | ST-REGIONS | ST-KINDS | ST-COND | ST-EVENTS | ST-TEMPL | ST-START
              | ST-POW | ST-ITEMS | ST-OVER | ST-GRULES | ST-GTRACK | ST-GSTART | ST-PAIRV | ST-CONV (C1) | ST-ZIP (C1)
wave 3:       ST-CAST2 | ST-START-PAGE | ST-FORM3 | ST-FORM4 → ST-GCAL | ST-GMONEY | ST-GWEATHER | ST-GNAMES
              | ST-MAPV | ST-GRAPH | ST-DRYV | ST-WIDE
later:        ST-LINK (format 4 S1, owner call 2) → ST-SINGLE → ST-RETIRE ; ST-X1FIX after format 4 X1
```

Wave 2 has up to 19 jobs. Feed them in under the 70 % load rule (memory `load-check-15min`), in the order of §5.

## 5. The owner's loop soonest: open → edit lore, cast, places → check → export

**Critical path:** (ST-K | ST-MODEL | ST-DRAFT, with MK-1 drawn alongside) → ST-WIRE → ST-FORM2 → ST-LORE | ST-CAST | ST-PLACES, in parallel. **Format 4 C1 runs beside it** and must land by the end, because it gives the owner a format 4 Ersveil to edit.

1. **Wave 0.** Dispatch first: ST-K, ST-MODEL, ST-DRAFT, ST-REFS (the pickers for cast ties and place regions need it) and format 4 C1. The lead draws MK-1. The other wave 0 jobs fill the free slots.
2. **Wave 1: ST-WIRE.** After it, the loop already works roughly: open, edit any record through its JSON row, check, and export. The lead can hand this to the owner as an **early preview**.
3. **ST-FORM2** (after ST-FORM1).
4. **ST-LORE, ST-CAST and ST-PLACES.** Then ST-ROUTES and ST-REGIONS finish "places".
5. **One replica check of the loop** (memory `ui-check-in-replica-st`), then the owner gets it.

**What the owner opens:**
- **After C1:** `examples/packs/ersveil` (world 4.0.0) together with `ersveil-game`, as a zip carrying `game.json` or as two files picked together.
- **Before C1:** a format 3 pack opens **read-only**, with the Convert card. There is nothing to edit until C1 (or ST-CONV) gives a format 4 pack.
- **After X1:** the loop still works, because it runs on format 4 only. ST-X1FIX updates the tests.

**Where the owner opens it:** until ST-LINK or ST-SINGLE ship, the lead serves a `studio/f4` checkout with a static server (`python3 -m http.server` at the repo root, then `/studio/`) on a free local port, and sends the link.

**Not on the loop:** the map, the graph, the dry run, the gate builder (gates are checked text fields until then), the wide layout, pairing, convert and the game editors.

## 6. Review plan

The owner's rule is one consolidated review per lane, at the lane's end. Memory `review-tiers` adds that low-risk lanes are batched into one review, while risky ones get two concurrent reviews. So each group below is **one consolidated review** of the lanes it lists, run when its last lane ends. A group marked R runs as two concurrent reviewers inside that one review.

How the reviews run:
- The reviewers are Sonnet with the Opus advisor. Findings escalate to Opus with the Fable advisor (memory `review-models-escalation`).
- Codex is out until about 19 Nov, so the final review runs on Opus.
- Reviews read the code, run the touched folders' tests, and leave CI as the gate.

| Group | Lanes | Tier | Focus |
|---|---|---|---|
| CORE | core (ST-K, ST-WIRE, ST-X1FIX) | R | <ul><li>Unedited round trip byte for byte, with `game.json` in and out; 2-space JSON after an edit.</li><li>Two-pack state and export.</li><li>Export refused on errors.</li><li>Snapshot and undo integrity.</li><li>No field lists in `parts.js`; the slots and mounts follow §1.</li></ul> |
| MODEL | model, refs | R | <ul><li>No shared mutation.</li><li>Rename leaves no dangling id (an Ersveil sweep).</li><li>Refusals are given in words; nothing throws.</li></ul> |
| PURE | draft, gate, pair (ST-PAIR), dry (ST-DRY) | L | <ul><li>IndexedDB failure paths.</li><li>The gate uses only the validator's grammar.</li><li>Pairing runs only on passing packs.</li><li>The dry run is repeatable by seed.</li></ul> |
| CAST | seed, cast | R | <ul><li>NPC State seeding equals the testkit host's.</li><li>The portrait path is the same as at install.</li><li>"NPC State" wording.</li></ul> |
| FORMS | form, and ST-WIDE | L | <ul><li>Matches MK-1, MK-7, MK-8 and MK-2.</li><li>Focus rings, and targets of at least 44 px below 900 px.</li></ul> |
| WORLD-A | lore, places, routes, regions, kinds, map | L | <ul><li>Pickers come from `refs`.</li><li>`CLIMATES` is imported.</li><li>The map is reused, not copied.</li></ul> |
| WORLD-B | conditions, events, templates, start, graph, powers, items | R | <ul><li>The strict grammar round-trips through the validator.</li><li>"Used by" is complete.</li></ul> |
| GAME | overview, game-*, pair (ST-PAIRV), dry (ST-DRYV) | L | <ul><li>Matches MK-9, MK-7, MK-6 and MK-5.</li><li>Game sections validate.</li></ul> |
| CONV | convert | R | <ul><li>One converter and one zip writer.</li><li>The converted Ersveil equals C1's output.</li></ul> |
| REL | release | R | <ul><li>`scripts/release/outdir.mjs`'s guard holds.</li><li>`release:check` passes.</li></ul> |
| AIR (main) | air | R | <ul><li>`--check` is deterministic.</li><li>No totals that drift; no model names.</li></ul> |
| **REV-ST-BLOCK** | `studio/f4` → main, after `pack/format4` is on main | final, Opus | <ul><li>One replica check of the §5 loop on the converted Ersveil, at the owner's widths, dark and light.</li><li>The owner's look.</li><li>Then one merge.</li></ul> |

## 7. Owner calls still open (studio-plan §7; not settled by the format 4 answers)

1. **The look of the Studio-only screens** (MK-1…MK-9).
   - **Recommended:** the lead draws them and sends each page to the owner. Jobs merge into `studio/f4` when they match the mock, and the owner's look gates main (§1.8).
2. **How the Studio ships.**
   - **Recommended:** both: ST-LINK inside the extension for players, and ST-SINGLE for writers without SillyTavern.
   - Until the owner decides, the owner uses the served checkout (§5).
3. **The format 4 world/game split** is decided: the owner adopted all 15 format 4 answers on 18 Nov at 08:50.
