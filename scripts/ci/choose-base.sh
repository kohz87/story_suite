#!/usr/bin/env bash
# Chooses the base commit for the diff check and the legacy-list ratchet; writes base=<ref> to
# $GITHUB_OUTPUT (or stdout). Inputs: BASE (event base sha, may be empty) and EVENT (event name).
# When there is no usable event base (a push that creates a branch, a manual run), the base comes from
# history, never from remote refs: the nearest ancestor of HEAD whose tree has docs/merge/legacy-oversize.txt.
# Only when no ancestor has the list is this the push that first creates it (stage B1), and the base is
# the import commit (or HEAD^, or the empty tree when there is no parent).
set -u
IMPORT=c340e6533a3eb63abfa0623870dbc8d6f9bf5927
ZEROS=0000000000000000000000000000000000000000
LIST=docs/merge/legacy-oversize.txt
BASE="${BASE:-}"
EVENT="${EVENT:-}"

fail() { echo "$1" >&2; exit 1; }

# Prints the nearest ancestor (HEAD excluded, first parents) that has the list, or nothing.
nearest_with_list() {
  local rev
  git cat-file -e HEAD^ 2>/dev/null || return 0
  for rev in $(git rev-list --first-parent HEAD^); do
    if git cat-file -e "$rev:$LIST" 2>/dev/null; then echo "$rev"; return 0; fi
  done
}

fallback() {
  local found
  found="$(nearest_with_list)"
  if [ -n "$found" ]; then BASE="$found"
  elif git merge-base --is-ancestor "$IMPORT" HEAD 2>/dev/null; then BASE="$IMPORT"
  elif git cat-file -e HEAD^ 2>/dev/null; then BASE=HEAD^
  else BASE="$(git hash-object -t tree /dev/null)"; fi
}

# A manual run prefers origin/main when it is a different commit that has the list.
manual_base() {
  git fetch --no-tags -q origin main 2>/dev/null || return 1
  [ "$(git rev-parse origin/main)" != "$(git rev-parse HEAD)" ] || return 1
  git cat-file -e "origin/main:$LIST" 2>/dev/null || return 1
  BASE=origin/main
}

if [ "$EVENT" = workflow_dispatch ] && [ -z "$BASE" ]; then
  manual_base || fallback
elif [ "$EVENT" = push ] && [ "$BASE" = "$ZEROS" ]; then
  fallback
elif [ -z "$BASE" ]; then
  fail "no base commit for a $EVENT event; cannot apply the legacy-list ratchet"
elif ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  git fetch --no-tags origin "$BASE" || true
  git cat-file -e "$BASE^{commit}" 2>/dev/null || fail "the base $BASE is not available; cannot apply the legacy-list ratchet"
fi
echo "Base: $BASE"
echo "base=$BASE" >> "${GITHUB_OUTPUT:-/dev/stdout}"
