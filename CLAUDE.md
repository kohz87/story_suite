# Story Suite: notes for coding agents

## Layout

- Now (Stage B1): `packages/story-block`, `packages/story-director`, `packages/npc-state-delta` (unchanged); root `scripts/` and `tests/` for repo checks.
- After B3: `core/`, `ui/`, `modules/` (one extension at `0.1.0`).
- Each package keeps its own `CLAUDE.md` (`packages/story-block/CLAUDE.md`, `packages/story-director/CLAUDE.md`, `packages/npc-state-delta/CLAUDE.md`); all of its rules still apply inside that package.

## Non-negotiables

1. **≤ 450 lines per file** (every text file except vendored copies, `node_modules` and data/asset files such as `.json`, `.md`, images and fonts) (aim for 300), including tests; `docs/merge/legacy-oversize.txt` may only shrink (the import commit has no list, so the push that creates it at B1 cannot be ratcheted; every later push and pull request is compared with a base that has the list); the export limit has the same kind of shrink-only list for moved legacy files, `docs/merge/legacy-exports.txt` (one path per line; the code map check reads it; a file that is back within the limit must leave it).
2. **One job per file** with **≤ 4 exports** serving that job; a file that only re-exports — a folder's `index.js` or a facade kept for existing imports — may list more than 4. Test files and test helpers under `tests/` are exempt from the export cap (not from the other rules).
3. **Code map current:** every new or moved file outside `packages/` gets a `docs/codemap/jobs.json` sentence and `npm run codemap` before finishing. Package maps (`docs/codemap/<package>.md`, every file including tests) are generated too: any edit under `packages/` that adds, removes or renames a file, or changes its job, exports, imports or tests (line counts are not in the maps) needs `npm run codemap`; a new package source file needs a job (its opening comment, a `docs/dev/codemap.md` bullet or `docs/codemap/jobs-<package>.json`). After merging main, regenerate the maps with `npm run codemap`; never hand-merge them.
4. **Replay == live:** swipes, middle deletes, rewinds, and reloads must reproduce identical state.
5. **Never edit vendored copies** (`**/vendor/`).
6. **No model names** anywhere in code, commits, or PRs.
7. **Reviews before merges; serialize changes to the same files.**
8. **Static prompt golden:** the whole static prompt is pinned by `tests/suite/static-prompt.golden.json`; regenerate it (`WRITE_GOLDEN=1`) only for an intended, reviewed change, and NPC State Delta wording changes need the owner's approval. The golden is a pure data fixture, exempt from the 450-line limit and not in the code map (JSON is not code); it holds each scenario's `story_suite_static*` keys, including `story_suite_static_npc_state_delta` when one-pass capture is on.

## Commands

```sh
npm test              # script, core and UI tests + the test:sb, test:sd, test:nsd and test:suite aliases (they run the new test folders)
npm run check         # size check + codemap check + syntax checks (scripts/core/check.mjs, scripts/director/check.mjs)
npm run codemap       # regenerate docs/codemap.md and the package maps in docs/codemap/
npm run verify-import # prove packages/ match the B1 import snapshot
npm run test:sb       # tests/modules, packs, matrix, bench, authoring-kit + examples/fishing/tests
npm run test:sd       # tests/director
npm run test:nsd      # NPC State Delta tests only
npm run test:suite    # the test:sb folders + tests/suite + tests/people with the sibling farm (scripts/ci/farm.mjs); fails on unlisted skips
git diff --check      # CI fails on trailing whitespace
```
