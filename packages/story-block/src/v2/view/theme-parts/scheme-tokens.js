// Story Suite v2: the colour tokens for one scheme and panel style.

import { PALETTES, ACCENT } from './palettes.js';
import { glassAlphas } from './glass.js';
import { TINT, TINT_SHARE, mixTint } from './tint.js';
import { SHEET_TOKENS } from './sheet-tokens.js';
import { DEFAULT_GLASS } from './defaults.js';

/**
 * The colour tokens for one scheme and panel style: [[name, value]] in a fixed order. `opaque` (Solid,
 * where relative colours work) makes the glass fully opaque; without them Solid's glass is the opaque
 * base with a share of the tint, which is opaque whenever the tint is.
 */
export function schemeTokens(scheme, panel, { opaque = false, strength = DEFAULT_GLASS, tinted = false } = {}) {
    if (panel === 'sillytavern') {
        // SillyTavern's own colours and blur, light or dark as the theme is.
        return [
            ['--ss-glass', 'var(--SmartThemeBlurTintColor, rgba(23, 23, 23, 1))'],
            ['--ss-glass-strong', 'var(--SmartThemeBlurTintColor, rgba(23, 23, 23, 1))'],
            ['--ss-panel-opaque', (PALETTES[scheme] ?? PALETTES.dark).solid],
            ['--ss-panel-text', (PALETTES[scheme] ?? PALETTES.dark).text],
            ['--ss-tile', 'color-mix(in srgb, var(--SmartThemeBodyColor, #dcdcd2) 8%, transparent)'],
            ['--ss-border', 'var(--SmartThemeBorderColor, rgba(0, 0, 0, 0.5))'],
            // the current tab's edge (UI 5b): SillyTavern's text colour, since its quote colour can be faint on a light track
            ['--ss-tab-edge', 'var(--SmartThemeBodyColor, #dcdcd2)'],
            // the section-label hairline: SillyTavern's text colour at 40% over its tint, so it reads against the card (>= 1.5:1)
            ['--ss-rule', 'color-mix(in srgb, var(--SmartThemeBodyColor, #dcdcd2) 40%, var(--SmartThemeBlurTintColor, rgba(23, 23, 23, 1)))'],
            ['--ss-shadow', '0 2px 8px var(--SmartThemeShadowColor, rgba(0, 0, 0, 0.5))'],
            ['--ss-text', 'var(--SmartThemeBodyColor, #dcdcd2)'],
            ['--ss-muted', 'var(--SmartThemeEmColor, #919191)'],
            ['--ss-track', 'color-mix(in srgb, var(--SmartThemeBodyColor, #dcdcd2) 14%, transparent)'],
            ['--ss-pill', 'color-mix(in srgb, var(--SmartThemeBodyColor, #dcdcd2) 14%, transparent)'],
            ['--ss-pill-text', 'var(--SmartThemeBodyColor, #dcdcd2)'],
            ['--ss-badge', 'var(--SmartThemeBodyColor, #dcdcd2)'],
            ['--ss-badge-text', 'var(--SmartThemeBlurTintColor, rgba(23, 23, 23, 1))'],
            ['--ss-field', 'color-mix(in srgb, var(--SmartThemeBodyColor, #dcdcd2) 8%, var(--SmartThemeBlurTintColor, #171717))'],
            ['--ss-overlay', 'var(--SmartThemeBlurTintColor, rgba(23, 23, 23, 1))'],
            ['--ss-scrim', 'rgba(0, 0, 0, 0.55)'],
            ['--ss-off', 'color-mix(in srgb, var(--SmartThemeBodyColor, #dcdcd2) 22%, transparent)'],
            ['--ss-accent', 'var(--SmartThemeQuoteColor, #e18a24)'],
            ['--ss-accent-soft', 'color-mix(in srgb, var(--SmartThemeQuoteColor, #e18a24) 20%, transparent)'],
            // the accent as text, following SillyTavern's own colours: its quote colour mixed with its text colour (40:60), so it reads
            // on a light theme too (the quote colour alone is ~2:1 there); on a dark theme it stays light
            ['--ss-accent-text', 'color-mix(in srgb, var(--SmartThemeQuoteColor, #e18a24) 40%, var(--SmartThemeBodyColor, #dcdcd2))'],
            // warning and error text: the scheme's fixed text tones (the theme's own colours are not known to be readable)
            ['--ss-bad-text', PALETTES[scheme]?.badText ?? PALETTES.dark.badText],
            ['--ss-warn-text', PALETTES[scheme]?.warnText ?? PALETTES.dark.warnText],
            ['--ss-help', PALETTES[scheme]?.help ?? PALETTES.dark.help],
            ['--ss-good', '#4caf6e'],
            // the other tones (module borders, tints and tags use them): the scheme's fixed tones, each >= 4.5:1 as text on that scheme's
            // surface; without them a `var(--ss-bad)` here would be invalid and the ring or tint would vanish
            ['--ss-bad', PALETTES[scheme]?.bad ?? PALETTES.dark.bad],
            ['--ss-warn', PALETTES[scheme]?.warn ?? PALETTES.dark.warn],
            ['--ss-info', PALETTES[scheme]?.info ?? PALETTES.dark.info],
            ['--ss-chatter', 'var(--SmartThemeEmColor, #919191)'],
            ['--ss-blur', 'blur(var(--SmartThemeBlurStrength, 0px))'],
        ];
    }
    const p = PALETTES[scheme] ?? PALETTES.dark;
    const solid = panel === 'solid';
    const opaqueOf = color => (opaque ? `rgb(from ${color} r g b / 1)` : color);
    const alpha = glassAlphas(scheme, strength);
    const [r, g, b] = p.base;
    // Glass: the concept's colour at the reader's alpha. With `tinted` (where relative colours work) SillyTavern's
    // tint colour is mixed in, its own alpha dropped: the alpha is always the Glass strength's.
    const tintColour = `rgb(from ${TINT} r g b / 1)`;
    const glassOf = a => (tinted ? `rgb(from color-mix(in srgb, ${tintColour} ${TINT_SHARE}%, rgb(${r} ${g} ${b})) r g b / ${a})` : `rgba(${r}, ${g}, ${b}, ${a})`);
    return [
        ['--ss-glass', solid ? opaqueOf(mixTint(p.solid)) : glassOf(alpha.glass)],
        ['--ss-glass-strong', solid ? opaqueOf(mixTint(p.solid)) : glassOf(alpha.strong)],
        ['--ss-panel-opaque', p.solid],
        ['--ss-panel-text', p.text],
        ['--ss-tile', p.tile],
        ['--ss-border', p.border],
        ['--ss-rule', p.rule],
        ['--ss-shadow', p.shadow],
        ['--ss-text', p.text],
        ['--ss-muted', p.muted],
        ['--ss-track', p.track],
        ['--ss-pill', p.pill],
        ['--ss-pill-text', p.pillText],
        ['--ss-badge', p.badge],
        ['--ss-badge-text', p.badgeText],
        ['--ss-field', p.field],
        ['--ss-overlay', solid ? opaqueOf(p.overlay) : p.overlay],
        ['--ss-scrim', p.scrim],
        ['--ss-off', p.off],
        ['--ss-accent', ACCENT],
        ['--ss-accent-text', p.accentText],
        ['--ss-bad-text', p.badText],
        ['--ss-warn-text', p.warnText],
        ['--ss-help', p.help],
        ['--ss-tab-edge', 'var(--ss-accent)'],
        ['--ss-accent-soft', p.accentSoft],
        ['--ss-good', p.good],
        // The tones as text and rings on the glass: each scheme's own, every one >= 4.5:1 for text on its solid surface.
        ['--ss-bad', p.bad],
        ['--ss-warn', p.warn],
        ['--ss-info', p.info],
        ['--ss-chatter', p.chatter],
        ['--ss-blur', solid ? 'none' : 'blur(16px) saturate(1.2)'],
        // The legacy surfaces (`.story-suite-sheet`, `.ss-gameview`: host.css, mounts-*.css) paint these when they are set,
        // which they are for Glass only: the page shows through them. Solid and Follow SillyTavern leave them unset, so
        // those surfaces keep SillyTavern's tint exactly as before.
        ...(solid ? [] : SHEET_TOKENS),
    ];
}
