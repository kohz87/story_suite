// Settings › Look in the new view: the stored host settings (Panel style, Glass strength, Font, Text size) → the suite root's tokens, scheme and text size.

import { GLASS_DARK, GLASS_LIGHT } from './tokens.js';
import { decideScheme, followSt } from './follow-st.js';

const STRENGTH = Object.freeze({ min: 30, max: 90, base: 50 });
// Every token Glass strength moves, with its value at the default strength (50%): the mock's own (tokens.js), so the default draws exactly the mock.
// The panels' colour and alpha (dark and light); the tint of chips and rows on a panel (dark and light); the scrims under sheets (the same in
// both); the blurs, in px.
const PANELS = Object.freeze({
  dark: Object.freeze({ '--su-panel': ['28,30,44', 0.72], '--su-panel2': ['36,38,56', 0.9] }),
  light: Object.freeze({ '--su-panel': ['255,255,255', 0.72], '--su-panel2': ['255,255,255', 0.88] }),
});
const TINTS = Object.freeze({ dark: ['255,255,255', 0.1], light: ['30,34,52', 0.12] });
const SCRIMS = Object.freeze({ '--su-scrim': ['6,8,16', 0.45], '--su-scrim-strong': ['6,8,16', 0.6], '--su-scrim-place': ['8,10,18', 0.5] });
const BLURS = Object.freeze({ '--su-blur': 16, '--su-blur-strong': 28, '--su-blur-soft': 6 });
// Panel background Off: the suite lies on a flat colour (shell.css --su-flat) next to which the dark panel's colour hardly differs at any alpha. So
// above 50% the strength also lifts the cards off it, all the way at 90%: the dark panels go lighter (to the colours here) and the card edge and
// shadow firmer; light keeps its white panels (already lighter than the flat) and gets a greyer edge and a deeper shadow. 50% and under: as with it On.
const LIFT = Object.freeze({
  dark: Object.freeze({ panels: { '--su-panel': '46,49,68', '--su-panel2': '49,52,72' }, line: [[255, 255, 255, 0.08], [255, 255, 255, 0.15]], shadow: [[0, 0, 0, 0.4], [0, 0, 0, 0.6]] }),
  light: Object.freeze({ panels: {}, line: [[255, 255, 255, 0.9], [30, 34, 52, 0.16]], shadow: [[40, 30, 80, 0.18], [40, 30, 80, 0.32]] }),
});
const SHADOW = '0 10px 30px'; // the mock's --su-shadow offsets and size (tokens.js); only its colour moves
/** The tokens Glass strength moves (look.js is their one source; ui/css draws every glass surface with them); the card edge and shadow only with Panel background Off. */
export const STRENGTH_TOKENS = Object.freeze([...Object.keys(PANELS.dark), '--su-tint', ...Object.keys(SCRIMS), ...Object.keys(BLURS), '--su-line', '--su-shadow']);
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
const short = a => String(Math.round(a * 100) / 100).replace(/^0\./, '.');
const rgba = ([rgb, base], strength, top) => `rgba(${rgb},${short(Math.min(0.98, Math.max(0.2, alphaAt(base, strength, top))))})`;
// A tint and a blur grow with the strength: 30% is .6 of the default, 90% is 1.8 of it (a blur in whole px).
const tintAt = ([rgb, base], strength) => `rgba(${rgb},${short((base * strength) / STRENGTH.base)})`;
const blurAt = (base, strength) => `${Math.round((base * strength) / STRENGTH.base)}px`;
// The lift with Panel background Off: 0 at 50% and under, 1 at 90%; a colour part way from its 50% value to its 90% one.
const liftAt = strength => Math.max(0, (strength - STRENGTH.base) / (STRENGTH.max - STRENGTH.base));
const mix = (from, to, f) => from.map((v, i) => v + (to[i] - v) * f);
const rgbMix = (from, to, f) => mix(from.split(',').map(Number), to.split(',').map(Number), f).map(Math.round).join(',');
const rgbaMix = ([from, to], f) => { const c = mix(from, to, f); return `rgba(${c.slice(0, 3).map(Math.round).join(',')},${short(c[3])})`; };

/**
 * The look's theme: `{ tokens, scheme, zoom }`. Light or dark follows SillyTavern's theme (`readVar(name)` reads its CSS variables) either way.
 * Glass: the Glass dark or light tokens, the strength moving the panels' and the scrims' alpha (50% is the mock's, under 50% one point per point,
 * 90% is .98 for a panel and .8 for a scrim), the chips' and rows' tint and the blurs (30% is .6 of the mock's, 90% is 1.8). Every glass surface in ui/css draws with these tokens.
 * `look.panelBg` is Settings › Look › Panel background (true is On; anything else is Off, the device default): Off, above 50% the cards are also lifted (LIFT).
 * Follow SillyTavern: its own colours and blur (follow-st.js); the strength does not apply. The Font sets `--su-font` under both.
 */
export function lookTheme(look, readVar = () => '') {
  const read = name => String(readVar(name) ?? '').trim();
  const scheme = decideScheme({ body: read('--SmartThemeBodyColor'), tint: read('--SmartThemeBlurTintColor') });
  const tokens = look.panel === 'sillytavern' ? { ...followSt(read) } : { ...(scheme === 'light' ? GLASS_LIGHT : GLASS_DARK) };
  if (look.panel === 'glass' && look.strength !== STRENGTH.base) {
    const lift = look.panelBg === true ? 0 : liftAt(look.strength), up = LIFT[scheme];
    for (const [name, [rgb, base]] of Object.entries(PANELS[scheme])) tokens[name] = rgba([up.panels[name] && lift ? rgbMix(rgb, up.panels[name], lift) : rgb, base], look.strength, 0.98);
    if (lift) [tokens['--su-line'], tokens['--su-shadow']] = [rgbaMix(up.line, lift), `${SHADOW} ${rgbaMix(up.shadow, lift)}`];
    tokens['--su-tint'] = tintAt(TINTS[scheme], look.strength);
    for (const [name, value] of Object.entries(SCRIMS)) tokens[name] = rgba(value, look.strength, 0.8);
    for (const [name, base] of Object.entries(BLURS)) tokens[name] = blurAt(base, look.strength);
  }
  tokens['--su-font'] = look.font === 'theme' ? THEME_FONT : NUNITO;
  return { tokens, scheme, zoom: TEXT_ZOOM[look.textSize] };
}
