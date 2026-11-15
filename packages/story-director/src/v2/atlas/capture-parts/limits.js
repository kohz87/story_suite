// Per-reply and total capacity limits for atlas places and routes.

/** New places, and new routes, one reply's lines may add; a line that would add more is not used (B-b1r2-7). */
export const NEW_PER_REPLY = 16;
/** Places and routes the atlas keeps; past these a line that would add one is not used. */
export const MAX_PLACES = 400;
export const MAX_ROUTES = 800;
