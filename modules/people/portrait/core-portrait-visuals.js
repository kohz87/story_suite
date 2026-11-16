/* NPC State Delta portrait visual analysis: appearance typing, hair/eye/body tags, direct visual
   anchors and contradiction negatives used by the portrait prompt builder. Split unchanged from
   core-portrait.js; these helpers are module-internal rather than public core exports.
   Public face: re-exports its parts. */
export { extractPortraitVisualAnchorTags, portraitTagFallbackParts } from './core-portrait-visuals-parts/anchors.js';
export { portraitPartKey, uniquePortraitParts } from './core-portrait-visuals-parts/shared-parts.js';
export { normalizePortraitAppearanceClause, splitPortraitAppearance } from './core-portrait-visuals-parts/appearance.js';
export { derivePortraitContradictionNegatives } from './core-portrait-visuals-parts/contradictions.js';
