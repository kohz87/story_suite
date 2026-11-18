## Rules

These hold for every change. The notes file for coding agents at the repo root has the full wording; CI enforces most of them.

1. **At most 450 lines per file**, tests included (aim for 300).
2. **One job per file, at most four exports.** A folder's index file or a facade that only re-exports may list more.
3. **The code map stays current.** A new or moved file gets a sentence in `docs/codemap/jobs.json`, then `npm run codemap`.
   The maps and this file are generated; never edit them by hand, regenerate after merging.
4. **Replay == live.** A swipe, a swipe back, a middle delete, a rewind and a reload must reproduce the same state. A new
   command that writes state needs a test of each.
5. **Never edit a vendored copy** (anything under a `vendor/` folder).
6. **No model names** in code, commits, pull requests or docs.
7. **Reviews before merges; serialize changes to the same files.**
8. **The static prompt is pinned** by `tests/suite/static-prompt.golden.json`. Change it only on purpose, and NPC State
   wording needs the owner's approval.
9. **Story-driven.** No button performs a story action except through the interaction port. Bag management (use, equip,
   sell) is fine.
10. **Say NPC State**, not its old short name, in any text a person reads.

Commands: `npm test` runs every test group; `npm run check` runs the size check, the code map check and the syntax checks;
`npm run codemap` regenerates the maps and this file; `git diff --check` must be clean.
