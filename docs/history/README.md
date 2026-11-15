# Merge History (Stage B1)

`kohz87/story_suite` merges the three Story Suite repositories into one monorepo while preserving their full git history and byte-identical package contents.

## Imported repositories

| Package | Old repository | Rewritten `main` head | Commit count |
|---|---|---|---|
| `packages/story-block` | `https://github.com/kohz87/Story_block` | `e13dd888` ("Merge pull request #441") | 1,768 |
| `packages/story-director` | `https://github.com/kohz87/Story_director` | `db38ced0` ("#231 release/2.16.0") | 599 |
| `packages/npc-state-delta` | `https://github.com/kohz87/npc_state_delta` | `a589a63e` ("#361") | 1,335 |

Note: the SHAs above are the **rewritten** commit SHAs in this repository.

## How the import was performed

1. Each source repository was rewritten with `git filter-repo --to-subdirectory-filter packages/<name>` (and tag prefixes `sb-`, `sd-`, `nsd-`).
2. The rewritten `main` branches were joined into `main` using `git merge --allow-unrelated-histories`, ending at import commit `c340e6533a3eb63abfa0623870dbc8d6f9bf5927`.
3. `git blame` and `git log --follow` work across the full history of every file.
4. The legacy `v1` branches from the three repositories are preserved as `v1-sb`, `v1-sd`, and `v1-nsd`.

## Commit maps and verification

- [commit-map-sb.txt](commit-map-sb.txt), [commit-map-sd.txt](commit-map-sd.txt), and [commit-map-nsd.txt](commit-map-nsd.txt) map every original commit SHA to its rewritten commit SHA in this repository.
- [snapshot.txt](snapshot.txt) records the import commit and the git tree SHA of each package at import time.
- Run `npm run verify-import` (`bash scripts/verify-import.sh`) to re-prove that every package remains byte-identical to the imported snapshot.
