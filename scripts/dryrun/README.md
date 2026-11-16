# Dry-run gate

Records chat exports against a suite checkout and compares two recording folders (old code vs new code).

    node scripts/dryrun/cli.mjs record --code <repo> --chats <folder> --out <folder> [--fresh] [--history] [--flags name=value,...]
    node scripts/dryrun/cli.mjs compare <dirA> <dirB>
    node scripts/dryrun/cli.mjs compare --cards <dirA> <dirB>

## Flags and cards

`--flags a=true,b=false` sets settings flags (`extension_settings.storySuite.flags`) on the host before each chat loads; the record
then carries a `flags` field (absent when none are given). Each reply also records `card`: the text of its "Changed this reply" card
as the old view renders it (omitted for code with no card screen). `compare` ignores `card`; `compare --cards` lists, per chat, the
replies whose card text differs, and fails if a record has no card text.

## Scope

This gate proves load, queries, per-reply prompt capture and Re-reads, old vs new. `record --history` adds, per chat, a
sequence seeded from the chat's file name (swipe the last reply, delete a middle reply, rewind, reload) using Story Block's
fuzz generator, recording head hash, queries and a Re-read after each step.

## Output safety

- `--out` must be outside every git checkout and outside the `--code` repo; otherwise the run is refused.
- A non-empty `--out` is refused unless `--fresh` is given. `--fresh` deletes only the files listed in
  `dryrun-manifest.txt` (written by this tool) and refuses if anything else remains.
- Use synthetic chats in tests; never commit chat content.
