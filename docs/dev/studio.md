# Pack Studio

The Pack Studio is a page for writing packs. It replaces the old Story Studio (the separate repository). Today it opens,
checks, shows, edits and exports format 4 world and game packs (and shows format 3 packs, read-only). Each part has its
form (the editor files in the slots described below), and every record can also be edited as JSON (its JSON row), with
undo and redo and an autosaved draft.

## Opening it

- From a checkout, serve the repo root with any static server, e.g. `python3 -m http.server 8080`, then open
  `http://127.0.0.1:8080/studio/`. ES modules do not load from a `file:` URL.
- From the installed extension: Settings › Packs has an **Open Studio** link (a new tab) to `studio/index.html` in the extension
  folder, `/scripts/extensions/third-party/<folder>/studio/index.html`. The release build (`node scripts/release.mjs`,
  `scripts/release/studio.mjs`) copies the page and every file it reaches (its modules, the dry-run worker, the sheets and fonts)
  into the extension's output folder at the same relative paths; the bundle itself does not hold it. A reference to a missing
  file fails the release (`release:check`). The play build (`scripts/play/dist.mjs`) carries the same copy (`studio` is one of its
  `SOURCES`), so Open Studio opens there too. There is no single-file build.

## What it does

- **Open**: a pack `.zip` (`packs/bundle.js` `readPackZip`, so the same zips are refused as on import), or a `pack.json`
  alone or picked together with its portrait images. Images the cast does not name are not used, and the Studio says which.
  A world zip's `game.json`, or a file named `game.json` picked beside the `pack.json`, opens as the game pack that goes with
  it; a `game.json` picked alone is the pack itself.
- **Two packs (format 4)**: the Studio holds at most one world pack and one game pack (`studio/parts.js` `kindOf`). Opening a
  world (or a format 3 pack) replaces the world and keeps the open game; opening a game replaces the game and keeps the
  world. One of them is **active**: the header subtitle says its kind (`World · Ersveil · 4.0.0`), and Overview, Problems,
  the foot bar and Export are its own. The nav lists the world's parts under World and the game's under Game; picking a part
  of the other pack makes it active, and Overview's "Also open" row switches too. The game parts are Calendar, Money,
  Weather, Names, Rules, Trackers and Start.
