# Running a Studio job in Claude Code on the web

One session builds one job. Start the session on this repository, then send:

> Do Studio job ST-XXX by following docs/studio/CLOUD.md on branch studio/f4.

## What the session does
1. Check out `studio/f4`, run `npm ci`, and make a branch `studio/st-xxx` (the job name in lower case).
2. Read `CLAUDE.md` (the rules: files at most 450 lines including tests, one job per file, at most 4 exports, `npm run codemap` after any file change, no model names anywhere, "NPC State" in reader-facing text).
3. Read `docs/studio/README.md`, the job's row in `docs/studio/studio-jobs.md` (Files, What, Tests are the brief: build only those files) and the parts of `docs/studio/studio-plan.md` it cites; look at `docs/studio/mocks/` (stmk1-* is the record page every editor follows).
4. Use the existing pieces: `studio/form/*` (fields, chip lists, sub-records, pickers) and the `ctx` contract in `studio/views/route.js`. When opening a picker, pass `{}` as its document argument (`ctx.doc` is the pack, not the DOM).
5. Touch only the job's own files and its test file; never the hub files (`studio/app.js`, `parts.js`, `shell.js`, `export.js`, `index.html`, `studio.css`, `views/route.js`).
6. Run only the job's own test file plus `npm run check` (exit 0, including the code map check).
7. Commit with a plain message (no Co-Authored-By, no model names) and `git push origin studio/st-xxx`. Do not push to `studio/f4` and do not open a pull request: the lead checks and merges it.
8. End with a short report: files, tests and counts, anything from the row not done, wording choices.
