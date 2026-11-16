#!/usr/bin/env bash
# Checks the suite's MIN_TESTS floor (kept in suite-tests.sh) against the sum of the shards' test counts.
# Usage: suite-floor.sh <shards> <folder holding one count file per shard>
set -euo pipefail
shards="${1:?number of shards}"
dir="${2:?folder with the shard count files}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
min="$(sed -n 's/^MIN_TESTS=\([0-9][0-9]*\).*/\1/p' "$here/suite-tests.sh" | head -n 1)"
[ -n "$min" ] || { echo "error: no MIN_TESTS in suite-tests.sh" >&2; exit 1; }
total=0
found=0
for f in "$dir"/*; do
  [ -f "$f" ] || continue
  n="$(tr -d '[:space:]' < "$f")"
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then echo "error: bad count in $f" >&2; exit 1; fi
  total=$((total + n))
  found=$((found + 1))
done
if [ "$found" != "$shards" ]; then echo "error: $found shard count files, expected $shards" >&2; exit 1; fi
echo "suite tests over $found shards: $total (floor $min)"
if [ "$total" -lt "$min" ]; then
  echo "error: only $total tests reported, expected at least $min (shards lost, results lost or tests deleted)" >&2
  exit 1
fi
