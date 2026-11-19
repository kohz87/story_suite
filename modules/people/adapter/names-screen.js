// Dossiers as a game-view screen: the screen id, its one widget, its place for an older host, and the World feature that draws the present cast instead.

/**
 * Dossiers as a game-view screen (Story Block's full-screen view lists screens, not module tabs): mount
 * `screen` only, so the Story panel keeps its one Dossiers tab. Its template is one widget,
 * CAST_WIDGET, that draws exactly what the tab draws (the dossier list, and the present cast's cards and
 * meters above it while Story Director's World does not show them).
 */
export const CAST_SCREEN_ID = 'npc-state-delta/cast';

export const CAST_WIDGET = 'npc-state-delta.cast';

// Story Block places the suite's own screens itself (view/screens.js SUITE_NAV: Dossiers last); an older
// host reads this number.
export const CAST_SCREEN_ORDER = 35;

/** Story Director's World view: while it is on, the present cast's cards are drawn there, not in Dossiers. */
export const WORLD_FEATURE = 'story-director.world';
