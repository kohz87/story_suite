# CI

Two workflows run on pull requests (`.github/workflows/`):

| Workflow | Checks | When |
|---|---|---|
| `ci.yml` | `rules`, `core`, `ui`, `modules` (three shards), `people`, `suite` (two shards), `layout-dry-run` (informational), `verify` (the one gate for branch protection) | every pull request and every push to main |
| `ui-walk.yml` | **UI walk**: the settings click-through in a real SillyTavern, one job per size (1920, 1280, 390) and theme (dark, light) | a manual run, a release pull request (head `release/...`), and a pull request that touches `ui/`, `core/sdk/`, `modules/**/settings*`, css, a UI file in `packs/` or the walk |

The UI walk is its own workflow because it is skipped for most pull requests, and a skipped job cannot sit in `verify`'s `needs`. Add it to the branch-protection list by name when it should be required. How it works, how long it takes and what its artifact holds: `docs/dev/release-walkthrough.md`, "The same walk in CI".

The `ui` job runs every `tests/ui/**/*.test.js`, which includes the no-placeholder-wording gate for Settings (`tests/ui/settings/no-unavailable.test.js`).
