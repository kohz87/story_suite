#!/usr/bin/env bash
# Runs Story Block's cross-package suite tests against the three workspace packages
# by symlinking them under a temporary directory with their legacy sibling names.
set -euo pipefail

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

files="
  tests/v2/lean-rpg/checks/suite.test.js
  tests/v2/packs/holidays-world.test.js
  tests/v2/packs/cast-presets.test.js
  tests/v2/integration/checks-flip.test.js
  tests/v2/data-modules/unused.test.js
  tests/v2/data-modules/example-b.test.js
  tests/v2/break/e2e-playthrough.test.js
  ../../tests/suite/static-prompt.test.js
"

for f in $files; do
  if [ ! -f "$f" ]; then
    echo "error: missing suite test $f" >&2
    exit 1
  fi
done

set +e
# shellcheck disable=SC2086
node --test --test-reporter=tap $files | tee "$tap_file"
status=${PIPESTATUS[0]}
set -e

skipped="$(sed -n 's/^# skipped //p' "$tap_file" | tail -n 1)"
echo "skipped suite tests: ${skipped:-unknown}"
if [ "${skipped:-}" != "0" ]; then
  echo "error: suite tests skipped instead of running (siblings not found, or a test is skipped)" >&2
  grep -E '# SKIP' "$tap_file" >&2 || true
  exit 1
fi

exit "$status"
