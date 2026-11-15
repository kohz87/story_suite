# Story Suite

One SillyTavern extension being merged from **Story Block**, **Story Director**, and **NPC State Delta**.

## Status (Stage B1)

The three repositories now live together as packages in this workspace with their git history preserved and behaviour unchanged. The old repositories remain the SillyTavern install sources until Stage B3 ships version `0.1.0`.

## Packages

- [Story Block](packages/story-block/README.md) (`packages/story-block`) — host runtime, state store, persistence, command bus, prompt assembly, UI host
- [Story Director](packages/story-director/README.md) (`packages/story-director`) — story clock, threads, quests, atlas, chronicle, World, arc
- [NPC State Delta](packages/npc-state-delta/README.md) (`packages/npc-state-delta`) — NPC state engine, dossiers, Cast, `npc` meters

See [docs/history/README.md](docs/history/README.md) for the import details, commit maps, and byte-equality verification.

## Commands

Requires Node 24 (no npm dependencies to install).

- `npm test` — run script tests, all three package suites, and the cross-package suite tests
- `npm run check` — run size/codemap checks and syntax/validation checks across all three packages
- `npm run codemap` — regenerate [docs/codemap.md](docs/codemap.md)
- `npm run verify-import` — prove no package byte changed relative to the B1 import snapshot

## Code rules

- **File size:** every source and test file is **≤ 450 lines** (aim for 300). Existing oversize files are listed in [docs/merge/legacy-oversize.txt](docs/merge/legacy-oversize.txt), which may only shrink.
- **One job per file:** each file performs one named job with at most 4 exports serving that job (a file that only re-exports, such as a folder's `index.js` or a facade kept for existing imports, may list more).
- **Code map:** [docs/codemap.md](docs/codemap.md) is generated from `docs/codemap/jobs.json` and checked in CI.
