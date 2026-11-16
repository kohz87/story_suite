/* NPC State Delta injection block rendering: truncation, fair field sharing, identity/agency/state
   blocks, optional continuity and mentioned/deceased references. Split unchanged from
   core-injection.js; these helpers are module-internal rather than public core exports.
   Public face: re-exports its parts. */
export { truncateInjectionText, clauseBoundedInjection } from './core-injection-parts-parts/truncate.js';
export { lowPlayerStanding, injectionEssentialBlock } from './core-injection-parts-parts/essential-block.js';
export { injectionOptionalFields } from './core-injection-parts-parts/optional-fields.js';
export { compactInjectionBehaviorRubric } from './core-injection-parts-parts/behavior-rubric.js';
export { referenceBlock } from './core-injection-parts-parts/reference-block.js';
