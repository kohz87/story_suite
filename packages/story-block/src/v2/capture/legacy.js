// Story Suite v2: the v1 envelope (moved out of capture.js unchanged; capture.js re-exports the public names): finding, reading,
// adopting and stripping the block the first version of Story Block wrote. Imports capture/lines.js, blocks.js and echo.js.
// Public face: re-exports its parts.

export { LEGACY_PROBLEM, LEGACY_MARK, legacyRead } from './legacy-parts/marks.js';
export { hasLegacy, stripLegacy } from './legacy-parts/strip.js';
export { adoptLegacy } from './legacy-parts/adopt.js';
