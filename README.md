# Story Suite 0.1.0

A SillyTavern extension that keeps the state of your story (items and money, the scene, the people you meet, the clock and calendar, quests, the map, fights) and puts it in front of the narrator and in front of you. It is one extension made from what used to be Story Block, Story Director and NPC State Delta. Version 0.1.0 is its first release; the old three are not kept up to date and nothing is carried over from them.

**Install:** [docs/INSTALL.md](docs/INSTALL.md). **What changed:** [CHANGELOG.md](CHANGELOG.md). **Questions:** [docs/FAQ.md](docs/FAQ.md).

## What is in it

- `core/` — host runtime, state store, persistence and replay, command bus, prompt assembly, the module SDK.
- `modules/` — the parts that register with the core: `scene`, `inventory`, `data-modules`, `assist`, `rpg` (with the fight board), `time`, `atlas`, `world`, `cast`, `arc`, `people` (NPC State: dossiers and meters).
- `ui/` — the new view and its settings; `ui/legacy/` is the old view, kept until it is removed.
- `packs/` — world packs: import, validation, portraits, installed packs.
- `testkit/`, `examples/`, `authoring-kit/`, `assets/` — test fakes, the Fishing example and example packs, the pack authoring kit, images.
- `scripts/`, `tests/` — checks, code map, release build and gate; all tests.
- `docs/` — guides (`docs/v2/`, `docs/dev/`), the generated code map ([docs/codemap.md](docs/codemap.md)), and `docs/history/` with the three old repositories' changelogs and import records.

## Commands

Node 24; no npm dependencies to install for the tests.

- `npm test` — every test folder, then the cross-module suite.
- `npm run check` — size, codemap and syntax checks.
- `npm run codemap` — regenerate [docs/codemap.md](docs/codemap.md) and the per-area maps in `docs/codemap/`.
- `npm run release:check` — builds the release bundles into a temporary folder and runs the release gate (one version everywhere, no tag, every import resolves, at most ten requests at load).
- `node scripts/release.mjs <version>` — writes a version into every place that carries it. A release is a version bump merged to main; releases are not tagged.

## Code rules

- **File size:** every source and test file is at most 450 lines (aim for 300). Older files over the limit are listed in `docs/merge/legacy-oversize.txt`, which may only shrink.
- **One job per file:** each file does one named job with at most 4 exports (a file that only re-exports may list more).
- **Code map:** [docs/codemap.md](docs/codemap.md) is generated from `docs/codemap/jobs.json` and checked in CI.
- **Replay equals live:** swipes, middle deletes, rewinds and reloads reproduce the same state.

Rules for coding agents are in [CLAUDE.md](CLAUDE.md).
