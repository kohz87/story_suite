/* NPC State Delta dossier look: the "Dossier style" setting (Neutral, Fantasy, Modern). It only names the look:
   the dossier panel root carries data-skin, and the skin CSS (dossier-ui-styles-board.js) layers its tokens on
   --delta-* / --ss-* under [data-skin]. No fonts are loaded here and no dossier data is read or written. Public face: re-exports its parts. */
export { DOSSIER_SKIN_DEFAULT, DOSSIER_SKINS, normalizeDossierSkin } from './dossier-skin-parts/look.js';
export { readDossierSkin, writeDossierSkin } from './dossier-skin-parts/store.js';
export { applyDossierSkin, syncDossierSkin } from './dossier-skin-parts/apply.js';
export { mountDossierSkinSettings } from './dossier-skin-parts/settings.js';
