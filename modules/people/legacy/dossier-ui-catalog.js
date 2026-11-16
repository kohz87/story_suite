/* NPC State Delta dossier surface: index filtering, cast/key projections and dossier-state shaping. Public face: re-exports its parts. */
export { sortDossierIndex, filterDossierIndex, chooseDossierSelection } from './dossier-ui-catalog-parts/index-order.js';
export { keyProjection, keyAwayHtml } from './dossier-ui-catalog-parts/key-projection.js';
export { castProjection, castFromHtml } from './dossier-ui-catalog-parts/cast-projection.js';
export { projectDossierState } from './dossier-ui-catalog-parts/state-projection.js';
