// Maps SillyTavern's theme variables to tokens, decides light or dark, and signals when the theme changes.

import { GLASS_DARK, GLASS_LIGHT } from './tokens.js';

const NAMED = Object.freeze({ black: [0, 0, 0, 1], white: [255, 255, 255, 1], transparent: [0, 0, 0, 0] });
const clampByte = n => Math.min(255, Math.max(0, n));
const clampUnit = n => Math.min(1, Math.max(0, n));

function parseColor(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!text) return null;
  if (Object.hasOwn(NAMED, text)) {
    const [r, g, b, a] = NAMED[text];
    return { r, g, b, a };
  }
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map(d => d + d).join('');
    const byte = i => parseInt(digits.slice(i, i + 2), 16);
    const a = digits.length === 8 ? Math.round((byte(6) / 255) * 1000) / 1000 : 1;
    return { r: byte(0), g: byte(2), b: byte(4), a };
  }
  const fn = /^rgba?\(\s*([^)]*)\)$/.exec(text);
  if (!fn) return null;
  const [channels, alphaPart] = fn[1].includes('/') ? fn[1].split('/') : [fn[1], null];
  const parts = channels.split(/[\s,]+/).filter(Boolean);
  let alpha = alphaPart;
  if (alpha === null && parts.length === 4) alpha = parts.pop();
  if (parts.length !== 3) return null;
  const channel = part => {
    const m = /^(-?\d*\.?\d+)(%?)$/.exec(part);
    if (!m) return null;
    return clampByte(m[2] ? (Number(m[1]) / 100) * 255 : Number(m[1]));
  };
  const [r, g, b] = parts.map(channel);
  if ([r, g, b].some(n => n === null || Number.isNaN(n))) return null;
  let a = 1;
  if (alpha !== null) {
    const m = /^\s*(-?\d*\.?\d+)(%?)\s*$/.exec(alpha);
    if (!m) return null;
    a = clampUnit(m[2] ? Number(m[1]) / 100 : Number(m[1]));
  }
  return { r, g, b, a };
}

function luminance(color) {
  const lin = c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(color.r) + 0.7152 * lin(color.g) + 0.0722 * lin(color.b);
}

/**
 * Decides 'dark' or 'light' from SillyTavern's body text and blur-tint colours.
 */
export function decideScheme({ body = '', tint = '' } = {}) {
  const text = parseColor(body);
  const panel = parseColor(tint);
  if (text && panel && panel.a >= 0.35) return luminance(text) >= luminance(panel) ? 'dark' : 'light';
  if (text) return luminance(text) >= 0.4 ? 'dark' : 'light';
  if (panel) return luminance(panel) < 0.4 ? 'dark' : 'light';
  return 'dark';
}

function defaultReader(doc) {
  const target = doc?.documentElement;
  const win = doc?.defaultView ?? globalThis;
  return name => {
    if (!target || typeof win?.getComputedStyle !== 'function') return '';
    try {
      return String(win.getComputedStyle(target)?.getPropertyValue?.(name) ?? '').trim();
    } catch {
      return '';
    }
  };
}

/**
 * Maps SillyTavern's CSS theme variables onto the `--su-*` token set.
 */
export function followSt(input) {
  const readVar = typeof input === 'function'
    ? input
    : (input?.readVar ?? defaultReader(input?.doc ?? globalThis.document));
  const read = name => String(readVar(name) ?? '').trim();

  const body = read('--SmartThemeBodyColor');
  const tint = read('--SmartThemeBlurTintColor');
  const border = read('--SmartThemeBorderColor');
  const quote = read('--SmartThemeQuoteColor');
  const font = read('--mainFontFamily');
  const em = read('--SmartThemeEmColor');
  const shadow = read('--SmartThemeShadowColor');

  const scheme = decideScheme({ body, tint });
  const base = scheme === 'light' ? GLASS_LIGHT : GLASS_DARK;

  const panel = tint || base['--su-panel'];
  const panel2 = tint
    ? `color-mix(in srgb, ${tint} 92%, ${scheme === 'dark' ? '#ffffff' : '#000000'})`
    : base['--su-panel2'];

  return Object.freeze({
    ...base,
    '--su-back': tint || base['--su-back'],
    '--su-panel': panel,
    '--su-panel2': panel2,
    '--su-line': border || base['--su-line'],
    '--su-line2': border ? `color-mix(in srgb, ${border} 55%, transparent)` : base['--su-line2'],
    '--su-text': body || base['--su-text'],
    '--su-soft': body ? `color-mix(in srgb, ${body} 80%, transparent)` : base['--su-soft'],
    '--su-muted': em || (body ? `color-mix(in srgb, ${body} 58%, transparent)` : base['--su-muted']),
    '--su-pill': body || base['--su-pill'],
    '--su-pilltext': tint && parseColor(tint)?.a >= 0.35 ? tint : base['--su-pilltext'],
    '--su-tile': body ? `color-mix(in srgb, ${body} 8%, transparent)` : base['--su-tile'],
    '--su-tileline': quote || base['--su-tileline'],
    '--su-glyph': body || base['--su-glyph'],
    '--su-accent': quote || base['--su-accent'],
    '--su-shadow': shadow ? `0 10px 30px ${shadow}` : base['--su-shadow'],
    '--su-font': font || base['--su-font'],
  });
}

/**
 * Calls onChange whenever SillyTavern's theme may have changed (style or class edits on the page root or body); returns a stop function.
 */
export function watchSt(doc, onChange) {
  const Observer = doc?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (typeof Observer !== 'function' || !doc?.documentElement) return () => {};
  const seen = new Observer(() => onChange());
  const opts = { attributes: true, attributeFilter: ['style', 'class'] };
  seen.observe(doc.documentElement, opts);
  if (doc.body) seen.observe(doc.body, opts);
  return () => seen.disconnect();
}
