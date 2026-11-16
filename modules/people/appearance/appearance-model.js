/* Appearance forms and resolution: named-form parsing, legacy-form conversion, the canonical model,
   complete-form/current-presentation resolution and the shared-feature bridge. A pure part of
   appearance.js (same owner, moved without change); appearance.js keeps the public facade and
   re-exports every public name. Never imports appearance.js.
   Public face: re-exports its parts. */
export { normalizeAppearanceForms, formatAppearanceForms, parseAppearanceFormsText, appearanceFormByName } from './appearance-model-parts/forms.js';
export { normalizeAppearanceModel } from './appearance-model-parts/canonical.js';
export { completeFormWithShared } from './appearance-model-parts/bridge.js';
export { resolveNpcAppearance, currentPresentationText } from './appearance-model-parts/resolve.js';
