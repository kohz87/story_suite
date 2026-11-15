/* Appearance text and form primitives: bounded cleaning, clause splitting, shared-prefix combination,
   form keys/state and the public form/version limits. A pure part of appearance.js (same owner, moved
   without change); appearance.js keeps the public facade and re-exports every public name. Never imports appearance.js.
   Public face: re-exports its parts. */
export { clean, truthy, appearanceText, hasOwn } from './appearance-text-parts/basics.js';
export { APPEARANCE_FORM_LIMIT, APPEARANCE_MODEL_VERSION, formKey, formState } from './appearance-text-parts/forms.js';
export { sameAppearance, appearanceClauses } from './appearance-text-parts/clauses.js';
export { regexEscape, stripOverallPrefix, combineAppearance } from './appearance-text-parts/combine.js';
