/* NPC State Delta dossier look: the three named skins, the default and the normalizer that turns any value into one of them. */

export const DOSSIER_SKIN_DEFAULT = 'neutral';
export const DOSSIER_SKINS = Object.freeze([
    Object.freeze({ key: 'neutral', label: 'Neutral', hint: 'Fine-line dial, muted ink, warm charcoal. The default.' }),
    Object.freeze({ key: 'fantasy', label: 'Fantasy', hint: 'Gilt edges, a bevelled dial and parchment-brown tiles.' }),
    Object.freeze({ key: 'modern', label: 'Modern', hint: 'Dark, flat tiles with bright meter colours and a soft glow.' }),
]);
const SKIN_KEYS = DOSSIER_SKINS.map(skin => skin.key);

// Any stored or typed value becomes one of the three looks; anything else is Neutral.
export function normalizeDossierSkin(value) {
    const key = String(value ?? '').trim().toLowerCase();
    return SKIN_KEYS.includes(key) ? key : DOSSIER_SKIN_DEFAULT;
}
