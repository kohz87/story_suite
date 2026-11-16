#!/usr/bin/env bash
# Runs Story Block's whole test suite with the sibling packages present (so its cross-package tests run
# instead of skipping), plus every root tests/suite/**/*.test.js. The siblings are the three workspace
# packages symlinked under a temporary directory with their legacy names.
set -euo pipefail

# Raise the floor when tests are added. A lower "# tests" count means test-level results were not
# reported or tests were lost.
MIN_TESTS=5826
# The only TODO tests allowed, by exact test name (like the skip reasons). Any other TODO fails the job.
ALLOWED_TODOS=(
  "C4-2 (open): no chat file is made again under the old name by a save already on its way (needs the server to refuse a save of a renamed chat, or the page to delete that copy)"
)
# The only skips allowed, by reason. Any other skip fails the job.
ALLOWED_SKIPS=(
  "SWIPECHK_FILES (the run data folder) is not set"
  "this shard makes no remake; shards 2 to 4 check it"
)
# The two browser skips (rendered tests) are allowed only on a machine with no browser installed. In CI
# (CI=true) a missing browser package or browser fails the job.
BROWSER_SKIPS=(
  "Install the optional browser package to run the rendered"
  "Browser unavailable:"
)
browser_installed() {
  node -e "import('playwright').then(m => process.exit(require('fs').existsSync(m.chromium.executablePath()) ? 0 : 1), () => process.exit(1))" 2>/dev/null
}
if [ "${CI:-}" != "true" ] && ! (cd "$(git rev-parse --show-toplevel)" && browser_installed); then
  ALLOWED_SKIPS+=("${BROWSER_SKIPS[@]}")
fi

repo_root="$(git rev-parse --show-toplevel)"
tmpdir="$(mktemp -d)"
# One test looks only for a sibling folder "../../../../Story_director" (packages/Story_director here) and
# ignores STORY_SUITE_ROOT; B1 must not edit package files, so a temporary symlink stands in for it.
legacy_link="$repo_root/packages/Story_director"
made_link=0
if [ ! -e "$legacy_link" ]; then ln -s story-director "$legacy_link"; made_link=1; fi
trap 'rm -rf "$tmpdir"; if [ "$made_link" = 1 ]; then rm -f "$legacy_link"; fi' EXIT

suite_root="$tmpdir/suite"
mkdir -p "$suite_root"
ln -s "$repo_root/packages/story-block" "$suite_root/Story_block"
ln -s "$repo_root/packages/story-director" "$suite_root/Story_director"
ln -s "$repo_root/packages/npc-state-delta" "$suite_root/npc_state_delta"

tap_file="$tmpdir/suite.tap"
cd "$repo_root/packages/story-block"
export STORY_SUITE_ROOT="$suite_root"
export NPC_STATE_DELTA_PATH="$suite_root/npc_state_delta"
export NODE_OPTIONS="--max-old-space-size=4096 ${NODE_OPTIONS:-}"

# The same globs as Story Block's npm test, plus the root suite tests.
globs=("tests/*.test.js" "tests/v2/**/*.test.js" "examples/fishing/tests/*.test.js")
if [ -d "$repo_root/tests/suite" ]; then globs+=("$repo_root/tests/suite/**/*.test.js"); fi

set +e
# --test-timeout fails a hung test after 10 minutes instead of holding the job (the job has its own timeout too).
node --test --test-timeout=600000 --test-reporter=tap "${globs[@]}" | tee "$tap_file"
status=${PIPESTATUS[0]}
set -e

count_of() { sed -n "s/^# $1 //p" "$tap_file" | tail -n 1; }
tests="$(count_of tests)"; skipped="$(count_of skipped)"; todo="$(count_of todo)"
echo "suite tests: ${tests:-unknown}, skipped: ${skipped:-unknown}, todo: ${todo:-unknown}"

fail=0
if [ "${tests:-0}" -lt "$MIN_TESTS" ]; then
  echo "error: only ${tests:-0} tests reported, expected at least $MIN_TESTS (siblings missing, results lost or tests deleted)" >&2
  fail=1
fi
# TODO lines look like "ok N - <name> # TODO"; the name must equal one on the list exactly.
set +e
todo_lines="$(grep -E ' # TODO' "$tap_file")"
grep_status=$?
set -e
if [ "$grep_status" -ge 2 ]; then echo "error: could not read the test results" >&2; exit 1; fi
todo_count=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  todo_count=$((todo_count + 1))
  name="$(printf '%s' "$line" | sed -E 's/^[[:space:]]*(not )?ok [0-9]+ - //; s/ # TODO.*$//')"
  allowed=0
  for known in "${ALLOWED_TODOS[@]}"; do
    [ "$name" = "$known" ] && allowed=1
  done
  if [ "$allowed" = 0 ]; then echo "error: a TODO test not on the allowed list: $line" >&2; fail=1; fi
done <<< "$todo_lines"
if [ "${todo:-0}" != "$todo_count" ]; then
  echo "error: ${todo:-unknown} todo tests reported but $todo_count TODO lines listed" >&2
  fail=1
fi
# status 1 = no match, 2 or more = error.
set +e
skip_lines="$(grep -E '# SKIP' "$tap_file")"
grep_status=$?
set -e
if [ "$grep_status" -ge 2 ]; then echo "error: could not read the test results" >&2; exit 1; fi
skip_count=0
while IFS= read -r line; do
  [ -n "$line" ] || continue
  skip_count=$((skip_count + 1))
  allowed=0
  for reason in "${ALLOWED_SKIPS[@]}"; do
    case "$line" in *"# SKIP $reason"*) allowed=1 ;; esac
  done
  if [ "$allowed" = 0 ]; then echo "error: skipped for a reason not on the allowed list: $line" >&2; fail=1; fi
done <<< "$skip_lines"
if [ "${skipped:-0}" != "$skip_count" ]; then
  echo "error: $skipped skipped tests reported but $skip_count skip lines listed" >&2
  fail=1
fi
[ "$fail" = 0 ] || exit 1
exit "$status"
