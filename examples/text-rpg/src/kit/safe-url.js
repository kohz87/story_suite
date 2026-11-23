// Adapted from ui/kit/safe-url.js (keep in step when that file changes). Tells whether a portrait value is a path or data-image URL that is safe to put inside a CSS url("...").

const NO_BREAKOUT = /^[^"'()\\\s]+$/;

/** True for a string with no quote, bracket, backslash or space that looks like a path or a data:image URL. */
export function isSafePortraitUrl(src) {
  return typeof src === 'string' && NO_BREAKOUT.test(src) && (src.includes('/') || src.startsWith('data:image'));
}
