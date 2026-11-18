# Pack Studio (skeleton)

The Pack Studio is a page for writing packs. It replaces the old Story Studio (the separate repository). This first
skeleton (job S-0 of the Studio plan) only opens, checks, shows and exports a pack; editing comes in later jobs.

## Opening it

- From a checkout, serve the repo root with any static server, e.g. `python3 -m http.server 8080`, then open
  `http://127.0.0.1:8080/studio/`. ES modules do not load from a `file:` URL.
- From an installed copy of the extension, the same page is at `/scripts/extensions/third-party/<folder>/studio/index.html`
  when the folder holds the source. The release bundles do not include it.

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
- **Format 3**: a pack below format 4 (or with no `format`) opens read-only in the world slot. Its subtitle says
  `Format 3`, a card at the top of Overview says why it cannot be edited, and its rules, calendar, money and the like show
  under Other as written. Converting it to format 4 is a later job (ST-CONV).
- **Check**: `packs/validate.js` `validatePack` on the text as written, so the Studio and the game always agree. Each
  problem's path is filed under a part and a record (`studio/parts.js` `partOfPath`).
- **Views**: one page per part (`studio/parts.js` `PARTS`), read only. Which content keys a format 4 pack may hold come
  from the game's `CONTENT_KEYS` (`packs/limits-parts/kinds.js`) for its kind; `parts.js` only orders, names and groups them,
  and anything else shows under Other. Records are cards showing every field as written. A part the pack does not have is
  left out of the nav.
- **Slots** (`studio/views/route.js`): each content key is drawn by its editor file (`EDITORS`, per kind:
  `studio/edit/<name>.js`, `editSection(section, ctx)`), and each page that is not one key by its page file (`PAGES`:
  `studio/views/<id>.js`, `renderPage(ctx)`): the map and the event graph as a "List · Map" or "List · Graph" segment on
  their part, the dry run and Pairing as parts in the Check group, Convert as the card on a format 3 Overview, and the start
  page. Today every editor is a stub drawing the read-only cards, and the map, graph, dry-run and Pairing stubs draw nothing,
  so their mounts stay hidden. The later Studio jobs each replace one of these files. `ctx` is the read half of the editing
  contract (`doc`, `kind`, `legacy`, `other`, `problems`, `focus`, `go`, `portrait`); `commit`, `setPortrait` and `openDoc`
  refuse until the edit loop (ST-WIRE). The four stylesheet slots `studio/css/{edit,map,graph,timeline}.css` are linked and
  empty, and the World tab's `ui/css/world.css` is linked for the map.
- **Problems**: the checker's problems grouped by part, each with **Go to**, which opens the part and focuses the record.
- **Search**: records whose title, id, name, keys or aliases hold the words.
- **Export**: with the world active, the zip (`pack.json`, then the open game pack as `game.json`, then
  `portraits/<file>` for each portrait the cast names, in cast order, stored, fixed time stamp: `studio/zip-write.js`, the
  same layout as `scripts/core/build-example-zip.mjs`) or the world's `pack.json` alone; with the game active, the game's
  `pack.json` (the zip button is off, and Ctrl/Cmd+S gives the `pack.json`). Each gives back the text that was opened. The text is read as UTF-8 the way the game reads it, so a leading BOM is not kept;
  a plain UTF-8 file comes back byte for byte.
- **Keys**:

  | Key | Action |
  |---|---|
  | Ctrl/Cmd+O | Open |
  | Ctrl/Cmd+S | Export the zip (the game's `pack.json` when the game is active) |
  | `/` | Search |
  | Alt+1…9 | A part |
  | F8 | Next problem |
  | Esc | Clear the search, or back to the parts list on a phone |

- **Look**: the Settings overlay's frame and classes (`ui/css/settings.css`) and the Glass dark and light tokens
  (`ui/theme/`). The theme switch is remembered in `localStorage` (`storySuite.studio.theme`).

## Limits today

- **World packs**: main's checker knows pack format 3 only. A world pack's `lore`, `regions`, `realms`, `placeKinds`,
  `routeKinds`, `conditions`, `start`, `worldEvents`, `templates`, `powers` and `scores` show as `UNKNOWN_KIND`
  problems until the world-pack checks are merged. The views show those parts anyway.
- **Missing pieces**: no editing, no dry run, no map or graph view, no Pairing page, no Convert and no New world or New
  game yet; their slots are in place.

## Tests

- `tests/packs/studio/`:
  - the parts table: each format 4 kind's keys in a part of that kind with an editor slot, and every slot file present;
  - the checker wiring (the Studio's verdict equals `validatePack`'s);
  - open and export (the writer rebuilds `examples/packs/ersveil.zip` byte for byte; a world zip with `game.json` comes back
    byte for byte; `pack.json` and `game.json` open together), with the format 4 fixtures
    `tests/packs/studio/fixtures/world4-mini.json` and `game4-mini.json`;
  - an exported pack installed in a testkit host (`testkit/host.js`) gives the same verdict.
- `tests/ui/studio/`: the page in Chromium, served by `tests/ui/studio/serve.js` (each rendered test file starts its own).
  It covers open, every part, Problems and Go to, search, the keys, the phone list and back, the theme, the two packs
  (switching, Export of each), the format 3 card, the slot mounts (a page file the test swaps in is mounted; an empty stub
  is not), and no overflow at 390, 1143, 1280 and 1920, dark and light.
