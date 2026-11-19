// Settings › Look › Glass strength reaches every glass surface: look.js moves every strength token (panels, scrims, blurs), the default draws the mock
// exactly, and ui/css draws glass with those tokens only (no literal blur, no literal see-through neutral fill outside the allowed list below).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lookOf, lookTheme, STRENGTH_TOKENS } from '../../../ui/theme/look.js';
import { TOKENS, GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';
import { checkSkin } from '../../../ui/theme/apply.js';

const CSS_DIR = fileURLToPath(new URL('../../../ui/css/', import.meta.url));
const DARK_ST = { '--SmartThemeBodyColor': '#dcdcd2', '--SmartThemeBlurTintColor': 'rgba(23,23,23,1)' };
const LIGHT_ST = { '--SmartThemeBodyColor': '#222222', '--SmartThemeBlurTintColor': 'rgba(245,245,245,1)' };
const reader = vars => name => vars[name] ?? '';
const at = (strength, vars = DARK_ST, panelStyle = 'glass') => lookTheme(lookOf({ glassStrength: strength, panelStyle }), reader(vars)).tokens;
const num = value => Number.parseFloat(String(value).replace(/^rgba\([^)]*,([^,)]+)\)$/, '$1'));

// The see-through neutral fills ui/css may still write as literals, and why (each is a selector in the file named).
const ALLOWED_FILLS = Object.freeze([
  ['shell.css', '.su-dim', 'outside the suite root (its sibling in .su-layer), so the look\'s tokens do not reach it; the root covers it once open'],
  ['shell.css', '.su-back::after', 'shading of the sky picture (the backdrop), not a glass surface'],
  ['shell.css', '.su-root[data-scheme="light"] .su-back::after', 'shading of the sky picture (the backdrop), not a glass surface'],
  ['dossier.css', '.dov::after', 'shading of the dossier\'s sky picture, not a glass surface'],
  ['dossier.css', '[data-scheme="light"] .dov::after', 'shading of the dossier\'s sky picture, not a glass surface'],
  ['dossier.css', '.bigring .prof', 'the Profile label on the portrait photo: a solid pill for legibility over a picture'],
]);

function rules() {
  const out = [];
  for (const file of readdirSync(CSS_DIR).filter(name => name.endsWith('.css')).sort()) {
    const text = readFileSync(CSS_DIR + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, head, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls = body.split(';').map(d => d.trim()).filter(Boolean).map(d => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]);
      out.push({ file, selector: head.trim().replace(/\s+/g, ' '), decls });
    }
  }
  return out;
}

// A see-through neutral (grey, near-black or near-white) rgba(): the look of a glass panel or a scrim.
function neutralSeeThrough(value) {
  return [...value.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g)].some(([, r, g, b, a]) => {
    const c = [r, g, b].map(Number);
    return Number(a) < 1 && Math.max(...c) - Math.min(...c) <= 16 && (Math.max(...c) <= 40 || Math.min(...c) >= 230);
  });
}

test('the strength tokens are theme tokens, and at the default (50%) every one is the mock\'s, dark and light', () => {
  assert.deepEqual(STRENGTH_TOKENS, ['--su-panel', '--su-panel2', '--su-tint', '--su-scrim', '--su-scrim-strong', '--su-scrim-place', '--su-blur', '--su-blur-strong', '--su-blur-soft']);
  for (const name of STRENGTH_TOKENS) assert.ok(TOKENS.includes(name), name);
  assert.deepEqual(at(50), { ...GLASS_DARK });
  assert.deepEqual(at(50, LIGHT_ST), { ...GLASS_LIGHT });
  assert.equal(GLASS_DARK['--su-tint'], GLASS_DARK['--su-line2'], 'the tint is the old fill (the hairline colour) at 50');
  assert.equal(GLASS_LIGHT['--su-tint'], GLASS_LIGHT['--su-line2']);
  assert.equal(GLASS_DARK['--su-scrim'], 'rgba(6,8,16,.45)');
  assert.equal(GLASS_DARK['--su-scrim-strong'], 'rgba(6,8,16,.6)');
  assert.equal(GLASS_DARK['--su-scrim-place'], 'rgba(8,10,18,.5)');
  assert.deepEqual([GLASS_DARK['--su-blur'], GLASS_DARK['--su-blur-strong'], GLASS_DARK['--su-blur-soft']], ['16px', '28px', '6px']);
});

