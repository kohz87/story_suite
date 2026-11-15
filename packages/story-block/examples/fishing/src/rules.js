// The fishing rules: what lives in each kind of water, how a catch is decided and how it is told.
// Pure. Every random choice takes `rng` (a () => float in [0, 1) such as a command's ctx.rng), and the
// draws happen in one fixed order (species, weight, quality, bite, window), so one seed always gives
// the same fish and the same timing.
// Public face: re-exports its parts.

export { WATERS, RARITIES, QUALITIES, SPECIES } from './rules-parts/tables.js';
export { waterOf, spotFromPlace, pickedSpotName } from './rules-parts/water.js';
export { pickWeighted, decideCatch, decideBite, inWindow } from './rules-parts/decide.js';
export { formatWeight, article, describeCatch, theCatch } from './rules-parts/tell.js';
export { catchNote, landedLine, lostLine, releasedLine } from './rules-parts/lines.js';
export { formatValue } from './rules-parts/value.js';
