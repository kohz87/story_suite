/* NPC State Delta dossier look: putting the stored look on the drawn panel root as data-skin. */
import { ROOT_ID } from '../dossier-ui-constants.js';
import { normalizeDossierSkin } from './look.js';
import { readDossierSkin } from './store.js';

// Sets data-skin on the dossier root (or the element given). Returns the skin applied, or '' when no root is drawn.
export function applyDossierSkin(element = typeof document === 'undefined' ? null : document.getElementById(ROOT_ID), skin = readDossierSkin()) {
    if (!element || typeof element !== 'object' || !element.dataset) return '';
    const value = normalizeDossierSkin(skin);
    element.dataset.skin = value;
    return value;
}

// Re-applies the stored look to the drawn panel; it runs after every draw (the panel announces each one) and after a change.
export function syncDossierSkin() {
    return applyDossierSkin();
}
