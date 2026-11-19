// Settings › Look → the new view's theme (ui/theme/look.js): the defaults draw the mock's Glass exactly; each control moves its own token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lookOf, lookTheme, TEXT_ZOOM, STRENGTH_TOKENS } from '../../../ui/theme/look.js';
import { GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';
import { checkSkin } from '../../../ui/theme/apply.js';

const DARK_ST = { '--SmartThemeBodyColor': '#dcdcd2', '--SmartThemeBlurTintColor': 'rgba(23,23,23,1)', '--SmartThemeBorderColor': 'rgba(0,0,0,0.5)', '--mainFontFamily': '"Noto Sans", sans-serif' };
const LIGHT_ST = { '--SmartThemeBodyColor': '#222222', '--SmartThemeBlurTintColor': 'rgba(245,245,245,1)' };
const reader = vars => name => vars[name] ?? '';

test('lookOf: the defaults for nothing stored; a stored Solid is Glass; the strength is held to 30-90; unknown values are the defaults', () => {
  assert.deepEqual(lookOf(null), { panel: 'glass', strength: 50, font: 'nunito', textSize: '100' });
  assert.deepEqual(lookOf({ panelStyle: 'glass', glassStrength: 50, font: 'nunito', textSize: '100', sendPending: true }), lookOf({}));
  assert.equal(lookOf({ panelStyle: 'solid' }).panel, 'glass');
  assert.equal(lookOf({ panelStyle: 'sillytavern' }).panel, 'sillytavern');
  assert.equal(lookOf({ glassStrength: 12 }).strength, 30);
  assert.equal(lookOf({ glassStrength: 140 }).strength, 90);
  assert.equal(lookOf({ glassStrength: '70' }).strength, 50);
  assert.equal(lookOf({ font: 'theme' }).font, 'theme');
  assert.equal(lookOf({ font: 'comic' }).font, 'nunito');
  assert.equal(lookOf({ textSize: '120' }).textSize, '120');
  assert.equal(lookOf({ textSize: 130 }).textSize, '100');
});

test('the defaults are the mock: Glass dark or light (from SillyTavern\'s theme), untouched, and no zoom', () => {
  assert.deepEqual(lookTheme(lookOf({}), reader(DARK_ST)), { tokens: { ...GLASS_DARK }, scheme: 'dark', zoom: null });
  assert.deepEqual(lookTheme(lookOf({}), reader(LIGHT_ST)), { tokens: { ...GLASS_LIGHT }, scheme: 'light', zoom: null });
});

test('Glass strength (Panel background On) moves the panels\' alpha: 50% is the mock\'s .72/.9, under it one point per point, above it every step denser up to .98 at 90%', () => {
  const at = (strength, vars = DARK_ST) => lookTheme({ ...lookOf({ glassStrength: strength }), panelBg: true }, reader(vars)).tokens; // Off: glass-flat.test.js
  assert.equal(at(30)['--su-panel'], 'rgba(28,30,44,.52)');
  assert.equal(at(30)['--su-panel2'], 'rgba(36,38,56,.7)');
  assert.equal(at(70)['--su-panel'], 'rgba(28,30,44,.85)');
  assert.equal(at(80)['--su-panel'], 'rgba(28,30,44,.92)');
  assert.equal(at(80)['--su-panel2'], 'rgba(36,38,56,.96)');
  assert.equal(at(90)['--su-panel'], 'rgba(28,30,44,.98)');
  assert.equal(at(90)['--su-panel2'], 'rgba(36,38,56,.98)');
  const steps = [50, 60, 70, 80, 90].map(n => [at(n)['--su-panel'], at(n)['--su-panel2']].join());
  assert.equal(new Set(steps).size, steps.length, 'no dead zone: every step to 90% changes the panels');
  assert.equal(at(30, LIGHT_ST)['--su-panel'], 'rgba(255,255,255,.52)');
  assert.equal(at(30, LIGHT_ST)['--su-panel2'], 'rgba(255,255,255,.68)');
  const rest = tokens => Object.fromEntries(Object.entries(tokens).filter(([name]) => !STRENGTH_TOKENS.includes(name)));
  assert.deepEqual(rest(at(30)), rest({ ...GLASS_DARK }), 'only the strength tokens move (the scrims and blurs: glass-strength.test.js)');
});

test('Follow SillyTavern: its own colours; the strength does not apply there', () => {
  const follow = strength => lookTheme(lookOf({ panelStyle: 'sillytavern', glassStrength: strength }), reader(DARK_ST));
  assert.equal(follow(50).tokens['--su-panel'], 'rgba(23,23,23,1)');
  assert.equal(follow(50).tokens['--su-text'], '#dcdcd2');
  assert.deepEqual(follow(30), follow(50));
  assert.equal(lookTheme(lookOf({ panelStyle: 'sillytavern' }), reader(LIGHT_ST)).scheme, 'light');
});

test('Font: Nunito under both panel styles, or the theme\'s font (SillyTavern\'s --mainFontFamily) under both', () => {
  for (const panelStyle of ['glass', 'sillytavern']) {
    assert.equal(lookTheme(lookOf({ panelStyle }), reader(DARK_ST)).tokens['--su-font'], GLASS_DARK['--su-font']);
    assert.equal(lookTheme(lookOf({ panelStyle, font: 'theme' }), reader(DARK_ST)).tokens['--su-font'], 'var(--mainFontFamily, system-ui, sans-serif)');
  }
});

test('Text size: 110% and 120% zoom the root; Normal adds nothing', () => {
  assert.deepEqual(TEXT_ZOOM, { 100: null, 110: 1.1, 120: 1.2 });
  assert.equal(lookTheme(lookOf({ textSize: '110' }), reader(DARK_ST)).zoom, 1.1);
  assert.equal(lookTheme(lookOf({ textSize: '120' }), reader(DARK_ST)).zoom, 1.2);
});

test('every look\'s tokens pass the skin check (applyTheme writes them all)', () => {
  for (const panelStyle of ['glass', 'sillytavern']) for (const font of ['nunito', 'theme']) for (const glassStrength of [30, 50, 90]) {
    for (const [vars, panelBg] of [DARK_ST, LIGHT_ST, {}].flatMap(v => [[v, true], [v, false]])) {
      const { errors } = checkSkin(lookTheme({ ...lookOf({ panelStyle, font, glassStrength }), panelBg }, reader(vars)).tokens);
      assert.deepEqual(errors, [], `${panelStyle} ${font} ${glassStrength} ${panelBg}`);
    }
  }
});