- **Header and nav** (`studio/shell.js`, `studio/nav-counts.js`): with both packs open, the header has a World / Game switch
  (`.pswitch`, its own row of two halves on a phone) naming each pack, with a pack's error count (`✕ 2`); it makes that pack
  active and shows Overview (or the shared part already open), and the search says "Search both packs…". The nav starts with
  **Home** (the start page, `Open or start a pack`, which stays reachable with packs open; Alt+1…9 still count from
  Overview). Each nav row ends in its count, or its problems in red (`✕ 2`) or warnings (`! 1`) from the owning pack's
  check; Problems shows `errors · warnings` (`0` when clean); Pairing shows `—` while either pack has errors, else its count (`0`, `✕ n`, `! n`) from `studio/pair-count.js`, which never
  checks the pair in an edit's redraw: it answers with the last result and checks once the packs stand still for 600 ms, keeping
  the answer per pack hash; Home, Overview and Dry run show nothing. A page's line says what it holds in words (`320 places ·
  352 routes`). The foot bar's problem count is red. With no pack open there is no nav column and no "‹ Parts", and the
  start page is a centred column. The nav's search stays at its top while a long nav scrolls. A part's count is its records, a calendar's months, the coins, the weather tables or the
  name cultures; kind tables and the starting world are not counted, and Rules and a game's Start show none.
- **The two panes** (mock MK-2; `studio/form/panes.js`, `studio/wide.js`): every world record editor (lore, cast, places, routes,
  regions and realms, events, templates, powers and scores, items and foes) draws its list
  and its open record on every draw, in a `.st-panes` box (`recordPanes`). The shell joins a part's boxes: the page's title,
  a List · Map switch and every section's list go into one list side (`.st-wlist`) and the open record into one record side
  (`.st-wrec`), inside `.st-wide`; the open record's row is marked `aria-current`. At 1280 px and wider the two sides sit
  next to each other under the nav (the list 340 px), each scrolling on its own, the record's back button hidden, and the
  record side says "No <noun> open" with the list's New while nothing is open; below that the page shows the list, or the
  record (with its back button) while one is open. A redraw keeps each side's scroll (the record side's while the same
  record stays open), and opening a record from its list keeps the list where it was. The Studio finds a record for Go to
  in the record side first (its row in the list carries the same `data-rec`). Scrolling to a record, its row or a field
  moves only the box that holds it (`reveal`), never the nav or the frame, and the marked field is brought into view. A change
  that lands while a pointer is down (a field committed on blur by that press) is drawn after the press, so the press's click
  reaches its row. A lore Go to opens its entry once (`state.seen`), so a later pick from the list stays open across redraws.
  The game parts stay one page each (mock MK-7): Names is a table whose › opens a culture's page, and a tracker preset opens
  as a page.
- **Short fields**: `fieldRow` takes `size: 'short'` (a 160 px box at the right of the label) or `'narrow'` (a 220 px box
  under it) for short words: Era, the currency's names, Its field, Shown as, the Seed, a culture's Id, the Rank label.
- **Format 3**: a pack below format 4 (or with no `format`) opens read-only in the world slot. Its subtitle says
  `Format 3 · <name> · <version> · Read-only`, a card at the top of Overview says why it cannot be edited, its Pack card reads
  Name, Id, Version, Author (and what it needs) in words, and its rules, calendar, money and the like show under Other as
  written. Overview says "Opened read-only: an old-format pack.", the foot bar says "Old format: not checked", and Export is
  off (Ctrl/Cmd+S too) with no note; the Problems page still lists what the checker says of it. The Studio does not
  convert it (ST-CONV was dropped).
- **Check**: `packs/validate.js` `validatePack` on the text as written, so the Studio and the game always agree. Each
  problem's path is filed under a part and a record (`studio/parts.js` `partOfPath`).
- **Views**: one page per part (`studio/parts.js` `PARTS`). Which content keys a format 4 pack may hold come
  from the game's `CONTENT_KEYS` (`packs/limits-parts/kinds.js`) for its kind; `parts.js` only orders, names and groups them,
  and anything else shows under Other. Records are cards showing every field as written. A format 4 pack's part it holds
  nothing of (a new pack) is still listed, count 0 and "Nothing yet" on Overview, and draws its editor's empty state from the
  key's empty value (`parts.js` `EMPTY`; the weather's own "not set" card); the first edit below that key writes the empty
  value in the same undo step (`app.js`), and looking at the part writes nothing. A format 3 pack's part it does not have is
  left out of the nav. New world and New game (the start page, `ctx.openDoc`) open on Overview, which says "New in the
  Studio, not exported yet." until the first export.
- **Slots** (`studio/views/route.js`): each content key is drawn by its editor file (`EDITORS`, per kind:
  `studio/edit/<name>.js`, `editSection(section, ctx)`), and each page that is not one key by its page file (`PAGES`:
  `studio/views/<id>.js`, `renderPage(ctx)`): the map and the event graph as a "List · Map" or "List · Graph" segment on
  their part, the dry run and Pairing as parts in the Check group, Convert as the card on a format 3 Overview, and the start
  page. A key with no editor (a format 3 pack's rules, calendar and the like) is drawn as read-only cards; a segment or
  card page that draws nothing is not mounted, and a Check part (Dry run, Pairing) is listed whenever its `when` holds,
  without being drawn to find out (its page must then draw something). `ctx` (built by
  `studio/app.js` for each draw) is the contract in `studio/views/route.js`: `doc` (the present pack itself, the parsed pack.json, not a
  `{ text, doc }` document), `kind`, `legacy`, `other`, `refs` (the
  reference index, `studio/model/refs.js`, built once per snapshot), `problems`, `focus` (`{ rec, path }`), `go`, `portrait`,
  `keep(id)` (a plain object per pack that outlives a redraw; an editor sets it before it commits, as the page is drawn
  again inside the commit), `say(text)` (a note in the note line above the page, for what follows a change; a draw keeps it),
  and the edits: `commit(patches)` and `setPortrait(name | null, bytes | null, { patches, drop }?)` are one undo step each
  and answer `{ ok, same?, refusal? }` (setPortrait's field patches and the dropped old picture go in its step, so picking or
  removing a portrait is one undo step), and `openDoc({ text?, doc?, portraits? })` opens a document as if it had been
  picked. A change made clears the note line; a refusal the editor does not show by its field is said there. The stylesheets
  `studio/css/{edit,records,map,graph,timeline}.css` are linked (the forms, the record lists and heads, the map, the graph and
  the dry run), and the World tab's `ui/css/world.css` is linked for the map.
- **Editing** (`studio/session.js`, one session per open pack): `commit` runs the pure edits (`studio/model/edits.js`) on
  the present document, which gives a new frozen snapshot and one step in that pack's own history; the page is drawn again
  at once, keeping its scroll and the box being typed in. About 300 ms after the last change the snapshot is checked with
  the game's checker (no Worker: Ersveil, about 300 KB, checks in 15–21 ms in Chromium, 55 ms on the first run) and saved as
  the pack's draft. An edit that changes nothing is no step, so the text stays as written. A format 3 pack, or a file that
  is not a JSON object, refuses edits in words.
- **JSON row** (`studio/views/json-row.js`): every record card (and a section that is not a list) of an editable pack ends
  in "Edit as JSON" › Show. The box holds the record as 2-space JSON and is read as you type: a mistake names its line and
  keeps Apply off. Apply sets the record as one undo step; Undo changes puts the box back. Under the box: the checker's
  first problem in the record, or "Checked: no problems in this entry." Overview's own fields have no JSON row (the
  Overview form is ST-OVER); anything under Other has one.
- **Undo and Redo**: the header's ↶ and ↷ and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, on the active pack's history (in a
  text box those keys are the box's own). Each pack keeps its own history; up to 200 steps. Text typed in a JSON row and
  not applied is dropped by undo and redo.
- **Drafts** (`studio/draft.js`, IndexedDB, one slot per `<kind>:<id>`): saved after each checked change (the header then
  says "Draft saved 21:14"); undoing back to the opened document deletes it. Opening a pack whose draft differs from the
  file shows "Restore your draft?" at the top of the page: **Restore the draft** puts it on top of the file (one undo step
  back to the file), **Use the file** deletes it. Editing before answering lets the old draft go. A draft that differs only
  in its portraits is offered too. On a phone the prompt is at the top of whichever part is opened (the parts list does not
  carry it); a redraw (a check or a draft landing, undo) leaves the phone on the list or the page it showed. The prompt gives the time
  saved but not how many changes it holds (the draft keeps no count).
- **Problems**: the checker's problems grouped by part, each with **Go to**, which opens the part and the record; for a
  problem inside a record (`content.cast[3].secrets[1].gate`) it puts the focus on that field in the record's form (the
  editor marks it `.st-at`; a gate whose builder shows hands it to "Edit as text"), or, when the form has no field for it,
  opens the record's JSON row with the caret on that field's line (or the nearest part of it the record has). F8 does the
  same for the next problem. After a change the page is drawn again and the box being typed in keeps the focus (found as
  the same box of its kind and label in the record).
- **Search**: records whose title, id, name, keys or aliases hold the words.
- **Export** is off while the pack has errors (warnings do not stop it): the header's Export buttons are off, a note
  says "Export is off until the 2 problems are fixed. Warnings don’t stop it." with **Go to the first ›**, and the foot bar
  says so; a world's zip is also off while the game pack it carries has errors. A check still waiting is run first, so an
  error made just before Ctrl/Cmd+S is caught. An unedited pack is written as it was opened, byte for byte; an edited one
  as 2-space JSON (undoing every edit gives the opened bytes again).
- **Export files**: with the world active, the zip (`pack.json`, then the open game pack as `game.json`, then
  `portraits/<file>` for each portrait the cast names, in cast order, stored, fixed time stamp: `studio/zip-write.js`, the
  same layout as `scripts/core/build-example-zip.mjs`) or the world's `pack.json` alone; with the game active, the game's
  `pack.json` (the zip button is off, and Ctrl/Cmd+S gives the `pack.json`). An unedited pack's text is read as UTF-8 the way
  the game reads it, so a leading BOM is not kept; a plain UTF-8 file comes back byte for byte.
- **Keys**:

  | Key | Action |
  |---|---|
  | Ctrl/Cmd+O | Open |
  | Ctrl/Cmd+S | Export the zip (the game's `pack.json` when the game is active); not while there are errors |
  | Ctrl/Cmd+Z | Undo (not in a text box) |
  | Ctrl/Cmd+Shift+Z, Ctrl+Y | Redo (not in a text box) |
  | `/` | Search |
  | Alt+1…9 | A part |
  | F8 | Next problem, at its field |
  | Esc | Close the open sheet (the id picker, a gate term, New world); else clear the search, or back to the parts list on a phone |

- **Look**: the Settings overlay's frame and classes (`ui/css/settings.css`) and the Glass dark and light tokens
  (`ui/theme/`). The theme switch is remembered in `localStorage` (`storySuite.studio.theme`).
- **Record lists and heads** (mock MK-1 / MK-2): the lore, cast, event, item, foe and template lists draw their rows with
  `recordRow` and their filters with `filterChips` (`studio/form/reclist.js`): settings `.slist` rows with no icon column (the title
  and its tags, a line under it, the problem count and ›), pill chips (`.chips3`) and the filled search box (`.psrch`). An open
  record's head is its back button with Duplicate and Delete at the right, then the title as the page heading; the page's own
  title and the phone's "‹ Parts" give way to it. Delete opens a red card under the head (`deleteCard`, `studio/form/confirm.js`:
  "Delete “…”?", whether anything else names it, Delete and Keep it) on lore, cast, events, items, foes, templates, cultures and
  tracker presets; places, routes, regions, realms, powers and scores get the same card through `askDelete` (same file), which
  needs no page state. Styles: `studio/css/records.css`.
- **Dry run and errors.** While the world pack has errors the Dry run form stays open with "Fix the N problems first", and both
  Run and the summary's Run again are held. "Start ›" on the form opens the world's Start, in the Conditions part. The result's tabs are
  `views/dry/` files: `days.js` (day cards that fold; the first two open), `holds.js` (a row per condition at a place, bars on a ruler,
  Show all, By condition), `curves.js` (plot cards) and `cast.js` (Deaths, Moves, Status changes, As they began). A run's rows carry
  `heldAt` ("condition@place") and `statuses` (the cast statuses that changed that day).

## Limits today

- **World-spec packs with no `format`**: these are format 3 to the checker. It knows the world-pack kinds, but such a
  pack's `content.start` is still an `UNKNOWN_KIND` problem; a format 4 world pack holds it.
- **Missing pieces**: no Convert (ST-CONV was dropped). The cast portrait editor calls `setPortrait`, and the start page's
  New world and New game call `openDoc`.

## Tests

- `tests/packs/studio/`:
  - the parts table: each format 4 kind's keys in a part of that kind with an editor slot, and every slot file present;
  - the checker wiring (the Studio's verdict equals `validatePack`'s);
  - open and export (the writer rebuilds `examples/packs/ersveil.zip` and the format 3 Ersveil zip
    `tests/fixtures/packs/ersveil-3/ersveil.zip` byte for byte; a world zip with `game.json` comes back byte for byte;
    `pack.json` and `game.json` open together), with the format 4 fixtures
    `tests/packs/studio/fixtures/world4-mini.json` and `game4-mini.json`;
  - an exported pack installed in a testkit host (`testkit/host.js`) gives the same verdict;
  - the edit loop without a page (`wire.test.js`): commit, the debounce and draft save, undo and redo, no-op edits, format 3
    refusals, restore, the export bytes before and after an edit, the export block, field paths and the undo keys.
- `tests/ui/studio/`: the page in Chromium, served by `tests/ui/studio/serve.js` (each rendered test file starts its own).
  It covers open, every part, Problems and Go to, search, the keys, the phone list and back, the theme, the two packs
  (switching, Export of each), the format 3 card, the slot mounts (a page file the test swaps in is mounted; an empty stub
  is not), and no overflow at 390, 1143, 1280 and 1920, dark and light. `edit-loop.test.js` covers the edit loop: a JSON
  row edit (a mistake, Apply), Undo and Redo, the draft offered after a reload, Export off on an error with F8 and Go to
  the first at the field, warnings, and each pack's own history and export.
