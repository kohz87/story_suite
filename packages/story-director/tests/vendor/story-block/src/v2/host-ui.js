// Story Suite v2's two hosts for module UI (docs/v2/SPEC.md §6):
//
// - the settings host: one centred column of folds: the modules' own folds (Story Block's Packs), Features, one fold per module
//   with settings, Versions. Inside a module's fold: one line saying how many of its
//   features are on (it opens the Features fold there), its custom `section` right there (no sub-fold of
//   its own), then a sub-fold per settings group (a field's `group`, else its label's "Group: …" prefix,
//   else General). Versions is last. (Diagnostics, the report and what a module places there with `settings.place: 'diagnostics'`, is the
//   settings window's page now: view/settings/diagnostics-page.js.) Fields are rows (bool, int,
//   choice, text, list of {…}; a list one compact line per item, or, when its fields are text and whole
//   numbers, a textarea with one item per line: `form: 'lines'` starts there); values are read and
//   written through createSettings() (extension_settings.storySuite.modules[id]). Open folds stay open
//   across redraws. The settings window (view/settings/window.js, UI step 3a) shows it in sections: `renderSettingsHost`
//   with `sections` ({ ids, place(id), route(piece), defaultOpen(key), show(id), open(foldKey),
//   afterRefresh() }) draws each fold, and for Story Block's own fold each of its parts (Money, Assist), into the page of
//   the section it belongs to (view/settings/sections.js), and lists what a search can find (`entries()`). A section
//   with no pane (one the form engine draws: Look, Features, Money, Assist, Tabs & Packs) is not drawn here. The Story Suite
//   fold (the budgets, the prompt size, Tabs) is gone: the Tabs & Packs page draws them (view/settings/tabs-packs.js).
//   Features (MODULES §F100): the Features fold has a filter box and one sub-fold per module (by name,
//   "N of M on"), a switch per feature with its label and description; a feature that changes the
//   static prompt part says so (PROMPT_HINT). A settings field (`{ …, feature }`) or custom panel (a
//   function with `feature`) of a feature that is off is not drawn; a switch redraws. A feature whose
//   `needs` no installed module meets is drawn off and disabled, with its reason. The choices are the
//   reader's (createFeatureStore, extension_settings.storySuite.features), not the chat's.
// - the tab host: a tab bar with every module tab, each rendered from the head state's view.
//
// Every node is built with textContent; module names, labels and values are never markup.
// `doc` is the document to build in (tests pass a fake one).
// Public face: re-exports its parts.

export { featureInputId } from './host-ui-parts/feature-row.js';
export { renderSettingsHost } from './host-ui-parts/settings-host.js';
export { diagnosticsKeys } from './host-ui-parts/diagnostics-keys.js';
export { OPEN_CLASS, HOST_FOLD, FEATURES_FOLD, VERSIONS_FOLD, DIAGNOSTICS_FOLD, SENT_FOLD, TABS_FOLD, PACKS_FOLD, EVENTS_FOLD, SUB_FOLD, featuresFoldOf, SETTINGS_TEXT, TABS_TEXT, DIAGNOSTICS_TEXT, FEATURE_TEXT } from './host-ui/text.js';
export { emptyValue, readInt, listTextFields, listToLines, linesToList, fieldReadOnly, rowValue, groupFields } from './host-ui/controls.js';
export { promptSize, sentText, redactSentOf } from './host-ui/sent.js';
export { createTabHost } from './host-ui/tab-host.js';
