#!/usr/bin/env bash
# Runs the cross-package suite tests (discovered, see discover-suite-tests.sh) against the three workspace packages
# by symlinking them under a temporary directory with their legacy sibling names.
set -euo pipefail

# Raise this when suite tests are added. A lower "# tests" count means test-level results were not
# reported (only one result per file) or tests were lost, so the skip counter below cannot be trusted.
EXPECTED_SUITE_TESTS=87

repo_root="$(git rev-parse --show-toplevel)"
tmpdir="$(mktemp -d)"
# checks-flip.test.js looks only for a sibling folder "../../../../Story_director" (packages/Story_director here) and
# ignores STORY_SUITE_ROOT; B1 must not edit package files, so a temporary symlink stands in for the old sibling.
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

files="$(bash "$repo_root/scripts/ci/discover-suite-tests.sh" "$repo_root")"
echo "suite test files:"
printf '%s\n' "$files"

set +e
# shellcheck disable=SC2086
node --test --test-reporter=tap $files | tee "$tap_file"
status=${PIPESTATUS[0]}
set -e

count_of() { sed -n "s/^# $1 //p" "$tap_file" | tail -n 1; }
tests="$(count_of tests)"
skipped="$(count_of skipped)"
todo="$(count_of todo)"
echo "suite tests: ${tests:-unknown}, skipped: ${skipped:-unknown}, todo: ${todo:-unknown}"
if [ "${skipped:-}" != "0" ] || [ "${todo:-}" != "0" ]; then
  echo "error: suite tests skipped or marked todo instead of running (siblings not found, or a test is skipped)" >&2
  grep -E '# (SKIP|TODO)' "$tap_file" >&2 || true
  exit 1
fi
if [ "${tests:-0}" -lt "$EXPECTED_SUITE_TESTS" ]; then
  echo "error: only ${tests:-0} suite tests reported, expected at least $EXPECTED_SUITE_TESTS (test-level results missing or tests lost)" >&2
  exit 1
fi

exit "$status"
