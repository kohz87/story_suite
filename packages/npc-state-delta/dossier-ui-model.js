/* NPC State Delta dossier surface: dossier record lookups and presentation projections. Public face: re-exports its parts. */
export { plain, stringList, relationshipValue, wholeNumber } from './dossier-ui-model-parts/values.js';
export { changeStamp, replyHeaderLabel, stampHtml } from './dossier-ui-model-parts/change-stamps.js';
export { RELATIONSHIP_AXES, FIELD_CHANGE_LABELS } from './dossier-ui-model-parts/change-projections.js';
export { dossierLifeBucket, dossierStatusLabel, dossierIndexProjection } from './dossier-ui-model-parts/index-projection.js';
export { dossierDetailProjection } from './dossier-ui-model-parts/detail-projection.js';
