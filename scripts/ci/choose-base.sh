#!/usr/bin/env bash
# Chooses the base commit for the diff check and the legacy-list ratchet; writes base=<ref> to
# $GITHUB_OUTPUT (or stdout). Inputs: BASE (event base sha, may be empty) and EVENT (event name).
# The import-commit fallback exists only for the push that first creates docs/merge/legacy-oversize.txt
# (stage B1). Once origin/main has that list, a zero, missing or unreadable base is an error.
set -u
IMPORT=c340e6533a3eb63abfa0623870dbc8d6f9bf5927
ZEROS=0000000000000000000000000000000000000000
LIST=docs/merge/legacy-oversize.txt
BASE="${BASE:-}"
EVENT="${EVENT:-}"

fail() { echo "$1" >&2; exit 1; }

# 0 = origin/main already has the list, 1 = it does not. A main that is only this push does not count.
main_has_list() {
  if ! git fetch --no-tags -q origin main 2>/dev/null; then
    git ls-remote --exit-code --heads origin main >/dev/null 2>&1
    [ $? -eq 2 ] && return 1
    fail "cannot reach origin/main to decide whether the legacy list exists"
  fi
  [ "$EVENT" = push ] && [ "$(git rev-parse origin/main)" = "$(git rev-parse HEAD)" ] && return 1
  git cat-file -e "origin/main:$LIST" 2>/dev/null
}

fallback() {
  if main_has_list; then fail "origin/main already has $LIST; the base $BASE is missing, so the ratchet cannot be applied"; fi
  if git merge-base --is-ancestor "$IMPORT" HEAD 2>/dev/null; then BASE="$IMPORT"
  elif git cat-file -e HEAD^ 2>/dev/null; then BASE=HEAD^
  else BASE="$(git hash-object -t tree /dev/null)"; fi
}

if [ "$EVENT" = workflow_dispatch ] && [ -z "$BASE" ]; then
  if main_has_list; then BASE=origin/main; else fallback; fi
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
