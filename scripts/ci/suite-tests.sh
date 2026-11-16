#!/usr/bin/env bash
# Runs the Story Block test folders with the sibling folders present (so the cross-package tests run instead of
# skipping), plus tests/suite and tests/people. The siblings are linked under a temporary directory with their legacy names.
set -euo pipefail

# SUITE_SHARD=i/N runs only shard i of N (node --test-shard: every test file runs in exactly one shard). A shard
# cannot check the floor alone, so it writes its test count to SUITE_COUNT_FILE and scripts/ci/suite-floor.sh
# checks the sum over all shards. Skips and todos are still checked per shard.
shard="${SUITE_SHARD:-}"
shard_flag=()
if [ -n "$shard" ]; then
  case "$shard" in [1-9]/[1-9]) ;; *) echo "error: SUITE_SHARD must look like 1/2, got $shard" >&2; exit 1 ;; esac
  : "${SUITE_COUNT_FILE:?SUITE_COUNT_FILE must be set when SUITE_SHARD is set (the floor is checked over all shards)}"
  shard_flag=("--test-shard=$shard")
fi

# Raise the floor when tests are added. A lower "# tests" count means test-level results were not
# reported or tests were lost.
MIN_TESTS=7400
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
# A skip allowed only outside CI: the previous-build test needs the whole git history (CI checks it out, and there the test fails instead).
LOCAL_SKIPS=(
  "the previous build is not in this checkout (needs the full git history)"
)
if [ "${CI:-}" != "true" ]; then
  ALLOWED_SKIPS+=("${LOCAL_SKIPS[@]}")
fi
browser_installed() {
  node -e "import('playwright').then(m => process.exit(require('fs').existsSync(m.chromium.executablePath()) ? 0 : 1), () => process.exit(1))" 2>/dev/null
}
if [ "${CI:-}" != "true" ] && ! (cd "$(git rev-parse --show-toplevel)" && browser_installed); then
  ALLOWED_SKIPS+=("${BROWSER_SKIPS[@]}")
fi

repo_root="$(git rev-parse --show-toplevel)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# The sibling folders some tests look in (Story_block, Story_director, npc_state_delta under STORY_SUITE_ROOT) come
# from scripts/layout.json (suiteFarm), built by scripts/ci/farm.mjs.
suite_root="$tmpdir/suite"
mkdir -p "$suite_root"
node "$repo_root/scripts/ci/farm.mjs" "$repo_root" "$suite_root" > /dev/null

tap_file="$tmpdir/suite.tap"
cd "$repo_root"
export STORY_SUITE_ROOT="$suite_root"
export NPC_STATE_DELTA_PATH="$suite_root/npc_state_delta"
# the NPC State tests in tests/people need the synthetic host's setup (module hook for the host imports, old file names)
export NODE_OPTIONS="--max-old-space-size=4096 --import ./tests/people/active-runtime-test-setup.mjs ${NODE_OPTIONS:-}"

# The same folders as npm run test:sb, plus the cross-package tests (tests/suite, tests/people) that need the siblings present.
globs=("tests/modules/**/*.test.js" "tests/packs/**/*.test.js" "tests/matrix/**/*.test.js" "tests/bench/*.test.js" "tests/authoring-kit/*.test.js" "examples/fishing/tests/*.test.js" "tests/suite/**/*.test.js" "tests/people/**/*.test.js")

set +e
# --test-timeout fails a hung test after 15 minutes instead of holding the job (the job has its own timeout too).
# The limit reports the hung test as "not ok ... timed out"; if it holds a live handle the job's own timeout-minutes ends the run.
# Do not add --test-force-exit: it stops the run once the top-level tests registered so far finish, dropping later tests with exit 0.
# Headroom: the slowest local test (fuzz seed 16) took up to ~490 s on a loaded machine, so 900 s is about 1.8x locally (about 3x on GitHub).
node --test --test-timeout=900000 ${shard_flag[@]+"${shard_flag[@]}"} --test-reporter=tap "${globs[@]}" | tee "$tap_file"
status=${PIPESTATUS[0]}
set -e

count_of() { sed -n "s/^# $1 //p" "$tap_file" | tail -n 1; }
tests="$(count_of tests)"; skipped="$(count_of skipped)"; todo="$(count_of todo)"
echo "suite tests: ${tests:-unknown}, skipped: ${skipped:-unknown}, todo: ${todo:-unknown}"

fail=0
if [ -n "$shard" ]; then
  echo "${tests:-0}" > "$SUITE_COUNT_FILE"
elif [ "${tests:-0}" -lt "$MIN_TESTS" ]; then
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