test('every strength token moves with the strength (30% clearer and sharper, 90% denser and softer), and only those move', () => {
  for (const vars of [DARK_ST, LIGHT_ST]) {
    const [low, mid, high] = [30, 50, 90].map(n => at(n, vars));
    for (const name of STRENGTH_TOKENS) {
      assert.ok(num(low[name]) < num(mid[name]) && num(mid[name]) < num(high[name]), `${name}: ${low[name]} < ${mid[name]} < ${high[name]}`);
    }
    for (const name of TOKENS.filter(n => !STRENGTH_TOKENS.includes(n))) assert.equal(low[name], mid[name], name);
    for (const tokens of [low, high]) {
      const check = checkSkin(tokens);
      assert.equal(check.ok, true, check.errors.join('; '));
    }
  }
  assert.deepEqual([30, 90].map(n => at(n)['--su-blur']), ['10px', '29px']);
  assert.deepEqual([30, 90].map(n => at(n)['--su-blur-strong']), ['17px', '50px']);
  assert.deepEqual([30, 90].map(n => at(n)['--su-blur-soft']), ['4px', '11px']);
  assert.deepEqual([30, 90].map(n => at(n)['--su-tint']), ['rgba(255,255,255,.06)', 'rgba(255,255,255,.18)']);
  assert.deepEqual([30, 90].map(n => at(n, LIGHT_ST)['--su-tint']), ['rgba(30,34,52,.07)', 'rgba(30,34,52,.22)']);
  assert.deepEqual([30, 90].map(n => at(n)['--su-scrim']), ['rgba(6,8,16,.25)', 'rgba(6,8,16,.8)']);
  assert.deepEqual([30, 90].map(n => at(n)['--su-scrim-strong']), ['rgba(6,8,16,.4)', 'rgba(6,8,16,.8)']);
  assert.deepEqual([30, 90].map(n => at(n)['--su-scrim-place']), ['rgba(8,10,18,.3)', 'rgba(8,10,18,.8)']);
  const steps = [50, 60, 70, 80, 90].map(n => STRENGTH_TOKENS.map(name => at(n)[name]).join());
  assert.equal(new Set(steps).size, steps.length, 'every step to 90% changes them');
});

test('Follow SillyTavern: the strength moves none of them; the tint is SillyTavern\'s hairline mix, as the fills were', () => {
  const follow = lookTheme(lookOf({ panelStyle: 'sillytavern' }), reader({ ...DARK_ST, '--SmartThemeBorderColor': 'rgba(0,0,0,0.5)' })).tokens;
  assert.equal(follow['--su-tint'], follow['--su-line2']);
  for (const name of STRENGTH_TOKENS) assert.equal(at(30, DARK_ST, 'sillytavern')[name], at(90, DARK_ST, 'sillytavern')[name], name);
});

test('ui/css: every strength token is drawn somewhere, and every backdrop blur is a strength token', () => {
  const all = rules();
  const text = all.flatMap(r => r.decls.map(([, v]) => v)).join('\n');
  for (const name of STRENGTH_TOKENS) assert.match(text, new RegExp(`var\\(${name}\\)`), `${name} is used in ui/css`);
  const literal = all.flatMap(r => r.decls.filter(([p, v]) => /backdrop-filter$/.test(p) && v !== 'none' && /blur\(/.test(v) && !/^blur\(var\(--su-blur(-strong|-soft)?\)\)/.test(v)).map(([p, v]) => `${r.file} ${r.selector} ${p}: ${v}`));
  assert.deepEqual(literal, [], 'a glass blur is var(--su-blur), var(--su-blur-strong) or var(--su-blur-soft)');
});

test('ui/css: no glass surface or scrim writes its fill as a literal (a see-through neutral rgba) outside the allowed list', () => {
  const allowed = new Set(ALLOWED_FILLS.map(([file, selector]) => `${file} ${selector}`));
  const found = rules().filter(r => r.decls.some(([p, v]) => /^background(-color|-image)?$/.test(p) && neutralSeeThrough(v))).map(r => `${r.file} ${r.selector}`);
  assert.deepEqual(found.filter(key => !allowed.has(key)), [], 'use --su-panel, --su-panel2 or a --su-scrim token');
  assert.deepEqual([...allowed].filter(key => !found.includes(key)), [], 'the allowed list names only fills that are still there');
  const blurred = rules().filter(r => r.decls.some(([p, v]) => p === 'backdrop-filter' && v !== 'none'));
  const literalUnderBlur = blurred.filter(r => r.decls.some(([p, v]) => /^background(-color)?$/.test(p) && !/var\(--su-/.test(v))).map(r => `${r.file} ${r.selector}`);
  assert.deepEqual(literalUnderBlur, [], 'a blurred surface draws its fill from the tokens');
  const hairlineFills = rules().filter(r => r.decls.some(([p, v]) => /^background/.test(p) && /var\(--su-line2\)/.test(v))).map(r => `${r.file} ${r.selector}`);
  assert.deepEqual(hairlineFills, [], 'a chip or row fill is var(--su-tint) (moved by the strength); --su-line2 is for lines');
});
