// Settings › Look › Glass strength with Panel background Off (the default): the suite lies on a flat colour, so above 50% the strength also lifts
// the cards off it (theme/look.js LIFT). 50% draws exactly as before, 30% as with Panel background On, 90% is a clearly lifted card; mount.js
// passes the switch in and draws the look again when it flips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookOf, lookTheme, STRENGTH_TOKENS } from '../../../ui/theme/look.js';
import { TOKENS, GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';
import { checkSkin } from '../../../ui/theme/apply.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';
import { createPrefs } from '../../../ui/runtime/prefs.js';
import { PANELBG_KEY } from '../../../ui/settings/panel-bg.js';

const DARK_ST = { '--SmartThemeBodyColor': '#dcdcd2', '--SmartThemeBlurTintColor': 'rgba(23,23,23,1)' };
const LIGHT_ST = { '--SmartThemeBodyColor': '#222222', '--SmartThemeBlurTintColor': 'rgba(245,245,245,1)' };
const reader = vars => name => vars[name] ?? '';
const at = (strength, vars = DARK_ST, panelBg = false, panelStyle = 'glass') => lookTheme({ ...lookOf({ glassStrength: strength, panelStyle }), panelBg }, reader(vars)).tokens;

// The flat colours Panel background Off lays under the suite (ui/css/shell.css), read from the CSS so the test follows it.
const shell = readFileSync(new URL('../../../ui/css/shell.css', import.meta.url), 'utf8');
const hex = h => [1, 3, 5].map(i => Number.parseInt(h.slice(i, i + 2), 16));
const FLAT = {
  dark: hex(shell.match(/\[data-panelbg="off"\] \{\s*background: var\(--su-flat, (#[0-9a-f]{6})\)/)[1]),
  light: hex(shell.match(/\[data-panelbg="off"\]\[data-scheme="light"\] \{\s*--su-flat: (#[0-9a-f]{6})/)[1]),
};
const rgba = value => value.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/).slice(1).map(Number);
// A panel colour laid over the flat colour, and how far it sits from the flat (mean of the three channels, in levels of 255).
const over = (value, flat) => { const [r, g, b, a] = rgba(value); return [r, g, b].map((c, i) => c * a + flat[i] * (1 - a)); };
const distance = (value, flat) => over(value, flat).reduce((sum, c, i) => sum + Math.abs(c - flat[i]), 0) / 3;
const luminance = rgb => rgb.map(x => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('Off at 50% (the default) is the mock exactly, dark and light; at 50% and under Off draws as On', () => {
  assert.deepEqual(at(50), { ...GLASS_DARK });
  assert.deepEqual(at(50, LIGHT_ST), { ...GLASS_LIGHT });
  assert.deepEqual(lookTheme(lookOf({}), reader(DARK_ST)).tokens, { ...GLASS_DARK }, 'nothing said about the switch: the default still draws the mock');
  for (const vars of [DARK_ST, LIGHT_ST]) for (const n of [30, 40, 50]) assert.deepEqual(at(n, vars, false), at(n, vars, true), `${n}%`);
});

test('dark, Off: the card sits farther from the flat colour as the strength rises (30% subtle, 50% as today, 90% lifted)', () => {
  const [d30, d50, d90] = [30, 50, 90].map(n => distance(at(n)['--su-panel'], FLAT.dark));
  assert.equal(d50, distance(GLASS_DARK['--su-panel'], FLAT.dark), '50% is today\'s card');
  assert.ok(d30 < d50 && d50 < d90, `${d30} < ${d50} < ${d90}`);
  assert.ok(d30 < 4 && d50 < 4, 'at 50% and under the card is as subtle as before');
  assert.ok(d90 - d30 >= 18, `30% to 90% moves the card ${d90 - d30} levels`);
  assert.equal(at(90)['--su-panel'], 'rgba(46,49,68,.98)');
  assert.equal(at(90)['--su-panel2'], 'rgba(49,52,72,.98)');
  assert.equal(at(90)['--su-line'], 'rgba(255,255,255,.15)');
  assert.equal(at(90)['--su-shadow'], '0 10px 30px rgba(0,0,0,.6)');
  assert.equal(at(70)['--su-panel'], 'rgba(37,40,56,.85)');
  for (const n of [30, 50, 60, 70, 80, 90]) {
    const tokens = at(n), card = over(tokens['--su-panel'], FLAT.dark);
    assert.ok(distance(tokens['--su-panel2'], FLAT.dark) >= distance(tokens['--su-panel'], FLAT.dark), `${n}%: buttons and tiles stay lighter than the card`);
    assert.ok(contrast(hex(GLASS_DARK['--su-muted']), card) >= 4.5, `${n}%: muted text keeps 4.5:1 on the card`);
    assert.ok(contrast(hex(GLASS_DARK['--su-muted']), over(tokens['--su-panel2'], card)) >= 4.5, `${n}%: muted text keeps 4.5:1 on a tile`);
  }
});

test('light, Off: the white card keeps moving off the flat colour, and its edge goes greyer and its shadow deeper above 50%', () => {
  const [d30, d50, d90] = [30, 50, 90].map(n => distance(at(n, LIGHT_ST)['--su-panel'], FLAT.light));
  assert.ok(d30 < d50 && d50 < d90, `${d30} < ${d50} < ${d90}`);
  assert.equal(at(90, LIGHT_ST)['--su-panel'], 'rgba(255,255,255,.98)', 'the light panels stay white (lighter than the flat)');
  assert.equal(at(90, LIGHT_ST)['--su-line'], 'rgba(30,34,52,.16)');
  assert.equal(at(90, LIGHT_ST)['--su-shadow'], '0 10px 30px rgba(40,30,80,.32)');
  assert.equal(at(70, LIGHT_ST)['--su-line'], 'rgba(143,145,154,.53)');
});

test('Off: only the strength tokens move, every step to 90% changes them, and the skin check takes every value', () => {
  for (const vars of [DARK_ST, LIGHT_ST]) {
    const base = vars === DARK_ST ? GLASS_DARK : GLASS_LIGHT;
    for (const n of [30, 60, 90]) for (const name of TOKENS.filter(t => !STRENGTH_TOKENS.includes(t))) assert.equal(at(n, vars)[name], base[name], `${name} at ${n}%`);
    const steps = [50, 60, 70, 80, 90].map(n => ['--su-panel', '--su-line', '--su-shadow'].map(name => at(n, vars)[name]).join());
    assert.equal(new Set(steps).size, steps.length);
    for (const n of [30, 51, 70, 90]) { const check = checkSkin(at(n, vars)); assert.equal(check.ok, true, check.errors.join('; ')); }
  }
  for (const name of STRENGTH_TOKENS) assert.equal(at(30, DARK_ST, false, 'sillytavern')[name], at(90, DARK_ST, false, 'sillytavern')[name], `Follow SillyTavern, Off: ${name}`);
});

test('mount: the look gets the Panel background switch, and flipping it draws the look again at once', () => {
  const doc = installFakeDom();
  const prefs = createPrefs({});
  const suite = mountSuite({ port: createFakePort(), doc, prefs, look: () => ({ glassStrength: 90 }) });
  const panel = () => suite.root.style.getPropertyValue('--su-panel');
  assert.equal(suite.root.getAttribute('data-panelbg'), 'off');
  assert.equal(panel(), 'rgba(46,49,68,.98)', 'Off by default: the lifted card');
  suite.settings();
  doc.body.querySelector('.si3[data-sec="look"]').click();
  doc.body.querySelector(`[data-key="${PANELBG_KEY}"] .sw`).click();
  assert.equal(suite.root.getAttribute('data-panelbg'), 'on');
  assert.equal(panel(), 'rgba(28,30,44,.98)', 'On: the strength alone');
  suite.destroy();
  const again = mountSuite({ port: createFakePort(), doc: installFakeDom(), prefs, look: () => ({ glassStrength: 90 }) });
  assert.equal(again.root.style.getPropertyValue('--su-panel'), 'rgba(28,30,44,.98)', 'a reload keeps On');
  again.destroy();
});
