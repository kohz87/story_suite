// The card offer (no DOM): what the open character card brings, asked once when a chat opens and answered with one click.
//
// A card may carry a pack (`[storysuite:pack]`), its portraits (`[storysuite:portraits]`) and recommended settings
// (`[storysuite:settings]`) in disabled lorebook entries (lorebook.js, card.js). When a chat with a single character opens, the
// controller reads those entries with the existing reader, checks them with the same checker an import uses, and keeps one offer per
// pack that is new or newer than the installed one (at most three). Nothing is installed without the player's click.
//
// Install is the existing install (installed.js) with the portraits handed in as zip-import files; then the pack's data modules are
// turned on in THIS chat at once (an update keeps the chat's own choice), then the ticked settings are applied through the owners
// that registered them (card-settings.js); the notice that follows says only what was done. "Not now" is remembered per card, pack id
// and version in Story Block's settings. A refused pack, a skipped picture or key, and each "Not now" write one line for Diagnostics.
// Public face: re-exports its parts.

export { MAX_OFFERS, CAPABILITY_NEEDS, createCardOffer } from './card-offer-parts/controller.js';
export { bringsLine, settingsDone } from './card-offer-parts/summary.js';
export { enableDataModules } from './card-offer-parts/data-modules.js';
