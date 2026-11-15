#!/usr/bin/env bash
# Prints (one absolute path per line, sorted) the cross-package suite tests: the named files, every
# Story Block *.test.js that refers to a sibling package, and every tests/suite/**/*.test.js at the root.
# Usage: discover-suite-tests.sh <repo-root>
set -euo pipefail
root="${1:?usage: discover-suite-tests.sh <repo-root>}"
sb="$root/packages/story-block"
named="
  tests/v2/lean-rpg/checks/suite.test.js
  tests/v2/packs/holidays-world.test.js
  tests/v2/packs/cast-presets.test.js
  tests/v2/integration/checks-flip.test.js
  tests/v2/data-modules/unused.test.js
  tests/v2/data-modules/example-b.test.js
  tests/v2/break/e2e-playthrough.test.js
"
{
  for f in $named; do
    [ -f "$sb/$f" ] || { echo "error: missing suite test $f" >&2; exit 1; }
    echo "$sb/$f"
  done
  grep -rlE 'Story_director|npc_state_delta|STORY_SUITE_ROOT|loadSuite|SUITE_SD|SUITE_NSD|NPC_STATE_DELTA_PATH' \
    "$sb/tests" --include='*.test.js' --exclude-dir=node_modules || true
  if [ -d "$root/tests/suite" ]; then find "$root/tests/suite" -name '*.test.js' -not -path '*/node_modules/*'; fi
} | sort -u
