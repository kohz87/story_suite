// Static type and interval analysis; no evaluation, queries, state or code execution.
// Public face: re-exports its parts.
export { fieldType, compatible } from './expressions-parts/types.js';
export { pathType } from './expressions-parts/path.js';
export { expressionType, conditionType } from './expressions-parts/infer.js';
