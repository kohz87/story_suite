# B4 removals: NPC State code kept only for the old view

Each row is code that stays under `modules/people/legacy/` at B3 because something still calls it, and goes in B4 (or earlier, when the
people module draws the same thing itself). Each entry file carries a one-line `LEGACY` header that names this file.

| Files (under `modules/people/legacy/`) | Kept because | Goes when |
|---|---|---|
| The JSON one-pass prompt (`buildNarrationCapturePrompt`, `buildNarrationCaptureParts`, the `narrationCapture` option of `buildScannerPrompt`, `core-prompts-capture-parts/capture-text.js`) and the lineage-keyed journal (`runtime-narration-parts/journal-lineage.js` and the lineage branch of `journal-keys.js`) | Only "What's sent" builds the JSON prompt now (B4-8 removed the compact setting and the non-hosted branch), and about twenty tests pin it. The journal's lineage keys replay a pre-switch chat. | The prompt goes with its tests in a later step. The one-time journal conversion (`journal-convert.js`, its frozen key copy `journal-lineage.js`) goes once every saved chat has been opened once. |

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
Removed at B4-8 (the JSON block, the part that is dead without a path to it): the setting `narrationCaptureCompact` (its Settings row "Short one-pass instruction", checkbox, default and the saved value, which is dropped when settings are read) and `core-prompts-capture-parts/capture-rules.js`; the non-hosted branch of `runtime-narration-parts/narration-part.js` (arming off Story Block, reading and merging a JSON block, the lineage-keyed capture key, `lastCaptureBlockChars`); `parseNarrationCapture`, `textCapture` and the `compactCapture` prompt option. Without Story Block no one-pass instruction is sent (the injection holds empty rules), and a reply is scanned the ordinary way. Kept: `extractNarrationCapture` (the hosted path still removes a stray block from a reply and its swipes), the sid journal `capture-journal.js` with `journal-convert.js`, `journal-lineage.js` and the lineage branch of `journal-keys.js` (they replay a pre-switch chat), `core-prompts-capture.js` (hidden-note rules), and the JSON one-pass prompt builders `buildNarrationCapturePrompt` / `buildNarrationCaptureParts` with the `narrationCapture` option of `buildScannerPrompt` and `NARRATION_CAPTURE_*` texts: only "What's sent" (`runtime-npc-api.js`) still builds them, and they go in a later step together with the tests that pin them (about twenty files). Backup: `scratch/backups/b4-8/`.
Removed at B4-10a (the branch journal): `legacy/branch*.js` with their part folders (checkpoints, the rollback journal and its undo records, delete
recovery, the reconcile rules, branch ancestry and the parent-chat inheritance, snapshots, user metadata restore, lineage migration and remapping),
`legacy/checkpoint-pack.js` with its parts, `legacy/runtime-branch.js` and `legacy/runtime-reconcile.js`; the settings `branchRescan` and
`midDeleteRewind` with their Advanced rows (a saved value is dropped when settings are read); the Branch reconciliation diagnostics (`uiStatus().branchHistory`,
`branchReconciliations`, the diagnostic bundle's `branch.history` and `branch.reconciliations`); the runtime call `inheritBranch`;
the `checkpoints`, `inlineCards`, `branchParent`, `branchForkMessageId`, `branchRootSnapshot`, `branchFamilyId` and `rollbackJournal*` fields (dropped
when a state is read; the sidecar is written as format 1, a format 2 file is read with its packed checkpoints dropped). Moved (`git mv`), unchanged apart from
dropping the exports nothing calls any more and one rename (`shared-message-fingerprint.js` to `message-hash.js`): `modules/people/lineage/` (message fingerprints, a message's lineage key, the lineage version and
comparison; the same strings as before), `calls/scan-operations.js`, `core/dismissed-groups.js`. Kept, rewritten as two small parts with the hosted
path's behaviour: `runtime/runtime-chat-branch.js` (the lineage a change stands on, which also prunes pictures: while hosted only those of people the
reader deleted, without the store those of people no longer held; the host's swipe state; the stale-chat mark used by the sidecar adoption; and the
wait for a new chat's state file, `branchInheritancePending` with `branchInheritanceChecked`, which a hosted chat never leaves until its file is saved,
as before, and an unhosted chat leaves when it opens) and `runtime/runtime-settle.js` (the swipe settle wait, merged settle requests, replies held
while a chat opens or waits; the public `reconcile`). Still here for later steps: the destructive-settlement controller (`core/destructive-settlement*.js`,
it now only asks for the settle pass), the bundle's audit history (`transfer/native-transfer-parts/history-archive.js` writes empty checkpoint and
inline-card lists so a bundle keeps its shape), the field registry's `revertGroup`, `revertList` and `userMeta` lists (`NPC_REVERT_GROUPS`,
`NPC_REVERT_LIST_FIELDS`, `BRANCH_USER_METADATA_FIELDS`, now read by tests only), and the sidecar writer with its pointers and tombstones (B4-10b).
Without a host (a refused or never-ready Story Suite host) NPC State keeps its dossiers on a swipe or delete instead of rolling them back.
Backup: `scratch/backups/b4-10a/`.
