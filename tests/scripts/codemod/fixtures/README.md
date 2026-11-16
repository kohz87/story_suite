# Frozen pre-move fixtures for the codemod self-tests

These files are frozen copies of how the files the self-tests need looked before the layout move (old `packages/...` paths and text). The tests read them instead of the real tree or of inline path strings, because the move rewrites paths in test source files and the real tree no longer has the old layout.

- `package-based-pre-move.json` — the rules and the three files `package-based.test.js` plans, rewrites and verifies.
- `shared-importers-pre-move.json` — the four files `shared-importers.test.js` puts in a toy repo (a package.json, a manifest and two readers of it).

Do not update them to new paths: the tests exist to show the tool handles the old layout.
