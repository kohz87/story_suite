# B4 removals: NPC State code kept only for the old view

Each row is code that stays under `modules/people/legacy/` at B3 because something still calls it, and goes in B4 (or earlier, when the
people module draws the same thing itself). Each entry file carries a one-line `LEGACY` header that names this file.

| Files (under `modules/people/legacy/`) | Kept because | Goes when |
|---|---|---|
| `dossier-ui.js` and everything it reaches: `dossier-ui-*.js`, `dossier-ui-*-parts/`, `dossier-ui-parts/` | The Dossiers tab's `openDossier` fires `npc-state-delta:open-dossier`; only `dossier-ui-mount.js` handles it and draws the dossier panel. | The people module opens a dossier with a direct call and its own panel. |
| `dossier-tools.js`, `dossier-tools-core.js`, `dossier-tools-core-parts/` | Import, native export and diagnostics dialogs of that panel (`dossier-experience.js` imports them). | Same. |
| `dossier-experience.js`, `dossier-experience-state*.js`, `dossier-experience-styles.js` | Binds the panel's header menu and editor actions. | Same. |
| `relationship-map.js`, `relationship-map-core*`, `relationship-map-focus*` | The panel's Map view; also mounts the map settings into the settings panel. | Same. |
| `continuity-ui.js` | Normalizes the panel editor's appearance section. | Same. |
| `launcher-ui.js`, `launcher-ui-position*` | Also owns the panel's backdrop and full-screen chrome (`.delta-backdrop`, `.delta-panel`, the phone and tablet rules). The floating button is always hidden since F2. | The panel is replaced (the chrome moves with it, the button code goes). |
| `calendar-settings.js`, `scanner-output-ui.js` | Mount into the settings panel the hosted overlay moves (`data-delta-settings-slot`). | The hosted settings fold draws these two controls itself. |
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
`ui/css/next-hide.css` and `scripts/sync-redraw-copy.mjs`. The NPC State panel rows above stay until B4-5: its settings section now sits in the
drawer the view draws (`ui/entry/drawer-buttons.js`), and the old dossier panel it opens no longer gets the old view's glass tokens (it falls back
to its own colours).
