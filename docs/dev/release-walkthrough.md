# Release walkthrough

Before a release (a version bump merged to main), walk the new view in a **real SillyTavern** at desktop and phone width, dark and light. The harness (`ui/dev/harness.html`) is not enough: its fixtures are not the real rows, and its checks compare looks, not what a click does.

Use a **replica**, never your play data: a SillyTavern started on its own port with a copy of a data root made **without `secrets.json`**, with `extensions/Story_suite` pointing at the checkout under test. Nothing in this list needs a model call.

## 1. The settings walk (automatic)

Start the replica, then:

```sh
node scripts/ui-walk/settings-walk.mjs --url http://127.0.0.1:<port> --out <folder>
```

It starts nothing itself. For each size (1920×1080, 1280×800, 390×844) in dark and light it opens the last chat, opens the suite from SillyTavern's Extensions menu (Story Suite) and Settings from the ⚙ on the suite view, then on every Settings page, for every control, with real clicks:

- changes it (a switch flips, a choice takes the next option, a number goes up one step (the step its hint states, else 1), text gets " walk" added, chips toggle the first); when nothing is stored it tries once more (a number one step down, text with its last number one up), so a value at its top or a list with a fixed format is not counted as a broken row; the first value it tried is in the note;
- checks the page shows the new value, and the **visible effect** where there is one: Look's Panel style, Glass strength, Font and Text size change the suite view; Panel background sets the suite's `data-panelbg`; the RPG switch shows or hides Settings › RPG and the Party tab; Calendar shows Era, Months, Weekdays and Leap years only for Custom; turning a module off greys its own Settings page;
- checks something was **stored** (the suite's extension settings, this chat's metadata or its device keys);
- for a control that adds, hides or greys other controls or changes their values (module and feature switches, World events, a portrait style preset, …), and for every row with an effect check: checks the open page **redraws** to match a fresh Settings, puts it back at once (so the next row is seen from the first state), and reload-checks it at the end with the others like it (module switches in a batch of their own);
- checks a **fresh Settings** reads the new value (a refused or clamped value shows here);
- **reloads** the whole page and checks every change stuck (for a batch of controls put back at once: that each reads after the reload what a fresh Settings showed just before it, as one can move another);
- **puts every value back** and checks a fresh Settings reads the first value; after the run it reloads and lists any stored value that still differs.

Never clicked, and listed as SKIP with the reason: action buttons (Reset, Test, Keep this moment, Report, pack Remove and Import, the tracker buttons, the portrait style's Save as a new preset and Delete this preset, the presets on Start, Features and Settings › links), Use the old view, and the This chat / New chats scope. Also SKIP: a control greyed when its turn comes (its module or feature is off), one already walked on an earlier page (a module card shown on Start and on its own page), one hidden by an earlier change on the page, and one with no other value to pick. Model calls are refused by the script whatever the replica's connection says.

If the walk itself stops on a control, that control is marked FAIL (check `walk`), Settings is opened again, the control put back and the walk goes on. If the final reload-and-restore step stops, the script writes the suite's stored settings and device keys back from the snapshot it took before the run (by script, not by clicks) and says so in the notes at the top of `results.md`.

The walk only sees the pages and rows the replica's state draws: Settings › RPG and fights exists only while the RPG is on, and rows such as World's Tempo and Director calls only while World events is on (the walk puts every switch back at once, so it never walks behind one it turned on). Run it a second time with those switches on in the replica (set them in its `settings.json` with the server stopped), for example `--only start,rpg,world`.

Options: `--sizes 1280x800`, `--themes light`, `--only look,rpg` (page ids), `--character <name>` (default: the character chatted with last). Dark and light are forced through SillyTavern's theme colours (`--SmartThemeBodyColor`, `--SmartThemeBlurTintColor`), which the suite's Follow SillyTavern reads; a run whose suite does not turn fails at once.

It writes `results.md` (counts per run, the failures with a screenshot each, then every control), `results.json`, and the screenshots into `--out`, and exits 1 when anything failed. A full run takes a while: one load and up to four reloads per size and theme (kept rows, switches, module switches, the final check).

### The same walk in CI: the "UI walk" check

The workflow `.github/workflows/ui-walk.yml` (check name **UI walk**, one job per size and theme: `walk (1920x1080, dark)` … `walk (390x844, light)`) runs section 1 on the pull request, so it is not left to memory. It runs for a manual run (Actions › UI walk › Run workflow), for every release pull request (head branch `release/...`), and for a pull request that touches `ui/`, `core/sdk/`, a `modules/**/settings*` file, any `.css` file, a UI file in `packs/`, `scripts/ui-walk/` or the CI files of the walk (`scripts/ci/ui-walk-scope.sh` decides; `tests/scripts/ui-walk-scope.test.js` holds the list). Any other pull request skips it; it is not one of the `verify` job's needs.

Each job checks out SillyTavern at the pinned release (`SILLYTAVERN_TAG` in the workflow, the version the replica uses; change both together), installs it with `npm ci`, starts it on a new data root with this checkout as `extensions/Story_suite` (`scripts/ci/ui-walk-run.sh`: no secrets, no model calls, the walk refuses them itself), installs the Playwright Chromium, runs `settings-walk.mjs` for its one size and theme, and stops the server. SillyTavern's packages and the browser are cached. One size and theme takes about 8 minutes; the six run side by side.

A failed row fails the job. Open the run's summary for the table, or download the artifact `ui-walk-<size>-<theme>-<attempt>` (`results.md`, `results.json`, a screenshot per failure, `server.log`). The CI walk starts from SillyTavern's default settings (Role play and World events off), so it does not walk Settings › RPG or World's Tempo; run section 1 on a replica with them on (`--only start,rpg,world`) when a change touches them.

The "no placeholder wording" check (`tests/ui/settings/no-unavailable.test.js`) needs nothing here: it runs in the normal `ui` job.

## 2. By hand, at 1280 (desktop) and 390 (phone), dark and light

| Page or action | Check |
|---|---|
| Open the suite view | From the Extensions menu (Story Suite) and from the drawer's Open Story Suite: the card, tab strip (desktop) or bottom bar (phone), and ⚙ are there and nothing overlaps. |
| Reply row, swipes 1/1 | On a reply with one swipe: the row under the reply (state chips, reply menu) and SillyTavern's swipe arrows are both usable. |
| Reply row, swipes 2/3 | Swipe to a second of three swipes: the row shows that swipe's state; swipe back and it shows the first one's again. |
| Every tab | Now, Party (RPG on), Bag, People, World, Journal, Story; Activity and Fight while one is open. Each draws with no "unavailable" placeholder and no empty card that should have data. |
| Settings walk | Section 1, or by hand: every page opens at both widths, the phone list goes back with ‹ Settings. |
| Character wizard | New character from the Game view: every step opens, Back and Next work, the review shows what was picked; cancel leaves no draft behind. |
| Save points | Settings › Tools › Save points (with the feature on): Keep this moment adds one; Return here opens its branch; Forget takes it off the list. |
| Card offer | A chat whose character card carries a pack or tracker: the offer shows once, and both answers do what they say. |
| Follow star | People › a dossier › ☆ Follow turns into ★ Following, the person shows under the ★ Following filter and with ★ on Now; unfollow reverses all three. |

Write what failed (page, width, theme, what you saw) into the release's pull request.
