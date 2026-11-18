#!/usr/bin/env bash
# Decides whether the "UI walk" check runs. Inputs: EVENT (the GitHub event name), HEAD_REF (a pull request's head branch)
# and FILES (the changed files, one per line). Writes run=true or run=false to $GITHUB_OUTPUT (or stdout).
# It runs for a manual run, for a release pull request (head branch release/...), and for a pull request that touches
# ui/, core/sdk/, a modules/**/settings* file or folder, a css file, a UI file in packs/, the walk itself or this check.
set -u
EVENT="${EVENT:-}"
HEAD_REF="${HEAD_REF:-}"
FILES="${FILES:-}"
PATTERN='^(ui/|core/sdk/|modules/(.*/)?settings[^/]*(/|$)|packs/.*(/ui/|ui[^/]*\.m?js$)|scripts/ui-walk/|scripts/ci/ui-walk|\.github/workflows/ui-walk\.yml$)|\.css$'
run=false
case "$EVENT" in
  workflow_dispatch) run=true ;;
  pull_request)
    case "$HEAD_REF" in release/*) run=true ;; esac
    if [ "$run" = false ] && printf '%s\n' "$FILES" | grep -qE "$PATTERN"; then run=true; fi
    ;;
esac
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "run=$run" >> "$GITHUB_OUTPUT"; else echo "run=$run"; fi
