// Settings › Look on a live host, through the Settings page's own controls: each change is stored, shows on the suite at once (no reload), and is
// there again after a reload (a new mount on the same stored settings). Reset Look puts the mock's Glass back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createHost } from '../../../testkit/index.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { mountSuite } from '../../../ui/mount.js';
import { GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';

const tick = async () => { for (let n = 0; n < 6; n += 1) await new Promise(resolve => setImmediate(resolve)); };
const ST = { '--SmartThemeBodyColor': '#dcdcd2', '--SmartThemeBlurTintColor': 'rgba(23,23,23,1)', '--mainFontFamily': '"Noto Sans", sans-serif' };

function stDoc(vars) {
  const doc = installFakeDom();
  doc.documentElement ??= { id: 'root' };
  const watchers = [];
  class Observer { constructor(fn) { watchers.push(fn); } observe() {} disconnect() {} }
  doc.defaultView = { MutationObserver: Observer, getComputedStyle: () => ({ getPropertyValue: name => vars[name] ?? '' }) };
  return { doc, themeChanged: () => { for (const fn of watchers) fn(); } };
}

async function live(t, vars = ST) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) }, features: { set: (id, on) => host.features.set(id, on) } };
  const mount = () => {
    const { doc, themeChanged } = stDoc(vars);
    const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk) });
    const suite = mountSuite({ port, doc, look: () => host.sdk.settings() });
    t.after(() => suite.destroy());
    return { doc, suite, themeChanged };
  };
  return { host, mount };
}

// Opens Settings › Look and returns its row for `name` (`host.<name>`).
async function lookRow(doc, suite, name) {
  if (!doc.querySelector('.srow[data-key="host.panelStyle"]')) {
    suite.settings();
    await tick();
    doc.querySelector('.si3[data-sec="look"]').click();
    await tick();
  }
  return doc.querySelector(`.srow[data-key="host.${name}"]`);
}
const press = async (row, label) => { [...row.querySelectorAll('button')].find(b => b.textContent === label).click(); await tick(); };
const panel = suite => suite.root.style.getPropertyValue('--su-panel');

test('the defaults draw the mock\'s Glass (dark here: SillyTavern\'s theme is dark) with no text zoom', async t => {
  const { mount } = await live(t);
  const { suite } = mount();
  assert.equal(suite.root.getAttribute('data-scheme'), 'dark');
  for (const name of ['--su-panel', '--su-panel2', '--su-text', '--su-font', '--su-blur']) assert.equal(suite.root.style.getPropertyValue(name), GLASS_DARK[name], name);
  assert.equal(suite.root.hasAttribute('data-text'), false);
});

test('Panel style: Follow SillyTavern takes its colours at once and after a reload; Glass gives them back', async t => {
  const { host, mount } = await live(t);
  const { doc, suite } = mount();
  await press(await lookRow(doc, suite, 'panelStyle'), 'Follow SillyTavern');
  assert.equal(host.sdk.settings().panelStyle, 'sillytavern', 'stored');
  assert.equal(panel(suite), 'rgba(23,23,23,1)', 'shown at once');
  assert.equal(suite.root.style.getPropertyValue('--su-text'), '#dcdcd2');
  assert.equal(panel(mount().suite), 'rgba(23,23,23,1)', 'after a reload');
  await press(await lookRow(doc, suite, 'panelStyle'), 'Glass');
  assert.equal(panel(suite), GLASS_DARK['--su-panel']);
});

test('Glass strength: the panels\' alpha follows the number at once and after a reload', async t => {
  const { host, mount } = await live(t);
  const { doc, suite } = mount();
  const input = (await lookRow(doc, suite, 'glassStrength')).querySelector('input');
  input.value = '80';
  input.dispatchEvent(new globalThis.Event('change'));
  await tick();
  assert.equal(host.sdk.settings().glassStrength, 80);
  // Panel background is Off (the device default), so above 50% the panels are also lifted off the flat colour (glass-flat.test.js).
  assert.equal(panel(suite), 'rgba(42,44,62,.92)');
  assert.equal(suite.root.style.getPropertyValue('--su-panel2'), 'rgba(46,49,68,.96)');
  assert.equal(panel(mount().suite), 'rgba(42,44,62,.92)', 'after a reload');
});

