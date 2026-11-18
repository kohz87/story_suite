# Packs

Ready-made content as one JSON file of plain data. Detail: PACKS.md (format, content kinds, value guide,
calendar, start state, screens, safety rules, limits, error codes, "For module authors"), ERSVEIL.md (the
starter pack), SPEC §9 and §13, MODULES §E and §F.

## Rules

- A pack is **plain data**; nothing in it runs. Validation at install: JSON only, no unsafe keys, tags,
  attributes or URLs, size and depth limits (`packs/limits.js`). Every text goes through the safety walls
  (`unsafeText`, `checkPlain`); pack CSS through `unsafeCss` and the screen CSS scoper.
- Ids are `pack.<pack>/<slug>`; references inside a pack are checked at install.
- Code still sets the numbers: pack values are read through the rules (value guide, budgets, caps); a pack
  may raise a cap only where PACKS.md says so.
- Content reaches modules only through queries of Story Block's core module: `packs.list`,
  `packs.content({ kind, pack? })`, `packs.markets`, `packs.crafts` (the default crafts), `packs.calendar`, `packs.economy`,
  `packs.item({ name })` (and hook `item.resolve`), `packs.start` (and hook `start()`), `packs.portrait({ pack, file })` (a cast
  portrait's URL or null).
- Lorebook packs: entries tagged as a pack (`PACK_TAG`) and `market:` lines are read from the lorebook
  (`packs/lorebook.js`); a lorebook line only tags a place, it never adds goods.
- Currency, coins, calendar and ranks come from the first enabled pack that has them, under the reader's own
  settings (the reader's words always win). Turning a pack on or off may change the static part once.
- A start state (`start`) applies only to a new chat's initial state (`applyStart`).
- Modules stand alone: a module without packs works with its defaults.

## Key files and functions

- `src/v2/packs/index.js`: `createPacksPart`, `part`, `packs`, `resolveItem`, `startState`, `economy`, `refreshLore`, `marketsOf`.
- `src/v2/packs/validate.js`: `validatePack` and `normalize` (the entry; keeps its path and exports `slugify`, `unsafeCss`, `checkScreens`, `HOST_VERSION`). The checks live in `src/v2/packs/validate/`: `core.js` (shared helpers, `slugify`, `HOST_VERSION`), `items.js`, `events-economy.js`, `world.js`, `theme.js` (`unsafeCss`, `checkScreens`).
- `src/v2/packs/safety.js` (`unsafeText`, `checkPlain`, `byteLength`), `limits.js`, `version.js`.
- `src/v2/packs/content.js`: `itemDef`, `contentOf`, `calendarOf`, `economyOf`, `craftsOf`, `resolveItemIn`,
  `mergeStart`, `applyStart`.
- `src/v2/packs/cast.js` (`content.cast`), `portraits.js` (portrait files on ST user files + index in settings), `zip.js` and `bundle.js` (a pack as one zip).
- `src/v2/packs/installed.js` (where packs are kept), `panel.js` (the Packs fold), `st-adapter.js`, `lorebook.js`.
- `examples/packs/ersveil/pack.json` (Ersveil 4.0.0, a format 4 world pack, with `CONVERSION-NOTES.md` and the portraits) and
  `examples/packs/ersveil-game/pack.json` (its game pack, "Ersveil rules" 1.0.0), both written by `scripts/packs/convert-3to4.mjs --ersveil` from the
  format 3 `examples/packs/ersveil-world/pack.json`; `examples/packs/ersveil.zip` holds both (`game.json`). The old format 3 Ersveil (2.x, with its
  lorebook `ersveil-lore.json` and zip) was a frozen test fixture, `tests/fixtures/packs/ersveil-3`, kept only as the converter's input;
  `examples/packs/ersveil-factions` and `ersveil-survival` (format 4 game packs, 3.0.0: data modules only, so add-ons that are never selected, D5; their module ids `pack.<id>/<slug>` are unchanged). Only format 4 is read (anything older is `FORMAT_OLD`; PACKS.md "Pack format 3" is history); `PACK_FORMAT` (4) is in `packs/limits-parts/format.js`; a format 4 pack's fields and per-kind content keys are in `packs/limits-parts/kinds.js` and checked in `packs/validate-parts/envelope.js` (PACKS.md "Pack format 4"), the format 4 world fields (`climate`, `start.date`/`start.place`, cast `birthday`) in `packs/limits-parts/world-climate.js`, `packs/validate/world-pack-parts/start-v4.js` and `cast-birthday.js`, the format 4 game sections (calendar and seasons, weather, start, pacing, `rpg.pull`) in `packs/validate/game-parts/` with their limits in `packs/limits-parts/game-*.js`, `SUITE_VERSION` in `packs/validate/core-parts/host-version.js`.
- `tests/fixtures/packs/riverside-starter-3.json`: the small format 3 pack the pack tests share (not a shipped example; `sample` and `sampleText` in `tests/packs/helpers/fixtures.js`), frozen until X1. Its format 4 conversion, `tests/packs/fixtures/riverside-starter.json` and `riverside-starter.game.json`, is made by `scripts/packs/convert-3to4.mjs` and read only by `riverside-format4.test.js`.
- `tests/fixtures/director/ersveil-bluewatch.pack.json` (world) and `ersveil-bluewatch.game.json` (game), loaded through `installBluewatch` in `tests/fixtures/director/bluewatch.js`: the Bluewatch starter in format 4, for the director, time and atlas tests. The old unversioned fixture is kept as `tests/fixtures/packs/ersveil-bluewatch-1/pack.json`.

## Tests that guard it

- `tests/v2/packs/` (`validate`, `format3`, `harden`, `content`, `economy`, `calendar` via `holidays-world`,
  `lorebook`, `installed`, `panel`, `version`, `ersveil*`, `meter-presets`, `cast`, `portraits`, `zip`).
- `tests/v2/qa/packs-security.test.js`, `tests/v2/layout/docs-examples.test.js` (PACKS/LAYOUTS examples parse).
- `packs/terms.test.js` and `packs/holidays-world.test.js` use sibling checkouts and skip without them.

## When you change it

- A new field or kind: validator + safety + limit + PACKS.md section + a test that a hostile value is refused.
- Changing Ersveil values: change the format 3 source (`examples/packs/ersveil-world`) or the converter's Ersveil preset
  (`scripts/packs/convert-3to4-parts/ersveil.js`), run `node scripts/packs/convert-3to4.mjs --ersveil` and `node scripts/core/build-example-zip.mjs`;
  `ersveil-pack.test.js` fails while the shipped files differ from what the converter builds. Never edit `tests/fixtures/packs/ersveil-3`. The Bluewatch fixture
  pair and the Riverside pair are the converter's output for the frozen old files (`bluewatch-format4.test.js` and `riverside-format4.test.js` fail on drift); they were re-pinned once, in job C2
  (owner question 6), and their bytes are pinned again: change the converter or the old file, never the pair by hand (the one edit by hand is the Riverside world's description). Format 4 has no home for legacy events, quests, creatures, shops, recipes,
  races, talents, skills, presets, a pack theme or a scene's `present`, so the pair holds the old places, routes, items, calendar, money and start only.
