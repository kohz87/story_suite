#!/usr/bin/env bash
# Chooses the base commit for the diff check and the legacy-list ratchet; writes a multi-line
# bases=<ref per line> output to $GITHUB_OUTPUT (or stdout); the workflow checks once per line.
# Inputs: BASE (event base sha, may be empty) and EVENT (event name).
# When there is no usable event base (a push that creates a branch, a manual run), the base comes from
# history, never from remote refs: every parent of HEAD whose tree has docs/merge/legacy-oversize.txt (several
# lines for a merge), else the nearest ancestor of any lineage that has it.
# Only when no ancestor has the list is this the push that first creates it (stage B1), and the base is
# the import commit (or HEAD^, or the empty tree when there is no parent).
set -u
IMPORT=c340e6533a3eb63abfa0623870dbc8d6f9bf5927
ZEROS=0000000000000000000000000000000000000000
LIST=docs/merge/legacy-oversize.txt
BASE="${BASE:-}"
EVENT="${EVENT:-}"

fail() { echo "$1" >&2; exit 1; }

# Prints the commits to ratchet against, one per line: every parent of HEAD whose tree has the list (a merge
# must pass against each); else the nearest ancestor of any lineage that has it; else nothing (stage B1).
bases_with_list() {
  local rev found=""
  git cat-file -e HEAD^ 2>/dev/null || return 0
  for rev in $(git rev-list --parents -n 1 HEAD | cut -d' ' -f2-); do
    if git cat-file -e "$rev:$LIST" 2>/dev/null; then found="$found$rev"$'\n'; fi
  done
  if [ -z "$found" ]; then
    for rev in $(git rev-list --topo-order HEAD^@); do
      if git cat-file -e "$rev:$LIST" 2>/dev/null; then found="$rev"$'\n'; break; fi
    done
  fi
  printf '%s' "$found"
}

fallback() {
  local found
  found="$(bases_with_list)"
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
echo "Bases: $BASE" | tr '\n' ' '; echo
{ echo "bases<<BASES_EOF"; printf '%s\n' "$BASE"; echo "BASES_EOF"; } >> "${GITHUB_OUTPUT:-/dev/stdout}"
