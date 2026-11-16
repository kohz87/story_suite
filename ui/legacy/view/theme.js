// Story Suite's one look (the UI stage): glass panels over SillyTavern's background, one set of design
// tokens for every Story Suite root, light or dark, in the soft font Nunito. This file is the theme bridge:
//
// * the tokens: `--ss-glass`, `--ss-glass-strong`, `--ss-tile`, `--ss-border`, `--ss-shadow`, `--ss-text`,
//   `--ss-muted`, `--ss-track`, `--ss-accent`, `--ss-accent-soft`, `--ss-pill`, `--ss-badge`, the bar
//   colours (`--ss-hp`, `--ss-mp`, `--ss-sp`, `--ss-exp`), tones and rarities, `--ss-radius-*`,
//   `--ss-space-*`, `--ss-font`, `--ss-blur` and `--ss-motion`. view/glass-*.css draws the building blocks
//   (glass card, tile, bar, status badge, pill, section label) from them; a screen's own `theme` (SPEC
//   §13.3) still sets any of them on its root, and wins.
// * light or dark: worked out from SillyTavern's own theme: the body text against the blur tint (light
//   text on a darker tint is a dark theme). The glass takes a share of the tint's colour, so a theme's hue
//   shows through, but never its opacity: the glass's alpha is the reader's Glass strength (30–90%, 50% is the
//   concept's: about half see-through), so the page behind always shows. SillyTavern sets its theme variables on <html>'s style; a change there is read again.
// * the reader's "Panel style" (Settings → Story Suite): Glass (the default), Solid (no blur, an opaque
//   tint: for slow devices or a busy background) or SillyTavern (SillyTavern's own colours and blur, as
//   before the UI stage). A system asking for less transparency gets Solid instead of Glass; one asking
//   for less motion gets no transitions.
// * the reader's "Font": Nunito (the default) or the theme's own font. Nunito ships with the extension
//   (assets/fonts/nunito, SIL OFL; view/fonts.css), so it is the same offline and while SillyTavern's "Forbid
//   external media" is on; nothing is fetched. If it cannot load, the system's own UI font.
// * the reader's "Text size": Normal (nothing added) or 110% / 120%, which set size.css's `--ss-zoom` (TEXT_SIZES).
//
// Everything is written into one <style data-ss-theme> in the page's head, every rule under
// :where(<Story Suite roots>) (the same roots as controls.css), so SillyTavern's own UI is never touched:
// no class, attribute or style is set on any of SillyTavern's elements. The class `ss-scheme-light` or
// `ss-scheme-dark` inside a root forces one scheme there (the UI sample shows both side by side).
// Public face: re-exports its parts.
export { THEME_ROOTS, ROOT_SELECTOR } from './theme-parts/roots.js';
export { PANEL_STYLES, FONTS, SCHEMES } from './theme-parts/options.js';
export { DEFAULT_PANEL, DEFAULT_FONT, DEFAULT_TEXT_SIZE, DEFAULT_GLASS } from './theme-parts/defaults.js';
export { TEXT_SIZES, textSizeOf } from './theme-parts/text-size.js';
export { FONT_STACKS } from './theme-parts/fonts.js';
export { ACCENT, PALETTES } from './theme-parts/palettes.js';
export { TINT_SHARE } from './theme-parts/tint.js';
export { GLASS_MIN, GLASS_MAX, glassAlphas } from './theme-parts/glass.js';
export { parseColor, luminance } from './theme-parts/colors.js';
export { decideScheme, themeChoice } from './theme-parts/scheme-choice.js';
export { schemeTokens } from './theme-parts/scheme-tokens.js';
export { themeTokens } from './theme-parts/tokens.js';
export { themeCss } from './theme-parts/css.js';
export { createThemeBridge } from './theme-parts/bridge.js';
