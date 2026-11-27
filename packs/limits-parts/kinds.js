// Pack format 4: the two kinds of pack, the fields a pack may have, and which `content` keys belong to which kind.

export const PACK_KINDS = Object.freeze(['world', 'game']);
// Top-level fields of a format 4 pack.json (the same for both kinds). `currency`, `economy`, `calendar`, `weather` and `start` live under `content`.
export const PACK_FIELDS_V4 = Object.freeze(['id', 'format', 'kind', 'version', 'name', 'author', 'description', 'requires', 'recommends', 'placeIds', 'content']);
// The `content` keys each kind may hold. A key in neither list is unknown; a key in the other kind's list gets a pointer.
export const CONTENT_KEYS = Object.freeze({
    world: Object.freeze(['lore', 'placeKinds', 'routeKinds', 'places', 'routes', 'regions', 'realms', 'markets', 'cast', 'powers', 'scores', 'conditions', 'worldEvents', 'templates', 'start', 'foes', 'items']),
    game: Object.freeze(['calendar', 'currency', 'economy', 'weather', 'names', 'you', 'rpg', 'dataModules', 'meterPresets', 'start', 'pacing']),
});
// Format 3 top-level fields that moved or went, with where they are now: the text finishes "… <field> <pointer>".
export const MOVED_TOP_FIELDS = Object.freeze({
    currency: 'belongs in a game pack, under content.', economy: 'belongs in a game pack, under content.', calendar: 'belongs in a game pack, under content.', weather: 'belongs in a game pack, under content.',
    start: 'goes under content (world start state in a world pack, the player\'s start in a game pack).',
    ripples: 'is not a pack field any more.', layouts: 'is not a pack field any more.', screens: 'is not a pack field any more.', theme: 'is not a pack field any more.',
});
