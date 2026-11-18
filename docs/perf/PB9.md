# PB9: world events — a long skip runs the days once, and a day-crossing reply writes only what changed

Performance and stability (owner priority). From the perf audit (findings L1 and L7), now that world events are on main:

- **L1, long skips run the days twice.** A time skip dry-runs every world day, then runs them again for real: about 8 ms per world day, twice, so a one-year skip costs about 3 s × 2. Fix: run the days once and keep the result (or make the dry run produce the real result), so a skip costs one pass. Keep replay == live: the same days produce the same state on swipe, Re-read (incl. an edited Re-read), middle delete, rewind and reload.
- **L7, the chat file grows about 9 KB per day-crossing reply.** Each reply that crosses a day writes the whole `chronicle.daily` and ledger slots. Fix: write only what changed on that reply (a delta the replay rebuilds from), so the chat file grows by the change, not by a full copy.

Files (start here; touch only what the fix needs): `modules/world/chronicle/world-daily/hook.js`, `open-store.js`, `command.js`, and the store slots they write.

## The session
1. Check out `next`, `npm ci`, branch `perf/pb9`.
2. Read `CLAUDE.md` (rules; replay == live is non-negotiable) and this file.
3. Before the fix, measure: a test or script that skips one year and counts world-day runs and time, and one that runs 30 day-crossing replies and measures how much the stored chat data grows. Keep them as tests (`tests/modules/world/…`).
4. Fix both; show the numbers before and after in the report.
5. Replay tests: a chat with a long skip and several day-crossing replies rebuilds to the same state after swipe, edited Re-read, middle delete, rewind and reload.
6. `npm run codemap`; run `tests/modules/world` and the touched folders; `npm run check` (exit 0).
7. Plain commit message (no Co-Authored-By, no model names); `git push origin perf/pb9`. No pull request.
8. Report: numbers before/after, files changed, replay tests, anything not done.
