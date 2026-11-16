/* Character caps for bond text and how many ties a projected list keeps.
   Part of social-primitives.js; social-primitives.js re-exports it. */

export const SOCIAL_KEY_RELATIONSHIP_MAX_CHARS = 360;

export const SOCIAL_DYNAMIC_MAX_CHARS = 260;

// How many ties a projected list keeps: 5 as ever, 8 for a person who records ties' last mentions (an object `tieSeen`, core-keyrel.js), so the
// full-list rule of the merge (the new tie replaces the weakest) can act. The stored list comes first (it scores highest), so a mirrored edge never cuts it.
export const projectedTieLimit = owner => (owner?.tieSeen && typeof owner.tieSeen === 'object' && !Array.isArray(owner.tieSeen) ? 8 : 5);
