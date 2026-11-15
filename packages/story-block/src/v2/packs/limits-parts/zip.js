// Size limits of a pack zip.

import { PORTRAIT_LIMITS } from './portraits.js';

// A pack zip (Story Studio's export: pack.json and a portraits/ folder, zip.js and bundle.js): the archive itself, everything in it
// unpacked, one file in it, and the entries (folders count) it may hold. The archive and the unpacked total fit a full pack of
// portraits at their largest (every portrait at `source`) and a little more. `ratio` is the most a deflated file may grow when
// unpacked (checked for files over 256 KB), so a zip that squeezes a huge file into a few bytes is refused before it is unpacked.
export const ZIP_LIMITS = Object.freeze({
    archive: PORTRAIT_LIMITS.perPack * PORTRAIT_LIMITS.source + 2 * 1024 * 1024,
    unpacked: PORTRAIT_LIMITS.perPack * PORTRAIT_LIMITS.source + 2 * 1024 * 1024,
    entry: PORTRAIT_LIMITS.source,
    entries: 40,
    ratio: 100,
});
