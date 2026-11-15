// Writes a token set on the suite root and refuses values that are not colour, length or font.

import { TOKENS } from './tokens.js';

const TOKEN_SET = new Set(TOKENS);
const UNSAFE_RE = /[;{}\r\n\0]|<\/|@import\b|\burl\s*\(|\bexpression\s*\(|javascript:/i;

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN_RE = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\s*\((.+)\)$/is;
const GRADIENT_RE = /^(?:repeating-)?(?:linear|radial|conic)-gradient\s*\((.+)\)$/is;
const VAR_RE = /^var\(\s*--[a-zA-Z0-9_-]+(?:\s*,\s*[^;{}]+)?\s*\)$/;
const LENGTH_RE = /^(?:0|-?(?:\d+|\d*\.\d+)(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|cqi|cqw|cqh|%))$/i;
const NAMED_COLOR_RE = /^(?:transparent|currentcolor|inherit|black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|aqua|lime|olive|fuchsia|rebeccapurple)$/i;
const FONT_ITEM_RE = /^(?:"[^"\\;{}]+"|'[^'\\;{}]+'|[a-zA-Z][a-zA-Z0-9_-]*(?:\s+[a-zA-Z0-9_-]+)*)$/;

function balancedParens(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function isColor(val) {
  if (HEX_RE.test(val) || NAMED_COLOR_RE.test(val) || VAR_RE.test(val)) return true;
  if (COLOR_FN_RE.test(val)) return balancedParens(val);
  return false;
}

function isGradientOrColor(val) {
  if (isColor(val)) return true;
  if (GRADIENT_RE.test(val)) return balancedParens(val);
  return false;
}

function isLength(val) {
  return LENGTH_RE.test(val) || VAR_RE.test(val);
}

function isFont(val) {
  if (VAR_RE.test(val)) return true;
  const parts = val.split(',').map(s => s.trim());
  return parts.length > 0 && parts.every(p => p.length > 0 && FONT_ITEM_RE.test(p));
}

function isShadow(val) {
  if (val.toLowerCase() === 'none' || VAR_RE.test(val)) return true;
  if (!balancedParens(val)) return false;
  // Split top-level commas (outside parens) for multi-layer shadows.
  const layers = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < val.length; i += 1) {
    if (val[i] === '(') depth += 1;
    else if (val[i] === ')') depth -= 1;
    else if (val[i] === ',' && depth === 0) {
      layers.push(val.slice(start, i).trim());
      start = i + 1;
    }
  }
  layers.push(val.slice(start).trim());
  return layers.every(layer => {
    if (!layer) return false;
    const tokens = layer.match(/(?:[^\s(]+|\([^)]*\))+/g) ?? [];
    if (tokens.length < 3) return false;
    const filtered = tokens[0].toLowerCase() === 'inset' ? tokens.slice(1) : tokens;
    if (filtered.length < 3 || filtered.length > 5) return false;
    const lengths = filtered.slice(0, -1);
    const color = filtered[filtered.length - 1];
    return lengths.length >= 2 && lengths.every(isLength) && isColor(color);
  });
}

function checkTokenValue(name, raw) {
  if (!TOKEN_SET.has(name)) return `unknown token: ${name}`;
  if (typeof raw !== 'string') return `${name}: value must be a string`;
  const val = raw.trim();
  if (!val) return `${name}: empty value`;
  if (UNSAFE_RE.test(val) || !balancedParens(val)) return `${name}: unsafe or malformed value`;

  if (name === '--su-blur') return isLength(val) ? null : `${name}: expected CSS length`;
  if (name === '--su-font') return isFont(val) ? null : `${name}: expected font-family list`;
  if (name === '--su-shadow') return isShadow(val) ? null : `${name}: expected CSS shadow`;
  if (name === '--su-back' || name === '--su-sky') {
    return isGradientOrColor(val) ? null : `${name}: expected CSS gradient or colour`;
  }
  return isColor(val) ? null : `${name}: expected CSS colour`;
}

/**
 * Validates a skin token map and returns `{ ok, errors, valid }`.
 */
export function checkSkin(skin) {
  if (!skin || typeof skin !== 'object' || Array.isArray(skin)) {
    return { ok: false, errors: ['skin must be a plain object'], valid: {} };
  }
  const errors = [];
  const valid = {};
  for (const [name, value] of Object.entries(skin)) {
    const err = checkTokenValue(name, value);
    if (err) errors.push(err);
    else valid[name] = value.trim();
  }
  return { ok: errors.length === 0, errors, valid };
}

/**
 * Writes validated theme tokens onto `root.style` and refuses invalid values.
 */
export function applyTheme(root, tokens, { scheme } = {}) {
  if (!root?.style?.setProperty) {
    throw new TypeError('applyTheme requires a root element with style.setProperty');
  }
  const { errors, valid } = checkSkin(tokens);
  const applied = [];
  for (const [name, value] of Object.entries(valid)) {
    root.style.setProperty(name, value);
    applied.push(name);
  }
  if ((scheme === 'dark' || scheme === 'light') && typeof root.setAttribute === 'function') {
    root.setAttribute('data-scheme', scheme);
  }
  return { ok: errors.length === 0, applied, rejected: errors };
}
