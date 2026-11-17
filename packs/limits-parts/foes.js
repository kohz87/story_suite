// The foe bestiary (`content.foes`): field names, the tiers (the six of Combat Rules v1, pinned by a test) and limits.

export const FOE_FIELDS = Object.freeze(['name', 'slug', 'aliases', 'tier', 'level', 'about', 'tags']);
export const FOE_TIERS = Object.freeze(['mob', 'minion', 'standard', 'elite', 'boss', 'apex']);
export const FOE_LIMITS = Object.freeze({ level: Object.freeze({ min: 1, max: 99 }), about: 240, aliases: 8, tags: 8 });
