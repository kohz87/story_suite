/* NPC State's stored "Dossier style" setting (dossierSkin): the default and the normalizer every settings read goes through.
   The old dossier panel that drew the three looks is gone (B4-5); the key and its default stay so stored settings read the same. */

export const DOSSIER_SKIN_DEFAULT = 'neutral';
const SKIN_KEYS = Object.freeze(['neutral', 'fantasy', 'modern']);

// Any stored or typed value becomes one of the three looks; anything else is Neutral.
export function normalizeDossierSkin(value) {
    const key = String(value ?? '').trim().toLowerCase();
    return SKIN_KEYS.includes(key) ? key : DOSSIER_SKIN_DEFAULT;
}
