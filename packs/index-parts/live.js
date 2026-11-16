// Binds the Packs part to SillyTavern as Story Block loads it, and exports the part, packs and portraits.

import { browserImageIo } from '../portrait-fit.js';
import { HOST_VERSION } from '../validate/core.js';
import { readCharacterLorebook, stCapabilities, stHostVersion, stPortraitFiles, stSettings } from '../st-adapter.js';
import { createPacksPart } from './build.js';

// The part as Story Block loads it: bound to SillyTavern through st-adapter.js, read lazily.
export const live = createPacksPart({
    settings: stSettings(),
    readLorebook: readCharacterLorebook,
    capabilities: stCapabilities,
    hostVersion: () => stHostVersion() ?? HOST_VERSION,
    portraitFiles: stPortraitFiles(),
    // The browser's own decoder and encoder, where there is one (not in Node, where a large portrait is refused as it always was).
    portraitIo: typeof globalThis.createImageBitmap === 'function' ? browserImageIo(globalThis) : null,
});

export const part = live.part;
export const packs = live.packs;
export const portraits = live.portraits;
