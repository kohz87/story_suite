// Story Suite v2: how much of SillyTavern's blur tint goes into the glass colour.

// How much of SillyTavern's blur tint goes into the glass's COLOUR (the rest is the concept's own base). Only
// the tint's colour is used: the glass keeps its own alpha (Glass strength), whatever the tint's opacity is.
export const TINT_SHARE = 30;
export const TINT = 'var(--SmartThemeBlurTintColor, rgba(23, 23, 23, 1))';
export const mixTint = base => `color-mix(in srgb, ${TINT} ${TINT_SHARE}%, ${base})`;
