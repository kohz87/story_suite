// Story Suite v2: deciding light or dark from SillyTavern's theme, and reading the reader's choices.

import { parseColor, luminance } from './colors.js';
import { PANEL_STYLES, FONTS } from './options.js';
import { DEFAULT_PANEL, DEFAULT_FONT } from './defaults.js';
import { clampStrength } from './glass.js';

/**
 * Light or dark, from SillyTavern's theme: 'dark' when the body text is lighter than the blur tint (light
 * text on a dark panel), 'light' when it is darker. A tint that is mostly see-through (alpha below 0.35)
 * says little about what is behind it, so then the text decides alone (light text: dark). With nothing
 * readable, 'dark' (SillyTavern's default theme is dark).
 */
export function decideScheme({ body = '', tint = '' } = {}) {
    const text = parseColor(body);
    const panel = parseColor(tint);
    if (text && panel && panel.a >= 0.35) return luminance(text) >= luminance(panel) ? 'dark' : 'light';
    if (text) return luminance(text) >= 0.4 ? 'dark' : 'light';
    if (panel) return luminance(panel) < 0.4 ? 'dark' : 'light';
    return 'dark';
}

/** The reader's choices as this file uses them (anything unknown → the default). */
export function themeChoice(settings = {}) {
    const panel = PANEL_STYLES.includes(settings?.panelStyle) ? settings.panelStyle : DEFAULT_PANEL;
    const font = FONTS.includes(settings?.font) ? settings.font : DEFAULT_FONT;
    return { panel, font, strength: clampStrength(settings?.glassStrength) };
}
