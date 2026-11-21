## Rules

These hold for every change. The notes file for coding agents at the repo root has the full wording; CI enforces most of them.

1. **At most 450 lines per file**, tests included (aim for 300). Data and asset files (`.json`, `.md`, images, fonts) and vendored
   copies are exempt. `docs/merge/legacy-oversize.txt` may only shrink.
2. **One job per file, at most four exports.** A folder's index file or a facade that only re-exports may list more. Test
   files and test helpers under `tests/` are exempt from the export cap, not from the other rules.
3. **The code map stays current.** A new or moved file gets a sentence in `docs/codemap/jobs.json`, then `npm run codemap`.
   The maps and this file are generated; never edit them by hand, regenerate after merging.
4. **Replay == live.** A swipe, a swipe back, a middle delete, a rewind and a reload must reproduce the same state. A new
   command that writes state needs a test of each (see "Testing a module").
5. **Never edit a vendored copy** (anything under a `vendor/` folder).
6. **No model names** in code, commits, pull requests or docs.
7. **Reviews before merges; serialize changes to the same files.**
8. **The static prompt is pinned** by `tests/suite/static-prompt.golden.json`. Change it only on purpose (`WRITE_GOLDEN=1`),
   and NPC State wording needs the owner's approval.
9. **Story-driven.** No button performs a story action except through the interaction port. Bag management (use, equip,
   sell) is fine. `scripts/checks/core-module-refs.mjs` keeps RPG and fight words out of the core.
10. **Say NPC State**, not its old short name, in any text a person reads.
11. **The changelog is for players.** One line a bullet (about 200 characters), what a player sees or can do, no file
    paths, test names or job ids; the detail goes to `docs/history/CHANGELOG-detail.md`.
12. **A pack is data.** Nothing in a pack runs; the validator refuses anything unsafe, and code sets every number.

## The gates

| Command | What it runs |
|---|---|
| `npm test` | every test group below, in turn |
| `npm run test:scripts`, `test:core`, `test:ui`, `test:modules`, `test:people`, `test:suite` | one group each (`tests/scripts`; `tests/core`; `tests/ui`; modules, packs, matrix, authoring kit and the fishing example; `tests/people`; the suite groups with the sibling farm) |
| `npm run check` | the file-size and export checks, the code map check, this file's check, the changelog and import checks, syntax checks |
| `npm run codemap` | regenerates `docs/codemap.md`, `docs/codemap/*` and this file |
| `npm run release:check` | builds the release bundles into a temporary folder and runs the release gate |
| `node scripts/release.mjs <version>` | writes one version into every place that carries it |
| `git diff --check` | CI fails on trailing whitespace |

Run the tests of the folders you touched, then `npm run check`; CI runs everything. A release is a version bump merged to
main, never a tag.
