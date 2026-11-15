# Dry-run gate

Records chat exports against a suite checkout and compares two recording folders (old code vs new code).

    node scripts/dryrun/cli.mjs record --code <repo> --chats <folder> --out <folder> [--fresh]
    node scripts/dryrun/cli.mjs compare <dirA> <dirB>

## Scope

This gate proves load, queries, per-reply prompt capture and Re-reads, old vs new. The history-operation sequence
(swipe, middle delete, rewind, plus retire counts) is a follow-up PR (J12-2), not this one. "Identical" here is
not the full B2 gate.

## Output safety

- `--out` must be outside every git checkout and outside the `--code` repo; otherwise the run is refused.
- A non-empty `--out` is refused unless `--fresh` is given. `--fresh` deletes only the files listed in
  `dryrun-manifest.txt` (written by this tool) and refuses if anything else remains.
- Use synthetic chats in tests; never commit chat content.
