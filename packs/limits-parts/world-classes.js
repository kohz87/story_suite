// The world pack: engine classes, standing range and size limits.

export const PLACE_CLASSES = Object.freeze(['capital', 'city', 'town', 'village', 'outpost', 'site', 'none']);
export const ROUTE_CLASSES = Object.freeze(['relay-road', 'road', 'trail', 'river', 'sea', 'pass', 'none']);
export const STANDING = Object.freeze({ min: -100, max: 100 });
export const WORLD_LIMITS = Object.freeze({ events: 200, templates: 100, powers: 40, scores: 40, realms: 40, regions: 100, lore: 400, kinds: 60, name: 80, entries: 200, outcomes: 8 });
