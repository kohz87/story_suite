# Story Suite: notes for coding agents

## Layout

- Now (Stage B1): `packages/story-block`, `packages/story-director`, `packages/npc-state-delta` (unchanged); root `scripts/` and `tests/` for repo checks.
- After B3: `core/`, `ui/`, `modules/` (one extension at `0.1.0`).
- Each package keeps its own `CLAUDE.md` (`packages/story-block/CLAUDE.md`, `packages/story-director/CLAUDE.md`, `packages/npc-state-delta/CLAUDE.md`); all of its rules still apply inside that package.

## Non-negotiables

1. **≤ 450 lines per file** (every text file except vendored copies, `node_modules` and data/asset files such as `.json`, `.md`, images and fonts) (aim for 300), including tests; `docs/merge/legacy-oversize.txt` may only shrink (the import commit has no list, so the push that creates it at B1 cannot be ratcheted; every later push and pull request is compared with a base that has the list).
2. **One job per file** with **≤ 4 exports** serving that job; a file that only re-exports — a folder's `index.js` or a facade kept for existing imports — may list more than 4. Test files and test helpers under `tests/` are exempt from the export cap (not from the other rules).
3. **Code map current:** every new or moved file outside `packages/` gets a `docs/codemap/jobs.json` sentence and `npm run codemap` before finishing.
4. **Replay == live:** swipes, middle deletes, rewinds, and reloads must reproduce identical state.
5. **Never edit vendored copies** (`tests/vendor/`).
6. **No model names** anywhere in code, commits, or PRs.
7. **Reviews before merges; serialize changes to the same files.**

## Commands

```sh
npm test              # script tests + all three package suites + cross-package suite tests
npm run check         # size check + codemap check + package syntax/validate checks
npm run codemap       # regenerate docs/codemap.md
npm run verify-import # prove packages/ match the B1 import snapshot
npm run test:sb       # Story Block tests only
npm run test:sd       # Story Director tests only
npm run test:nsd      # NPC State Delta tests only
npm run test:suite    # cross-package suite tests (fail on any skip)
git diff --check      # CI fails on trailing whitespace
```
