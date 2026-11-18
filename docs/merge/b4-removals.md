# B4 removals: NPC State code kept only for the old view

Each row is code that stays under `modules/people/legacy/` at B3 because something still calls it, and goes in B4 (or earlier, when the
people module draws the same thing itself). Each entry file carries a one-line `LEGACY` header that names this file.

| Files (under `modules/people/legacy/`) | Kept because | Goes when |
|---|---|---|
| `narrationCaptureCompact` (the compact-rules setting, its settings row and `modules/people/core/core-prompts-capture-parts/capture-rules.js`), the JSON block path (`core/core-prompts-capture.js`, `modules/people/core/core-text-parts/capture.js`, the non-hosted branch of `runtime-narration-parts/narration-part.js`) and the lineage-keyed journal (`runtime-narration-parts/journal-lineage.js` and the lineage branch of `journal-keys.js`) | Since N7 a chat with Story Block asks for `<Changes>` lines only (no JSON block, no compact variant, journal keyed by sid). A chat with no Story Block still uses all of them, unchanged. | The old no-Story-Block path goes (nothing starts NPC State without Story Block after F1b). The one-time journal conversion (`journal-convert.js`, its frozen key copy `journal-lineage.js`) goes with it once every saved chat has been opened once. |

Built at F1b (B4-1): `modules/people/module.js` (`peopleModule`, id `people`, last in `BUILTIN_MODULES`; its register hook is the start that `index.js` passed as a `late` entry, so a failure is a MODULE_START Problem and the module is switched off), `modules/people/dossier-rows.js` (the rows moved from `legacy/story-block-tabs.js`, which B4-2 removed) and the testkit test `tests/core/boot/boot-every-module.test.js`. The v1 handshake rows were removed at B4-2 (see below). `GRAMMAR_ALONE` (`modules/time/tracker/note-parts/grammar.js`, `tracker/index.js`) is not decided in code: it serves a module set without fights (`fights: false`), so it stays until the owner decides (options in the B4F1B report).

Removed at F2 (not kept): `full-cast.js` with its Diagnostics button, both settings slots and the `fullCastScanEveryTurn` setting (owner
decision D); the launcher keep settings (`launcherWithStoryBlock`, `launcherWithStoryBlockV2`), their flags and rows; the dead v1 Story Block
flag; the `NPCStateDelta` and `NPCStateDeltaCast` page globals and the hosted DOM flag (now `runtime/handles.js`).

Removed at B4-2 (the v1 handshake): `legacy/runtime-suite.js`, `suite.js` (the `globalThis.StorySuite` registry), `suite-handshake.js` with its parts, `legacy/story-block-tabs.js` (a re-export of `dossier-rows.js`), the four manifest lines in `modules/people/runtime/runtime-modules.json`, and the `sourceOfTruth` setting (its Source of truth rows, the "Manage all in Story Suite" button and the stats-overlap warning; a saved `sourceOfTruth` is dropped when settings are read). Kept, moved to `modules/people/npc-api/`: `dossier-target.js`, `text.js`, `profile-build.js`, `profile-list.js` (NPC profiles, used by Key people), `host-probe.js` (`storyBlockIsV2`) and `reply-preview.js`; `runtime/runtime-npc-api.js` holds `pageHandles.suiteApi` (`npcs`, `npcProfiles`, `manage.preview`), the "What's sent" fold and the Enable follow-up. Behaviour with a Story Block host is unchanged (scene presence follows the host, the calendar is the host's). `runtime-modules.json` itself stays: it is the test inventory of the old runtime file names, read by tests only. `setExternalCalendarSource` (`calendar-config-parts/active.js`) is no longer called and goes with B4-7, as does the `calendarOwn` plumbing.

Removed at B4-4 (the old view): `ui/legacy/` (the old host `ui-host.js` and its parts, settings window, mounts, cards and notes under replies,
theme bridge, the old CSS; `ui/legacy/view/fonts.css` moved to `ui/css/fonts.css`), the RPG's old screens in `modules/rpg/view/` (party, wizard,
first-send hold, fight screen, export, skills, the "Changed this reply" lines) and the old board screen parts (`board/{offer-line,settings,skill-editor}.js`,
`board.css`, `fight-start.css`), `modules/data-modules/screens/` with `setup.js`, `block-templates.js` and `block-layout*` (the Customize and blocks
editor, dropped by D2), `packs/layout/{index,render,styles}.js`, `packs/card-offer-ui.js`, `core/persist/compat.js`, `ui/entry/{flag,switch}.js`,
`ui/css/next-hide.css` and `scripts/sync-redraw-copy.mjs`. NPC State's settings section now sits in the drawer the view draws (`ui/entry/drawer-buttons.js`).

