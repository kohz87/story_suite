// The sections of the settings window (UI stage, step 3a): their order, names, icons, the words on each page, and
// where each piece of today's settings goes. The window (window.js) draws one page per section; what a page holds
// is a *body* (bodies.js), so a section can move to the form engine (view/form/) one at a time without touching
// the frame.
//
// The order is the approved concept's, with Look first (step 3b): Look, Features, Money, Assist, Tabs & Packs, Blocks, Modules,
// Diagnostics. Look and Features are drawn by the form engine (bodies.js). The other sections still hold today's
// settings (host-ui.js `renderSettingsHost`, one column of folds); `routeOf` sends each fold, and for Story Block's
// own fold each of its parts, to the section it belongs to. Fold ids do not change (`openSettings({ fold })` finds
// the section the fold is in), so Home's "Import a pack" (PACKS_FOLD) still lands on its fold.
//
// Public face: re-exports its parts.

export { SETTINGS_SECTIONS, SECTION_IDS, DEFAULT_SECTION, sectionById } from './sections-parts/list.js';
export { LOOK_KEYS, WINDOW_TEXT } from './sections-parts/text.js';
export { routeOf, opensByDefault } from './sections-parts/routing.js';
