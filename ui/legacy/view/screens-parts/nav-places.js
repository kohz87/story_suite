// The default navigation places: Home's id, the default order, what is hidden by default and the place of a screen with none.

/** The game view's landing page: always the first screen and the first tab. */
export const HOME_ID = 'story-block/home';
// The default places, by the last part of an id ('example-module/party' → party): the party and what it
// carries, what it is doing and where, the activities, the scene, the record, the Director (the game
// master's view, with what the reader has not been told) and, last, NPC State Delta's Dossiers (its old
// Cast id, `npc-state-delta/cast`: the people present are on the World screen now, so the dossier
// browser goes to the end; a reader's saved order keeps its own place for it, tab-order.js).
export const DEFAULT_ORDER = Object.freeze({
    party: 10, inventory: 20, quests: 30, world: 40, map: 50, fight: 60, crafting: 70, trade: 80,
    scene: 100, chronicle: 110, director: 200, cast: 210,
});
// Screens hidden by default while another screen is registered, the one that shows the same and more
// (MODULES §F119): Story Block's Scene (place, kind, region, story time, the people with portraits) while
// that screen is there, whose own page has all of it. The reader shows it again in Settings →
// Tabs & Packs → Tabs; their saved choice wins (view/tab-order.js). Home's scene panel is not a screen here.
export const DEFAULT_HIDDEN = Object.freeze({ 'story-block/scene': 'story-director/world' });

// A screen with no `order` and no default place: after the suite's own, before the Director.
export const REST_ORDER = 150;
