// Story Director v2, part **arc**: its settings (module.js namespaces them as `arc.<key>`) and the
// planner prompt's editor with Reset (the settings panel's `section`). Every field is the arc feature's
// (MODULES §F100): with Arc planning off they leave the overlay, and their values are kept.
// Public face: re-exports its parts.

export { DEFAULTS, PROMPT_MAX, SCHEMA } from './settings-parts/schema.js';
export { arcSettings } from './settings-parts/read.js';
export { promptSection } from './settings-parts/prompt-section.js';
