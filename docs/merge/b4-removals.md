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
| `runtime-suite.js`, `suite.js`, `suite-handshake*` | The v1 Story Suite connection. F1 built the one root entry and manifest but did not delete these. Only `suite.js` (the `globalThis.StorySuite` registry write) is in `docs/merge/global-exceptions.txt` until then. | Piece F1b (B4): the people module (`modules/people/module.js`, `peopleModule`, last in `BUILTIN_MODULES`) replaces the handshake. |
| `modules/people/runtime/runtime-modules.json` and the `sourceOfTruth` setting (read in `runtime-suite.js`, `capture-result.js`, `runtime-inline-cards-present.js`) | They belong to the handshake: which side owns the state. | F1b, with the handshake. |

Not built yet, each owned by F1b: `modules/people/module.js` and `dossier-rows.js`; the testkit test that boots `createHost` with every module in `BUILTIN_MODULES` (plan §7); the decision on `GRAMMAR_ALONE` (`modules/time/tracker/note-parts/grammar.js`, `modules/time/tracker/index.js`), which still serves a module set without fights (`fights: false`), so it may stay. Until F1b, the People part starts from `index.js` through `startIsolated` (`core/boot/register-isolated.js`): a failure is a MODULE_START Problem and nothing else stops.

Removed at F2 (not kept): `full-cast.js` with its Diagnostics button, both settings slots and the `fullCastScanEveryTurn` setting (owner
decision D); the launcher keep settings (`launcherWithStoryBlock`, `launcherWithStoryBlockV2`), their flags and rows; the dead v1 Story Block
flag; the `NPCStateDelta` and `NPCStateDeltaCast` page globals and the hosted DOM flag (now `runtime/handles.js`).
