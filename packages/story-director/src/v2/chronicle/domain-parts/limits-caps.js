// Chronicle's caps on how many events and factions are kept.

/** Caps: events kept, resolved events kept (oldest pruned first), factions kept. */
export const MAX_EVENTS = 60;
export const MAX_RESOLVED = 30;
export const MAX_FACTIONS = 40;
/** Open entries `keep: true` holds in every reply's tail at most (the most recently updated). */
export const MAX_KEPT = 2;
