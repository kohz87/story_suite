// The persona picture's cache stamp: SillyTavern keeps a persona's file name when its picture is replaced, so the suite's
// "/User Avatars/<file>" address would show the browser's cached picture. A persona event bumps the stamp and the address carries it.

let stamp = 0;

/** The current stamp (0 until a persona picture changed in this page). */
export const personaStamp = () => stamp;

/** Called on SillyTavern's persona events: the next drawn persona picture is fetched again. */
export function bumpPersonaStamp(now = Date.now()) {
  stamp = Math.max(stamp + 1, Math.floor(Number(now) || 0));
  return stamp;
}
