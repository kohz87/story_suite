import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../packages/story-block/tests/ui-fake-dom.js';
import { mountSuite } from '../../ui/mount.js';
import { createFakePort } from '../../ui/port/fake-port.js';

const manual = () => { const q = []; return { schedule: fn => q.push(fn), run: () => { while (q.length) q.shift()(); } }; };

test('rejects a port that breaks the contract', () => {
  const doc = installFakeDom();
  assert.throws(() => mountSuite({ port: {}, doc }), /working port/);
  assert.throws(() => mountSuite({ doc }), TypeError);
});

test('mounts closed; open draws card and Now; close and Escape work', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  const layer = doc.body.querySelector('.su-layer');
  assert.equal(layer.getAttribute('data-state'), 'closed');
  assert.equal(suite.open(), true);
  assert.equal(layer.getAttribute('data-state'), 'open');
  assert.ok(doc.body.querySelector('[data-tab="now"]'));
  assert.ok(doc.body.querySelector('[data-card="character"]'));
  assert.equal(suite.close(), true);
  assert.equal(layer.getAttribute('data-state'), 'closed');
  suite.open();
  doc.dispatchEvent?.({ type: 'keydown', key: 'Escape' });
  suite.destroy();
});

test('open(tab) switches tab and shows the pending card for an unfed tab', () => {
  const doc = installFakeDom();
  const full = createFakePort();
  const port = createFakePort({ views: { card: full.view('card'), now: full.view('now'), chat: full.view('chat') } });
  const suite = mountSuite({ port, doc });
  suite.open('world');
  assert.equal(suite.tabHost.current(), 'world');
  assert.ok(doc.body.querySelector('[data-pending="world"]'));
  suite.open('people');
  assert.ok(doc.body.querySelector('[data-pending="people"]'));
  assert.equal(doc.body.querySelector('[data-pending="world"]'), null);
  suite.open('now');
  assert.equal(doc.body.querySelector('[data-pending="people"]'), null);
  assert.ok(doc.body.querySelector('[data-tab="now"]'));
  suite.destroy();
});

test('tab and card renderers receive the view-models', () => {
  const doc = installFakeDom();
  const seen = [];
  const suite = mountSuite({
    port: createFakePort(), doc,
    tabs: { now: (vm) => { seen.push(Object.keys(vm)[0]); return doc.createElement('i'); } },
    card: () => doc.createElement('b'),
  });
  suite.open();
  assert.equal(seen.length, 1);
  assert.ok(doc.body.querySelector('.su-panel i'));
  assert.ok(doc.body.querySelector('.su-card-slot b'));
  suite.destroy();
});

test('flags come from the port: rpg off hides Party, fight open shows Fight', () => {
  const doc = installFakeDom();
  const off = mountSuite({ port: createFakePort({ variant: 'rpgOff' }), doc });
  assert.equal(off.tabHost.tabs().includes('party'), false);
  off.destroy();
  const fight = mountSuite({ port: createFakePort({ variant: 'fightOpen' }), doc });
  assert.equal(fight.tabHost.tabs().includes('fight'), true);
  fight.destroy();
  const forced = mountSuite({ port: createFakePort(), doc, flags: { rpg: false, fightOpen: true } });
  assert.deepEqual([forced.tabHost.tabs().includes('party'), forced.tabHost.tabs().includes('fight')], [false, true]);
  forced.destroy();
});

test('a port event updates flags and redraws through one coalesced frame', () => {
  const doc = installFakeDom();
  const f = manual();
  const port = createFakePort();
  const suite = mountSuite({ port, doc, schedule: f.schedule });
  suite.open();
  assert.equal(suite.tabHost.tabs().includes('fight'), false);
  port.setVariant('fightOpen', { notify: true });
  assert.equal(suite.tabHost.tabs().includes('fight'), true);
  port.emit('head'); port.emit('committed');
  f.run();
  suite.destroy();
});

test('themes: light and follow set the scheme; sky is written', () => {
  const doc = installFakeDom();
  const light = mountSuite({ port: createFakePort(), doc, theme: 'light' });
  assert.equal(light.root.getAttribute('data-scheme'), 'light');
  light.open();
  assert.ok(light.root.style.getPropertyValue('--su-sky'));
  light.destroy();
  const dark = mountSuite({ port: createFakePort(), doc, theme: 'dark' });
  assert.equal(dark.root.getAttribute('data-scheme'), 'dark');
  dark.destroy();
  const follow = mountSuite({ port: createFakePort(), doc, theme: 'follow' });
  assert.ok(['dark', 'light'].includes(follow.root.getAttribute('data-scheme')));
  follow.destroy();
});

test('destroy removes the layer, is repeatable and blocks open', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  suite.destroy();
  suite.destroy();
  assert.equal(doc.body.querySelector('.su-layer'), null);
  assert.equal(suite.open(), false);
});

function themeDoc(vars) {
  const doc = installFakeDom();
  const seen = [];
  class Fake {
    constructor(fn) { this.fn = fn; seen.push(this); }
    observe() {}
    disconnect() { this.off = true; }
  }
  doc.documentElement ??= { id: 'root' };
  doc.defaultView = { MutationObserver: Fake, getComputedStyle: () => ({ getPropertyValue: name => vars[name] ?? '' }) };
  return { doc, seen };
}

test('follow theme: an ST theme change re-applies the skin once; destroy stops watching', () => {
  const vars = { '--SmartThemeBodyColor': '#eeeeee', '--SmartThemeBlurTintColor': '#101010' };
  const { doc, seen } = themeDoc(vars);
  const suite = mountSuite({ port: createFakePort(), doc, theme: 'follow' });
  assert.equal(seen.length, 1);
  assert.equal(suite.root.getAttribute('data-scheme'), 'dark');
  vars['--SmartThemeBodyColor'] = '#111111';
  vars['--SmartThemeBlurTintColor'] = '#f5f5f5';
  seen[0].fn();
  assert.equal(suite.root.getAttribute('data-scheme'), 'light');
  assert.equal(suite.root.style.getPropertyValue('--su-text'), '#111111');
  suite.destroy();
  assert.equal(seen[0].off, true);
});

test('fixed themes do not watch ST', () => {
  for (const theme of ['dark', 'light']) {
    const { doc, seen } = themeDoc({});
    mountSuite({ port: createFakePort(), doc, theme }).destroy();
    assert.equal(seen.length, 0);
  }
});