test('Font: the theme\'s font, then Nunito again, at once; after a reload', async t => {
  const { mount } = await live(t);
  const { doc, suite } = mount();
  await press(await lookRow(doc, suite, 'font'), 'Your theme\'s font');
  assert.equal(suite.root.style.getPropertyValue('--su-font'), 'var(--mainFontFamily, system-ui, sans-serif)');
  assert.equal(mount().suite.root.style.getPropertyValue('--su-font'), 'var(--mainFontFamily, system-ui, sans-serif)', 'after a reload');
  await press(await lookRow(doc, suite, 'font'), 'Nunito (soft and round)');
  assert.equal(suite.root.style.getPropertyValue('--su-font'), GLASS_DARK['--su-font']);
});

test('Text size: 120% and 110% set the root\'s data-text (the zoom in shell.css) at once and after a reload; Normal takes it away', async t => {
  const { mount } = await live(t);
  const { doc, suite } = mount();
  await press(await lookRow(doc, suite, 'textSize'), '120%');
  assert.equal(suite.root.getAttribute('data-text'), '120');
  await press(await lookRow(doc, suite, 'textSize'), '110%');
  assert.equal(suite.root.getAttribute('data-text'), '110');
  assert.equal(mount().suite.root.getAttribute('data-text'), '110', 'after a reload');
  await press(await lookRow(doc, suite, 'textSize'), 'Normal');
  assert.equal(suite.root.hasAttribute('data-text'), false);
});

test('Send pending note: the switch stores settings().sendPending (nothing reads it since the old view went at B4-4)', async t => {
  const { host, mount } = await live(t);
  const { doc, suite } = mount();
  const row = await lookRow(doc, suite, 'sendPending');
  assert.equal(host.sdk.settings().sendPending, true);
  row.querySelector('.sw').click();
  await tick();
  assert.equal(host.sdk.settings().sendPending, false);
});

test('a SillyTavern theme change re-reads the look: light Glass for a light theme, the reader\'s strength kept', async t => {
  const vars = { ...ST };
  const { host, mount } = await live(t, vars);
  host.settings.set(null, 'glassStrength', 30);
  const { suite, themeChanged } = mount();
  assert.equal(panel(suite), 'rgba(28,30,44,.52)');
  Object.assign(vars, { '--SmartThemeBodyColor': '#222222', '--SmartThemeBlurTintColor': 'rgba(245,245,245,1)' });
  themeChanged();
  assert.equal(suite.root.getAttribute('data-scheme'), 'light');
  assert.equal(panel(suite), 'rgba(255,255,255,.52)');
  assert.equal(suite.root.style.getPropertyValue('--su-text'), GLASS_LIGHT['--su-text']);
});

test('Reset Look puts the mock\'s Glass back at once', async t => {
  const { host, mount } = await live(t);
  for (const [key, value] of [['panelStyle', 'sillytavern'], ['textSize', '120'], ['font', 'theme']]) host.settings.set(null, key, value);
  const { doc, suite } = mount();
  assert.equal(suite.root.getAttribute('data-text'), '120');
  await lookRow(doc, suite, 'panelStyle');
  const reset = [...doc.querySelectorAll('button')].find(b => b.textContent === 'Reset Look to defaults');
  assert.ok(reset, 'the page\'s Reset Look to defaults');
  reset.click();
  await tick();
  assert.equal(host.sdk.settings().panelStyle, 'glass');
  assert.equal(panel(suite), GLASS_DARK['--su-panel']);
  assert.equal(suite.root.hasAttribute('data-text'), false);
});
