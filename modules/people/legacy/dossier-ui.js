/* LEGACY, kept until B4 replaces the old dossier surface: the dossier panel the open-dossier request opens; see docs/merge/b4-removals.md. */
/* NPC State Delta dossier surface: import-compatible facade over the split dossier UI modules. Public face: re-exports its parts. */
export { DeltaDossierUi } from './dossier-ui-parts/controller.js';
export { castFromHtml, castProjection, keyAwayHtml, keyProjection } from './dossier-ui-parts/catalog-cast.js';
export { chooseDossierSelection, filterDossierIndex, projectDossierState, sortDossierIndex } from './dossier-ui-parts/catalog-select.js';
export { appearanceFormsHtml, changeSummaryHtml, createPortraitRefs } from './dossier-ui-parts/html.js';
export { v2MetersHtml, v2MetersProjection, v2SecretsHtml } from './dossier-ui-parts/meters.js';
export { changeStamp, dossierDetailProjection, dossierIndexProjection, dossierLifeBucket } from './dossier-ui-parts/model-projection.js';
export { dossierStatusLabel, replyHeaderLabel } from './dossier-ui-parts/model-labels.js';
export { lastRelationshipChangeHtml, relationshipStepHtml } from './dossier-ui-parts/relationship.js';
export { mountNpcStateDeltaDossierUi } from './dossier-ui-parts/browser-start.js';
