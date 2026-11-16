// The job: shrinking one picture (through an encoder `io`) until it fits the portrait limits, and the problem it throws when it cannot.

import { PORTRAIT_LIMITS } from '../limits.js';

const QUALITIES = Object.freeze([0.85, 0.7, 0.55, 0.4, 0.3]);
const SMALLEST_SIDE = 96;

const kb = bytes => Math.max(1, Math.round(bytes / 1024));

/** A problem with one picture, worded to follow the file's name: "<file> cannot be made small enough …". */
export class FitProblem extends Error {}

/**
 * Fits the picture `io` holds into the portrait limits. → `{ bytes, type: 'webp' | 'jpg', width, height }`, or throws a FitProblem whose
 * message is plain words without the file's name (the caller names the file): the picture cannot be read, or cannot be made small enough.
 */
export async function fitPortrait(io, { maxBytes = PORTRAIT_LIMITS.bytes, maxSide = PORTRAIT_LIMITS.side } = {}) {
    const { width, height } = await io.size();
    if (!(width > 0 && height > 0)) throw new FitProblem('could not be read as a picture');
    let side = Math.min(maxSide, Math.max(width, height));
    for (;;) {
        for (const quality of QUALITIES) {
            const out = await io.encode(side, quality);
            if (out?.bytes?.length && out.bytes.length <= maxBytes) return out;
        }
        side = Math.floor(side * 0.85);
        if (side < SMALLEST_SIDE) throw new FitProblem(`cannot be made small enough: a portrait may be at most ${kb(maxBytes)} KB`);
    }
}
