// Settings › Look: the hints of Panel style and Glass strength, read from the live page's real rows, do not mention the dropped Solid skin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createHost } from '../../../testkit/index.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { mountSuite } from '../../../ui/mount.js';

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
async function hints(t) {
  const { mount } = await live(t);
  const { doc, suite } = mount();
  suite.settings();
  await tick();
  doc.querySelector('.si3[data-sec="look"]').click();
  await tick();
  const hint = key => doc.querySelector(`.srow[data-key="host.${key}"] small`)?.textContent ?? '';
  return { panelStyle: hint('panelStyle'), glassStrength: hint('glassStrength') };
}

test('Panel style hint describes only Glass and Follow SillyTavern', async t => {
  const { panelStyle } = await hints(t);
  assert.match(panelStyle, /Glass: see-through panels/);
  assert.match(panelStyle, /Follow SillyTavern: its own colours and blur only/);
  assert.doesNotMatch(panelStyle, /solid|reduce transparency/i);
});

test('Glass strength hint says Follow SillyTavern ignores it, not Solid', async t => {
  const { glassStrength } = await hints(t);
  assert.match(glassStrength, /Follow SillyTavern ignores it/);
  assert.doesNotMatch(glassStrength, /solid/i);
});
