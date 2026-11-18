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
- **Check**: `packs/validate.js` `validatePack` on the text as written, so the Studio and the game always agree. Each
  problem's path is filed under a part and a record (`studio/parts.js` `partOfPath`).
- **Views**: one page per part (`studio/parts.js` `PARTS`), read only. Records are cards showing every field as written.
  A part the pack does not have is left out of the nav.
- **Problems**: the checker's problems grouped by part, each with **Go to**, which opens the part and focuses the record.
- **Search**: records whose title, id, name, keys or aliases hold the words.
- **Export**: the zip (`pack.json` plus `portraits/<file>` for each portrait the cast names, in cast order, stored, fixed
  time stamp: `studio/zip-write.js`, the same layout as `scripts/core/build-example-zip.mjs`) or `pack.json` alone. Both
  give back the text that was opened. The text is read as UTF-8 the way the game reads it, so a leading BOM is not kept;
  a plain UTF-8 file comes back byte for byte.
- **Keys**:

  | Key | Action |
  |---|---|
  | Ctrl/Cmd+O | Open |
  | Ctrl/Cmd+S | Export the zip |
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
- **Missing pieces**: no editing, no dry run, no map or graph view yet.

## Tests

- `tests/packs/studio/`:
  - the parts table;
  - the checker wiring (the Studio's verdict equals `validatePack`'s);
  - open and export (the writer rebuilds `examples/packs/ersveil.zip` byte for byte);
  - an exported pack installed in a testkit host (`testkit/host.js`) gives the same verdict.
- `tests/ui/studio/`: the page in Chromium. It covers open, every part, Problems and Go to, search, the keys, the phone
  list and back, the theme, and no overflow at 390, 1143, 1280 and 1920, dark and light.
