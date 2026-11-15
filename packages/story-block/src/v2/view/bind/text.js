// Binding text: value-to-text, {{ }} interpolation, `name: expr` pair lists and loop-name checks.
// Public face: re-exports its parts.

export { interpolate, parseInterpolation, toText } from './text-parts/interpolation.js';
export { splitPairs } from './text-parts/pairs.js';
export { isLoopName } from './text-parts/names.js';
