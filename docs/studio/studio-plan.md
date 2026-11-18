# Pack Studio: plan (18 Nov 2026, task STUDIOPLAN)

Owner, 17-18 Nov: a new Studio built from scratch whose only job is writing packs. The old Story Studio (the separate
`Story_studio` repo, 0.10.2, one 5 MB html file with its own vendored copy of Story Block) retires. Alongside it comes an
`AI-README.md` that a developer's model reads as the reference for writing modules and packs against this codebase. The
Studio targets **pack format 4**. Format 4 was designed in parallel. `scratch/design/pack-format-4.md` was not there when
this plan was first written; it appeared about 08:00 on 18 Nov ("design, ready to build after 0.1.1 is merged"). §7 folds it
in. The skeleton itself is built on the format 3 that main validates today and on the world-pack spec v0.14.11.

## 0. Facts this plan rests on (checked on origin/main 08822ad2f)

| Fact | Consequence |
|---|---|
| `packs/validate.js` `validatePack(text)` is the one pack checker (install, card offer, authoring kit). It knows **format 3 only**: `CONTENT_KINDS` has no `lore, regions, realms, placeKinds, routeKinds, conditions, worldEvents, templates, powers, scores, start`. | The Studio calls `validatePack` itself, so it can never disagree with the game. Today a world pack gets `UNKNOWN_KIND` problems for those parts. The world-pack checks are commit `5525cb181` ("Pack install check accepts the world-pack kinds…"), which is on the `world/*` branches and **not on main**. The Studio's world-pack checks arrive the moment that commit reaches main, with no Studio change. |
| A failed `validatePack` returns only `{ ok:false, errors }`, with no `pack` and no `raw`. A passed one returns `pack` (normalized: namespaced ids `pack.<id>/<slug>`, defaults filled in) and `raw`. | The Studio holds **the author's own document** (parsed JSON), draws every view from that, and exports that. It never exports the normalized pack, which would rewrite the author's ids. |
| `packs/bundle.js` `readPackZip(bytes)` reads a pack zip (pack.json plus `portraits/<file>` for each portrait the cast names) and refuses anything else. `packs/zip.js` has `readZip` and `crc32`. | Open uses `readPackZip`, so a zip the Studio opens is one the game would import. |
| The only zip writer is `writeStoredZip` in `scripts/core/build-example-zip.mjs`. It is a node script that imports `node:fs`. | The Studio needs a pure browser writer (`studio/zip-write.js`, stored entries, fixed time stamp). It produces the same bytes as the script; a test checks that against `examples/packs/ersveil.zip`. Moving the script onto the shared writer is job S-12. |
| `scratch/lorecheck/sim.mjs` runs the world engine's pure daily step (`runDays` from the engine's `daily/step.js`), which is also on the `world/*` branches only. | The "dry run" is planned (S-9) but cannot be built until the engine is on main. |
| The look: mock v7 (`scratch/design/redo/suite.html`), decisions in `redo/00-decisions.md`. The mock has **no Studio screens**. The nearest surface is the Settings overlay (decision 33, `tpl-settings`), built as `ui/css/settings.css` (`.sov .shd .snav .smain .sgrp .srow .slist .sfoot`). Tokens are in `ui/theme/tokens.js` (Glass dark and light), applied with `ui/theme/apply.js`. | The Studio **is** a settings-style overlay over a whole window and reuses those classes and tokens unchanged. Its own CSS only places the frame and adds record-list styles. Studio-only screens (record lists, the map, the graph) have no mock: each needs the owner's look approval before it is locked (§4). |
| esbuild 0.28.2 and playwright 1.64.1 are already devDependencies (the release bundle and the rendered tests). | No new dependency. A standalone single-file Studio can be built later with the esbuild already used for the release bundles. |

## 1. Where it lives

- **`studio/` at the repo root**: a static web page (`studio/index.html`) whose ES modules import the repo's own
  `packs/` (validate, bundle, zip), `ui/theme/` (tokens, apply), `ui/kit/dom.js` and `ui/css/*.css`. It has no build step in
  development and no runtime dependency. It has no model, no keys and no network access.
- **How it is opened**
  1. **From the installed extension** (the main path). SillyTavern serves the extension folder as static files, so the Studio is
     `/scripts/extensions/third-party/<folder>/studio/index.html`. Settings › Packs gets one "Open Studio" link (job S-11).
  2. **From a checkout**: any static server at the repo root, e.g. `python3 -m http.server` then `/studio/`. ES modules do not
     load from `file:`, so a double-clicked file does not work; that is what (3) is for.
  3. **Standalone single file** (job S-13): a release step bundles `studio/` with esbuild into `studio.html` (inline CSS and
     fonts), which opens from `file:`, like the old Studio's dist file.
