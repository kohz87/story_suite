// The world conditions' caps, their scopes and the pattern of a declared name. Pure.

/** At most this many conditions are active at once, and at most this many on one place, route, region or realm. */
export const MAX_CONDITIONS = 64;
export const MAX_PER_REF = 8;
/** What a condition can be about. */
export const SCOPES = Object.freeze(['place', 'route', 'region', 'realm']);
/** A declared name: lower-case words joined by "-" ("grain-dear"). */
export const CONDITION_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
