#!/usr/bin/env bash
# Proves B1 changed no package byte by comparing git tree hashes against docs/history/snapshot.txt.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
snapshot_file="$repo_root/docs/history/snapshot.txt"

if [ ! -f "$snapshot_file" ]; then
  echo "error: missing snapshot file $snapshot_file" >&2
  exit 1
fi

import_commit=""
differ=0

while IFS= read -r raw_line || [ -n "$raw_line" ]; do
  line="${raw_line%$'\r'}"
  if [ -z "$line" ] || [[ "$line" == \#* ]]; then
    continue
  fi
  if [[ "$line" == import-commit\ * ]]; then
    import_commit="${line#import-commit }"
    continue
  fi

  read -r folder _old_repo expected_tree <<<"$line"
  if [ -z "$import_commit" ]; then
    echo "error: import-commit must appear before package entries in $snapshot_file" >&2
    exit 1
  fi

  pkg_root="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).packageRoots[0])" "$repo_root/scripts/layout.json")"
  import_tree="$(git -C "$repo_root" rev-parse "${import_commit}:${pkg_root}/${folder}")"
  head_tree="$(git -C "$repo_root" rev-parse "HEAD:${pkg_root}/${folder}")"

  if [ "$import_tree" = "$expected_tree" ] && [ "$head_tree" = "$expected_tree" ]; then
    echo "${folder}: identical"
  else
    echo "${folder}: DIFFERENT"
    differ=$((differ + 1))
  fi
done <"$snapshot_file"

echo "${differ} packages differ"
if [ "$differ" -ne 0 ]; then
  exit 1
fi