- **Shipped build.** The release bundles today come from the extension's entry points (`scripts/release/entries.mjs`), and
  nothing there imports `studio/`. The skeleton is therefore **not** in the shipped bundles. Path (1) needs the release step
  to copy `studio/` (or its bundle) into the release output; that is job S-11 and is decided with the owner's release
  rules.
- **Tests** go where the existing globs already run them, so `package.json` and CI are untouched:
  - pure modules in `tests/packs/studio/` (run by `test:modules` and `test:suite`);
  - browser checks in `tests/ui/studio/` (run by `test:ui`, Playwright, as `tests/ui/rendered/*` do).
- **The testkit** (`testkit/index.js`) is the other source of truth the Studio reuses, in its tests:
  - **Skeleton:** `tests/packs/studio/testkit-install.test.js` installs what the Studio exports in a whole host from
    `createHost()`. Ersveil installs with its cast; the world-pack fixture is refused with exactly the problems the Studio
    shows. So export and install cannot drift apart.
  - **S-4:** the Cast editor's "what NPC State seeds" preview is checked against a testkit host, which seeds the person
    records.
  - **S-9:** the dry run is checked against the engine's daily step, the way the testkit host drives it.
  - **Format 4:** the Studio never builds its own fake host. It uses the testkit helper format 4 names (D11).
- **Code map**: `studio/` is not a source root (`scripts/layout.json` `sourceRoots`). Adding it there would also change the
  release output guard (`scripts/release/outdir.mjs`). So every Studio file gets its `docs/codemap/jobs.json` sentence,
  the way `authoring-kit/` files do.
- **Rules**: ≤ 450 lines per file including tests (aim 300), one job per file, ≤ 4 exports, "NPC State" in every text a
  person reads.

## 2. The model (for the editing jobs)

- **Document**: the author's parsed `pack.json` plus the portraits (`[{ name, bytes }]`). It is never normalized and keeps the
  author's key order. Until the first edit, the export writes the **text exactly as opened**. Packs are not all 2-space JSON
  (Ersveil and tiny-world are not), so re-serializing an unedited pack would change its bytes. After an edit, the document is
  written as 2-space JSON.
- **Check**: `validatePack(text)`, run after each change (debounced about 300 ms; a Worker if a large pack takes over
  50 ms). Each problem's `path` (`content.cast[3].secrets[1].gate`) is mapped to its part, record and field (`studio/parts.js`
  `partOfPath`), which is what makes **Go to** work.
- **Snapshots and history**: every edit is a pure function `(doc, edit) → doc | refusal` that returns a new frozen document,
  with undo and redo over snapshots. The portraits travel with the snapshot.
- **Reference index**: built from the document (ids of places, regions, realms, routes, cast, conditions, events, templates,
  powers, scores, lore ids). It feeds pickers, "used by" lists, safe rename (every reference rewritten in one edit), and the
  graph view.
- **Draft**: autosaved to IndexedDB (document plus portraits). There is only one user (the owner), so there is no sync.
- **Export rule**: once the world-pack checks are on main, export refuses a pack with problems, as the old Studio's "safe
  invalid draft" did (it stays editable but cannot be exported). Until then the skeleton exports with the problem count
  shown, because main refuses every world pack.

## 3. Screens

