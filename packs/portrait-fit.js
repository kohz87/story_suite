// Makes a large portrait small enough to keep: a WebP, PNG or JPEG of up to PORTRAIT_LIMITS.source bytes is decoded in the browser,
// drawn with its long side at most PORTRAIT_LIMITS.side px and saved as WebP, trying less quality and then fewer pixels until it is
// at most PORTRAIT_LIMITS.bytes (the stored limit: NPC State Delta keeps a copy per chat). The same steps as Story Studio's portrait
// shrink (qualities 85, 70, 55, 40, 30 per cent; then 85 per cent of the side, down to 96 px), so a picture comes out alike from
// either. Where WebP cannot be saved (some browsers draw it as PNG), JPEG is saved instead.
//
// `fitPortrait(io, options)` is pure; `io` is `{ size() → { width, height }, encode(side, quality) → { bytes, type, width, height },
// close?() }` for one picture (the encoder portraits.js is given: a fake one in the Node tests, `browserImageIo` in the page).
// `browserImageIo(win)` → `bytes → io`: `createImageBitmap` and a canvas. It tells in plain words when the browser cannot read the
// Public face: re-exports its parts.

export { MAX_PIXELS, imageSize } from './portrait-fit-parts/image-size.js';
export { FitProblem, fitPortrait } from './portrait-fit-parts/fit.js';
export { browserImageIo } from './portrait-fit-parts/browser-io.js';
