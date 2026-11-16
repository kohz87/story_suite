// The Modules section's body (UI stage, step 3f): one card per installed module on the form engine's look, in place of the module folds
// and the Versions fold. A card is
//
// * the module's name and version, a short line on what it does (its `description`), and the line to its features
//   ("Features: 2 of 3 on — change", which goes to that module's group on the Features page);
// * its custom settings panels (`settings.section` / `render`) and its own folds (`settings.folds`), embedded as they were drawn in
//   the old fold: a module's own code draws them;
// * its settings drawn by the form engine from the registry's schema, a settings group each: sub-sections of the card, or, in a module
//   with many settings and more than one group, folds, the first one open (`FOLD_ABOVE`). The settings Story Block's own pages
//   draw (its General group: Money; its Assist group and panel: Assist; its Packs fold: Tabs & Packs) are not here.
//
// Versions is a small card at the end: Story Block and each module, with what is out of step (compat.js).
//
// Fold keys keep working: `<module id>` (the card, its heading focused), `<module id>::group:<name>` (that group, opened),
// `<module id>/<fold id>` (an own fold of the module) and the Versions fold.
//
// Built with createElement and textContent only: module names, versions and descriptions come from other extensions.
// Public face: re-exports its parts.

export { FOLD_ABOVE, MODULES_TEXT, KNOWN_DESCRIPTIONS } from './modules-parts/text.js';
export { moduleSchema } from './modules-parts/schema.js';
export { createModuleCard } from './modules-parts/card.js';
export { modulesBody } from './modules-parts/body.js';