The shell is the settings overlay frame:
- a header (title, the pack's name and version, Open, Export, theme);
- a side nav of parts with search (tablet and up), or the same parts as a phone list that opens a page with a "‹ Parts" back;
- a footer bar for problems (the `.sfoot` pattern: "3 problems · 1 warning ›" opens the Problems page).

Parts (from `studio/parts.js`, in this order):

| Part | Pack keys (format 3 + world pack v0.14.11) | Read-only (skeleton) | Editor (later jobs) |
|---|---|---|---|
| **Overview** | `id, format, version, name, author, description, requires`, counts per part | key fields, counts, check result | edit fields; "new pack" from a blank world-pack template |
| **Lore** | `content.lore` | title, keys, secondaryKeys + logic, constant/order, protected/hidden flags, gate, text | entry editor with key chips, logic picker, hidden needs a gate (gate builder from the anchor vocabulary §3), a token count per entry, a filter on hidden/protected |
| **Cast** | `content.cast` | kind, role, aliases, look, start, ties, NPC State fields (meters, stages, secrets with gates), portrait thumbnail | companion (all fields) or figure (light) form; secrets and stages lists; tie pickers from cast ids; portrait add/replace (`packs/portrait-fit.js` resizes as install does); "what NPC State seeds" preview |
| **Places & routes** | `content.places, routes, regions, realms, placeKinds, routeKinds, markets` | places grouped by region, routes with km and kind, regions and realms, kind maps | map view: SVG from x/y, routes as lines, regions coloured, realms outlined, drag to place; list on the phone; kind-map table with engine classes |
| **Conditions** | `content.conditions` | name, scope, fades, means, effects, open, placeStatus | form plus "used by" (events and templates that set, clear or test it) |
| **Events** | `content.worldEvents` (and legacy `content.events`, flagged as legacy) | id, kind, severity, where, requires/after, effects, cue | form with the strict grammar helpers; **graph view** (events and conditions as nodes, edges for sets/clears/requires/after/fired:); **timeline** from a dry run |
| **Templates** | `content.templates` | template id, where, sets/clears, open menu | form; open-template menu editor (delta ranges −10..10) |
| **Powers & scores** | `content.powers, scores` | id, name, start, holds, drift | form; a drift preview curve |
| **Items & foes** | `content.items, foes` | name, tags, tier | form (optional parts in a world pack) |
| **Other** | anything else the pack holds (`rpg, names, dataModules, meterPresets, skills`, `calendar, currency, weather, economy, ripples, start, theme`) | the JSON as written | moves to the **game pack** side in format 4 (calendar, currency, weather style, rank, start, names, trackers, rule options) |
| **Problems** | the `validatePack` result | grouped by part, code, path, message | Go to (opens the part, the record and the field); next problem with F8 |

- **Dry run** (S-9): once the world engine's daily step is on main, the Studio runs it in a Worker on the author's pack
  (seed, tempo, days). It shows what fired by day, the condition holds, the power and score curves, and the cast's moves
  and deaths. It is a port of `scratch/lorecheck/sim.mjs` without its "strip what the install check refuses" step. Same seed,
  same result, so a dry run is repeatable.
- **Import and export**: Open takes a `.json`, a `.zip` (`readPackZip`), or `pack.json` plus its images picked together
  (like `packs/import-run.js`). Export gives `<id>-<version>.zip` (pack.json plus `portraits/<file>` for each portrait the
  cast names, in cast order, stored) or `pack.json` alone. Round trip: an unedited pack exports byte for byte as opened. The
  Ersveil zip comes back identical, and so does the zip the Studio writer builds from its folder.

## 4. Look, keyboard and widths

- **Look**: Glass dark by default, Glass light as an option (header toggle; it remembers). The tokens come from
  `ui/theme/tokens.js`. Nunito comes from the repo's offline font files (`ui/dev/fonts`). The frame, nav, groups, rows,
  phone list and footer are the mock's Settings overlay classes, unchanged. Record lists reuse `.sgrp/.srow` rows. Chips use
  `.chips3` and the `.tg2` tags. Studio-only pieces (the map, the graph, the timeline, the key-chip editor) are drawn in the
  same tokens and each goes to the owner as a mock page before its job locks.
- **Widths**: the four check widths (390, 1143, 1280, 1920), dark and light.
  - **390**: the parts list, then one page with "‹ Parts" (settings' `data-page` list/section pattern, container queries).
  - **≥ 601**: side nav plus page; the frame covers the window 18 px in (decision 17's desktop cover).
  - **≥ 1280, record parts** (later): nav | list | record, so a record opens beside its list. This is an owner call because
    there is no mock for it.
- **Keyboard**:

  | Key | Action |
  |---|---|
  | Ctrl/Cmd+O | Open |
  | Ctrl/Cmd+S | Export |
  | Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo, redo (editing jobs) |
  | `/` | Focus the search |
  | Alt+1…9 | Jump to a part |
  | F8 | Next problem |
  | Esc | Back (page → list on the phone, then closes a sheet) |
  | Arrow keys | Move in lists |

  Every control is a real button or input with a visible focus ring (base.css `:focus-visible`), and every target is
  ≥ 44 px under 900 px (the settings rule).

## 5. AI-README.md (generated and CI-checked, like the code map)

- **What it is**: `AI-README.md` at the repo root, the one reference a developer's model reads to write a module or a pack
  against this codebase. The old Story Block one (`docs/history/packages/story-block/AI-README.md`) and the old Studio one are
  the starting points.
- **How it is built**: `scripts/ai-readme/build.mjs --write | --check`, run by `npm run codemap` and checked in CI next to
  `codemap --check`.
  - **Hand-written parts** live in `docs/dev/ai-readme/*.md` (purpose, concepts, the rules from CLAUDE.md, how a module plugs
    in, how a pack is written).
  - **Generated tables** are filled between `<!-- generated:<name> -->` markers, from the code:
    - the module SDK surface (the exports of `core/sdk` and `core/public-api*`);
    - the commands and change-line grammar;
    - the pack kinds and fields (`packs/limits-parts/*`: `CONTENT_KINDS`, `PACK_FIELDS`, the format number) and the limits
      (`LIMITS`, `ZIP_LIMITS`);
    - the folder map (from `docs/codemap/jobs.json`);
    - the Studio's part table (`studio/parts.js`).
- **CI**: `--check` fails if a generated block differs from what the code gives. A test fails if a hand-written part names an
  export or file that does not exist (the same resolver the code map uses). So the file cannot go stale silently.
- No model names, no totals that drift (memory: no totals in generated maps).

## 6. Build plan: dispatcher jobs

One job per row, serialized where the files overlap (memory: serialize same-area fixes). Each job adds tests in
`tests/packs/studio/` or `tests/ui/studio/`, `jobs.json` rows, `npm run codemap`, and a CHANGELOG line. Review tier
follows the review-tiers memory: **low** = one consolidated review per batch; **risky** = two reviews.

| Job | What | Files | Depends on | Review |
|---|---|---|---|---|
| **S-0 (this task)** | Skeleton: shell, open json/zip, validation panel from `packs/validate`, read-only part views, export zip/json, tests | `studio/*`, `tests/packs/studio/*`, `tests/ui/studio/*` | - | low |
| S-1 | Document model: snapshots, history, pure edits, reference index, debounced check, Go to | `studio/model/*` | S-0 | risky |
| S-2 | Overview editor and "new pack" | `studio/edit/overview.js` | S-1 | low |
| S-3 | Lore editor (keys, secondaryKeys/logic, flags, gate builder) | `studio/edit/lore*.js` | S-1, format 4 P4 | low |
| S-4 | Cast editor (companion/figure, NPC State fields incl. Level/Abilities/Keepsakes, secrets and stages, ties, birthday, portraits via `portrait-fit`; "what NPC State seeds" per format 4 §5.2) | `studio/edit/cast*.js` | S-1, format 4 P4 and N2 | risky (NPC State seeding) |
| S-5 | Places, routes, regions, realms, kind maps, climate; SVG map view | `studio/edit/map*.js`, `studio/views/map-svg.js` | S-1, format 4 P4, owner look | low |
| S-6 | Conditions, events, templates, the world `start` (set, facts, date, place) forms; "used by" | `studio/edit/world*.js` | S-1, format 4 P4 | risky |
| S-7 | Event graph view | `studio/views/graph.js` | S-6, owner look | low |
| S-8 | Powers and scores, items and foes | `studio/edit/powers.js`, `studio/edit/items.js` | S-1, format 4 P4 | low |
| S-9 | Dry run in a Worker (port of lorecheck `sim.mjs`) and its timeline | `studio/dryrun/*` | world engine on main | risky |
| S-10 | Draft autosave (IndexedDB) and keyboard map completion | `studio/draft.js`, `studio/keys.js` | S-1 | low |
| S-11 | Settings › Packs "Open Studio" link; release step copies `studio/` | one line in `ui/settings/packs.js`, `scripts/release/*` | S-0 | risky (release) |
| S-12 | One zip writer: `scripts/core/build-example-zip.mjs` imports `studio/zip-write.js` (or both move to `packs/zip-write.js`) | 2 files | S-0 | low |
| S-13 | Standalone single-file `studio.html` (esbuild, inline CSS and fonts) | `scripts/studio/build.mjs` | S-11 | low |
| S-14 | Format 4 kinds (§7): `kind` world/game, parts per kind built from P1's per-kind key lists (no own list), the game-pack views (calendar, currency and economy, weather style and climate tables, names, rank, RPG rules and pull, trackers, start, pacing) | `studio/parts.js`, `studio/views/game*.js` | format 4 P1-P3 | risky |
| S-17 | Pairing panel: open a world and a game (or Built-in) together and show `checkPairing` (start date, `date:` and season anchors, birthdays, name cultures, `recommends`) | `studio/pairing.js`, `studio/views/pairing.js` | S-14, format 4 P4 | low |
| S-18 | Convert 3 → 4 in the Studio (format 4 D1 "convert it with the Studio"), calling C1's converter as a pure module; export the world and the game (a zip may carry `game.json`, P6) | `studio/convert.js` | format 4 C1, P6 | risky |
| S-15 | AI-README generator and CI check (§5) | `scripts/ai-readme/*`, `docs/dev/ai-readme/*`, `AI-README.md`, one CI line | - (parallel) | risky (CI) |
| S-16 | Retire the old Story Studio: archive note in its README, and point `authoring-kit` at the new Studio | outside this repo + `authoring-kit/README.md` | S-6, S-13 | low |

## 7. Pack format 4 (`pack-format-4.md`, 18 Nov) and what it changes here

1. **One validator (D11).** The Studio imports `validatePack` and `checkPairing` from `packs/validate.js` and keeps no copy;
   the skeleton already does this for `validatePack`. Format 4 plans a CI test, `tests/packs/one-validator.test.js`, that
   fails if any file outside `packs/limits-parts/` defines a pack field list. **`studio/parts.js` names content kinds per
   screen today**, so S-14 must take the key lists from P1's per-kind exports in `packs/limits-parts/`. `parts.js` then keeps
   only the screens' order, labels and a kind→screen grouping keyed by those exports. Agree with P1 whether that grouping
   may stay in `studio/` or moves into `limits-parts`. This is a coordination item for J0/P1.
2. **Two kinds (D1-D3).** `format: 4` and `kind: "world" | "game"` are required, and a field of the other kind is refused
   with a pointer. The Studio shows the kind in its header and builds its parts per kind:
   - **world:** today's world parts, plus `climate` on regions and places, `start.date` and `start.place`, and
     `recommends`;
   - **game:** Calendar, Currency and economy, Weather, Names, You (rank), RPG rules (and the pull), Trackers
     (`dataModules`, `meterPresets`), Start (money, items) and Pacing.

   The skeleton's "Other" part (calendar, currency, weather, ripples…) is exactly what moves to the game pack or goes away.
3. **Pairing (§4.2).** `checkPairing(world, game)` runs in the Studio as well. A Pairing panel (S-17) opens a world with a
   game (or the Built-in game) and lists its errors and warnings beside Problems.
4. **Convert 3 → 4 (D1, C1).** The refusal text points to "the Studio or `scripts/packs/convert-3to4.mjs`". The Studio's
   Convert action (S-18) calls the same conversion. C1 should keep the conversion in a pure module (browser-safe, with the
   script as a thin command line) so there is one converter.
5. **Cast (§5).** The world cast seeds NPC State through the contract in format 4 §5.2: Level, Abilities and Keepsakes are
   built-in NPC State fields (N1), gear is gone, and `birthday` moves to the world cast. The Cast editor (S-4) waits for
   P4 and N2 and shows "what NPC State seeds" from that contract.
6. **Order.** Format 4 §6 says "Studio jobs that read pack shapes wait for P4". In the job table, S-3 to S-8 depend on P4;
   S-1, S-10, S-12 and S-15 do not. The skeleton (S-0) stays on format 3 and main. It moves to format 4 when
   `pack/format4` merges; its tests then switch fixtures (format 4 job C2 converts tiny-world and Ersveil).
7. **Zips and settings.** A zip may carry `game.json` (P6), so the Studio's open and export follow P6. "Export settings as
   a game pack" (format 4 S2) is built in the extension; the Studio opens what it writes.

**Owner calls before the jobs that need them:**
1. The look of the Studio-only screens (record list layout at ≥ 1280, map, graph, timeline).
2. Whether the release ships the Studio inside the extension (S-11), as a single file (S-13), or both.
3. The format 4 world/game split (S-14). Its design is now in `pack-format-4.md`; the owner questions at its end decide the
   details.

**Owner 18 Nov 08:40: the Studio uses the current Story Suite UI design as its basis** — the new view's look (mock v7 / Glass v5: ui/theme tokens, ui/kit components, ui/css, the same cards, rows, buttons, tabs, sheets, dark and light), not a separate style. New Studio screens are composed from those existing components; anything the mock lacks is drawn in the same language and checked at 390/1143/1280/1920, dark and light.