Removed at B4-5 (the old dossier panel): `dossier-ui.js` with every `dossier-ui-*` file and part folder (the panel: library, board, sections,
profile and their styles), `relationship-map.js`, `relationship-map-core*` and `relationship-map-focus*` (its Map view), `dossier-skin*` (its look
switch), `launcher-ui*` (its backdrop, full-screen chrome and the hidden floating button), the panel half of `dossier-experience.js` (the header menu
and per-person diagnostics), the settings section's "Open dossiers" button and its placeholder slots. A dossier opens in the view: NPC State's
`openDossier` and the present cards call `pageHandles.openPerson`, which the view sets (`ui/entry/turn-on.js`, `suite.person`). Moved, not
removed: the tools core and dialogs to `modules/people/tools/` (`tools-core*`, `data-tools.js`, `settings-actions.js` for the Backup, Restore and
Diagnostics buttons), the NPC editor's refinements (`editor-refine.js`, `editor-styles.js`, `life-state.js`, `node-write-guards.js`,
`continuity-ui.js`), the calendar and scanner-output controls to `modules/people/settings/` (they draw into the section's own groups), and the two
setting normalizers to `settings/runtime-settings-parts/{map-settings,dossier-look}.js`. The portrait manager opens from the view's dossier
(⋯ › Portrait, `ui/port/people-portrait.js`). Backup: `scratch/backups/b4-5/`.

Removed at B4-6 (the in-chat present cards): `legacy/runtime-inline-cards.js` with its `-megumin`, `-mode`, `-mount` and `-state` parts (the chat
observer, watchdog and renderer, the Megumin "Present NPCs" tab, the display choice, the `inlineCards` writers), the setting `presentCastDisplay` with
`presentCastDisplayChosen` and its row, `legacy/present-scene-parts/{chatter-parse,world-state-parse,story-block-tags,scene-groups,shared-patterns}.js`
(the Story Block scene and NPC Inner Chatter readers, dead since the v1 registry went: nothing defines `StoryBlock.listBlocks`), the chatter, chip and
Megumin pane CSS. Kept, because the Cast and World panes draw them: `legacy/present-scene.js` (now the now-lines parts only) and the roster markup, rewritten
as `legacy/runtime-present-cast.js`; the NPC lookup (`runtime-npc-lookup.js`) and a cast refresh (`runtime-cast-refresh.js`) are the two small parts of the
old state and mount files that other code still calls. The `inlineCards` field and its branch, transfer and hydration readers stay for B4-10a.
`megumin_state`: zero hits in code before and after. Backup: `scratch/backups/b4-6/`.
Moved at B4-7 (calendar and relationship): `legacy/calendar.js`, `calendar-{clock,config,date,derived}.js` and their part folders to `modules/people/calendar/`;
`legacy/relationship-pass*` and `relationship-pacing*` to `modules/people/relationship/` (`git mv`, unchanged; every importer re-pointed; tests that name
files the old way find them through `tests/people/helpers/old-path.js`). Removed: the `calendarOwn` plumbing (the adapter option, the queries' and
timeline's checks, `applyCastEntry`'s option, the meters' `calendarOwn` hook, the 'own' Expert note) and `setExternalCalendarSource` with its cache
(added to `removed-exports.txt`). Kept, because something still reaches them: the focused relationship pass (a manual Scan, and a scan without a
one-pass block, run it while hosted) and NPC State's own calendar settings (`settings/calendar-settings.js`: the months and manual date used when no
Story Director calendar is linked). Removing either changes what a reader gets, so each waits for a decision. Backup: `scratch/backups/b4-7/`.
