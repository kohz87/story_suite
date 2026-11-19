// Settings › Look in the new view: the stored host settings (Panel style, Glass strength, Font, Text size) → the suite root's tokens, scheme and text size.

import { GLASS_DARK, GLASS_LIGHT } from './tokens.js';
import { decideScheme, followSt } from './follow-st.js';

const STRENGTH = Object.freeze({ min: 30, max: 90, base: 50 });
// Every token Glass strength moves, with its value at the default strength (50%): the mock's own (tokens.js), so the default draws exactly the mock.
// The panels' colour and alpha (dark and light); the scrims under sheets (the same in both); the blurs, in px.
const PANELS = Object.freeze({
  dark: Object.freeze({ '--su-panel': ['28,30,44', 0.72], '--su-panel2': ['36,38,56', 0.9] }),
  light: Object.freeze({ '--su-panel': ['255,255,255', 0.72], '--su-panel2': ['255,255,255', 0.88] }),
});
const SCRIMS = Object.freeze({ '--su-scrim': ['6,8,16', 0.45], '--su-scrim-strong': ['6,8,16', 0.6], '--su-scrim-place': ['8,10,18', 0.5] });
const BLURS = Object.freeze({ '--su-blur': 16, '--su-blur-strong': 28, '--su-blur-soft': 6 });
/** The tokens Glass strength moves (look.js is their one source; ui/css draws every glass surface with them). */
export const STRENGTH_TOKENS = Object.freeze([...Object.keys(PANELS.dark), ...Object.keys(SCRIMS), ...Object.keys(BLURS)]);
const NUNITO = GLASS_DARK['--su-font'];
const THEME_FONT = 'var(--mainFontFamily, system-ui, sans-serif)';
/** Text size → the zoom the suite root is drawn at (ui/css/shell.css `.su-root[data-text]`); Normal adds nothing. */
export const TEXT_ZOOM = Object.freeze({ 100: null, 110: 1.1, 120: 1.2 });

const pick = (value, list, dflt) => (list.includes(String(value)) ? String(value) : dflt);

/**
 * The reader's Look from the host settings: `{ panel: 'glass' | 'sillytavern', strength: 30–90, font: 'nunito' | 'theme', textSize: '100' | '110' | '120' }`.
 * Anything unknown is the default; a stored Solid (dropped, decision 36.15; the Look row shows it as Glass) is Glass.
 */
export function lookOf(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const n = typeof s.glassStrength === 'number' ? s.glassStrength : Number.NaN;
  return {
    panel: s.panelStyle === 'sillytavern' ? 'sillytavern' : 'glass',
    strength: Number.isFinite(n) ? Math.min(STRENGTH.max, Math.max(STRENGTH.min, Math.round(n))) : STRENGTH.base,
    font: pick(s.font, ['nunito', 'theme'], 'nunito'),
    textSize: pick(s.textSize, Object.keys(TEXT_ZOOM), '100'),
  };
}

// An alpha for a strength: below 50% one point of alpha per point (30% → 20 points clearer); above it the rest of the way to `top` is spread over
// 50–90%, so every step up to 90% is denser (no dead zone where the cap is reached early). Panels go to .98; a scrim to .8 (the page stays in sight).
const alphaAt = (base, strength, top) => (strength <= STRENGTH.base ? base - (STRENGTH.base - strength) / 100 : base + ((top - base) * (strength - STRENGTH.base)) / (STRENGTH.max - STRENGTH.base));
const alpha = a => String(Math.round(Math.min(0.98, Math.max(0.2, a)) * 100) / 100).replace(/^0\./, '.');
const rgba = ([rgb, base], strength, top) => `rgba(${rgb},${alpha(alphaAt(base, strength, top))})`;
// A blur grows with the strength: 30% is .6 of the default, 90% is 1.8 of it (whole px).
const blurAt = (base, strength) => `${Math.round((base * strength) / STRENGTH.base)}px`;

/**
 * The look's theme: `{ tokens, scheme, zoom }`. Light or dark follows SillyTavern's theme (`readVar(name)` reads its CSS variables) either way.
 * Glass: the Glass dark or light tokens, the strength moving the panels' and the scrims' alpha (50% is the mock's, under 50% one point per point,
 * 90% is .98 for a panel and .8 for a scrim) and the blurs (30% is .6 of the mock's, 90% is 1.8). Every glass surface in ui/css draws with these tokens.
 * Follow SillyTavern: its own colours and blur (follow-st.js); the strength does not apply. The Font sets `--su-font` under both.
 */
export function lookTheme(look, readVar = () => '') {
  const read = name => String(readVar(name) ?? '').trim();
  const scheme = decideScheme({ body: read('--SmartThemeBodyColor'), tint: read('--SmartThemeBlurTintColor') });
  const tokens = look.panel === 'sillytavern' ? { ...followSt(read) } : { ...(scheme === 'light' ? GLASS_LIGHT : GLASS_DARK) };
  if (look.panel === 'glass' && look.strength !== STRENGTH.base) {
    for (const [name, value] of Object.entries(PANELS[scheme])) tokens[name] = rgba(value, look.strength, 0.98);
    for (const [name, value] of Object.entries(SCRIMS)) tokens[name] = rgba(value, look.strength, 0.8);
    for (const [name, base] of Object.entries(BLURS)) tokens[name] = blurAt(base, look.strength);
  }
  tokens['--su-font'] = look.font === 'theme' ? THEME_FONT : NUNITO;
  return { tokens, scheme, zoom: TEXT_ZOOM[look.textSize] };
}
