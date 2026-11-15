/* Impact levels, default and legacy relationship caps and the event history limit. */

export const RELATIONSHIP_IMPACT_LEVELS = Object.freeze(['none', 'ordinary', 'meaningful', 'major', 'extreme']);
export const DEFAULT_RELATIONSHIP_CAPS = Object.freeze({
    ordinary: 1,
    meaningful: 2,
    major: 3,
    extreme: 6,
});
// The defaults before pacing (1.14): a saved set equal to this one is moved to the new defaults once (runtime-settings.js).
export const LEGACY_RELATIONSHIP_CAPS = Object.freeze({ ordinary: 1, meaningful: 2, major: 5, extreme: 10 });
export const RELATIONSHIP_EVENT_HISTORY_LIMIT = 6;
