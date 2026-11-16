// The sections of the settings window: their order, names, icons and page headings, with the default page and a lookup by id.

/** The sections, in the order of the rail. `title` and `sub` head the page; `icon` is a Font Awesome class. */
export const SETTINGS_SECTIONS = Object.freeze([
    Object.freeze({ id: 'look', label: 'Look', icon: 'fa-palette', title: 'Look', sub: 'How Story Suite\'s panels and text look.' }),
    Object.freeze({ id: 'features', label: 'Features', icon: 'fa-toggle-on', title: 'Features', sub: 'Switch parts of the game on or off.' }),
    Object.freeze({ id: 'money', label: 'Money', icon: 'fa-coins', title: 'Money', sub: 'Your world\'s coins and money words.' }),
    Object.freeze({ id: 'assist', label: 'Assist', icon: 'fa-wand-magic-sparkles', title: 'Assist', sub: 'Optional cheap model calls that help a fast narrator.' }),
    Object.freeze({ id: 'tabs', label: 'Tabs & Packs', icon: 'fa-table-columns', title: 'Tabs & Packs', sub: 'The look of the panels, which tabs show and in what order, and your content packs.' }),
    Object.freeze({ id: 'blocks', label: 'Blocks', icon: 'fa-table-columns', title: 'Blocks', sub: 'Trackers for this story: make one, change it, and choose where it shows.' }),
    Object.freeze({ id: 'modules', label: 'Modules', icon: 'fa-puzzle-piece', title: 'Modules', sub: 'The settings of each installed module, and which versions are installed.' }),
    Object.freeze({ id: 'diagnostics', label: 'Diagnostics', icon: 'fa-stethoscope', title: 'Diagnostics', sub: 'A report to share when something goes wrong, and what packs and modules say about themselves.' }),
]);
export const SECTION_IDS = Object.freeze(SETTINGS_SECTIONS.map(section => section.id));
// The page the window opens on: Features, the one most readers come for, though Look is first in the rail.
export const DEFAULT_SECTION = 'features';
/** A section by id (the default one for an id that is none). */
export const sectionById = id => SETTINGS_SECTIONS.find(section => section.id === id) ?? SETTINGS_SECTIONS[0];
