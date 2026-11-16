// Shared validation for neutral thread metadata and acceptance proofs.
// Public face: re-exports its parts.

export { recordId, map, count, minute } from './thread-shape-parts/scalars.js';
export { text, closed, hash } from './thread-shape-parts/forms.js';
export { source, cursor } from './thread-shape-parts/refs.js';
