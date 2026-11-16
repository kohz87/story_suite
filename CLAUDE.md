# Story Suite: notes for coding agents

## Layout

One extension at `0.1.0`:

- `core/` (host: store, persist, replay, commands, prompt, SDK, boot, settings), `modules/<name>/` (scene, inventory, data-modules, assist, rpg, time, atlas, world, cast, arc, people), `ui/` (new view; `ui/legacy/` is the old view, removed later), `packs/`, `testkit/`.
- `scripts/` (checks, code map, `scripts/layout.json`, release build and gate) and `tests/` (`tests/core`, `tests/ui`, `tests/modules`, `tests/people`, `tests/director`, `tests/suite`, `tests/scripts`); `docs/` (`docs/dev` for developers, `docs/v2` for the module API and features, `docs/codemap*` generated).
- The three old repositories' `README`, `CHANGELOG` and `CLAUDE.md` files are history: `docs/history/packages/<name>/`. Their rules that still hold are in this file.
- Call it **NPC State** (the people module, `modules/people`), not NSD, in text a person reads.
- One version number: `node scripts/release.mjs <version>` writes it everywhere; `npm run release:check` fails if a place disagrees. A release is a version bump merged to main, never a tag.

## Non-negotiables

1. **≤ 450 lines per file** (every text file except vendored copies, `node_modules` and data/asset files such as `.json`, `.md`, images and fonts) (aim for 300), including tests; `docs/merge/legacy-oversize.txt` may only shrink (the ratchet sends the base list's paths through the layout rules first, so an entry a layout move renamed is the same entry; the import commit has no list, so the push that creates it at B1 cannot be ratcheted; every later push and pull request is compared with a base that has the list); the export limit has the same kind of shrink-only list for moved legacy files, `docs/merge/legacy-exports.txt` (one path per line; the code map check reads it; a file that is back within the limit must leave it).
2. **One job per file** with **≤ 4 exports** serving that job; a file that only re-exports — a folder's `index.js` or a facade kept for existing imports — may list more than 4. Test files and test helpers under `tests/` are exempt from the export cap (not from the other rules).
3. **Code map current:** every new or moved file gets a `docs/codemap/jobs.json` sentence and `npm run codemap` before finishing. The area maps in `docs/codemap/` (every file including tests) are generated too: any edit that adds, removes or renames a file, or changes its job, exports, imports or tests (line counts are not in the maps) needs `npm run codemap`; never hand-edit them. After merging main, regenerate the maps with `npm run codemap`; never hand-merge them.
4. **Replay == live:** swipes, middle deletes, rewinds, and reloads must reproduce identical state.
5. **Never edit vendored copies** (`**/vendor/`); there is no copy of one extension inside another any more.
6. **No model names** anywhere in code, commits, or PRs.
7. **Reviews before merges; serialize changes to the same files.**
8. **Static prompt golden:** the whole static prompt is pinned by `tests/suite/static-prompt.golden.json`; regenerate it (`WRITE_GOLDEN=1`) only for an intended, reviewed change, and NPC State wording changes need the owner's approval. The golden is a pure data fixture, exempt from the 450-line limit and not in the code map (JSON is not code); it holds each scenario's `story_suite_static*` keys, including `story_suite_static_npc_state_delta` when one-pass capture is on.
9. **Story-driven:** no buttons for story actions except through the interaction port (`core/interaction/`), whose one policy is `STORY_ACTION_POLICY` in `core/interaction/policy.js`: the reader chooses for their own character, and for every party member in fights (MODULES §F132; docs/dev/interaction.md). Bag management (use, equip, sell) is fine. `scripts/checks/core-module-refs.mjs` keeps RPG and fight words out of the core; its list `docs/merge/core-module-refs.txt` may only shrink.

## Commands

```sh
npm test              # script, core, UI, modules, people and suite tests (the test:* scripts below, run in turn)
npm run check         # size check + codemap check + syntax checks (scripts/core/check.mjs, scripts/director/check.mjs)
npm run codemap       # regenerate docs/codemap.md and the package maps in docs/codemap/
npm run verify-import # prove packages/ match the B1 import snapshot
npm run release:check # build the release bundles into a temp folder and run the release gate
node scripts/release.mjs <version>  # write one version into every place that carries it
npm run test:scripts  # tests/scripts
npm run test:core     # tests/core
npm run test:ui       # tests/ui + tests/ui-gaps
npm run test:modules  # tests/modules, packs, matrix, bench, authoring-kit, director + examples/fishing/tests (the testkit's matrix runs here)
npm run test:people   # tests/people (its own job: 4 GB heap and the synthetic host's import hook)
npm run test:suite    # the test:modules folders (without tests/director) + tests/suite + tests/people with the sibling farm (scripts/ci/farm.mjs); fails on unlisted skips
git diff --check      # CI fails on trailing whitespace
```
