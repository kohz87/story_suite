// Device preferences (Panel background, Developer tools, folds) are kept in this device's storage: a new mount over the same storage reads them again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/ui-fake-dom.js';
import { mountSuite } from '../../ui/mount.js';
import { createFakePort } from '../../ui/port/fake-port.js';
import { PANELBG_KEY } from '../../ui/settings/panel-bg.js';

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()] }; };
const boot = storage => { const suite = mountSuite({ port: createFakePort(), doc: installFakeDom(), storage }); suite.open('now'); return suite; };
const flip = (suite, sec, key) => { suite.settings(); const doc = suite.root.ownerDocument; doc.body.querySelector(`.si3[data-sec="${sec}"]`).click(); doc.body.querySelector(`[data-key="${key}"] .sw`).click(); };

test('Panel background survives a reload', () => {
  const storage = memory();
  const first = boot(storage);
  assert.equal(first.root.getAttribute('data-panelbg'), 'off');
  flip(first, 'look', PANELBG_KEY);
  assert.equal(first.root.getAttribute('data-panelbg'), 'on');
  first.destroy();
  const again = boot(storage);
  assert.equal(again.root.getAttribute('data-panelbg'), 'on');
  again.destroy();
});

test('Developer tools survives a reload: the Tools page shows the developer cards', () => {
  const storage = memory();
  const first = boot(storage);
  flip(first, 'tools', 'dev.tools');
  first.destroy();
  const again = boot(storage);
  again.settings();
  const doc = again.root.ownerDocument;
  doc.body.querySelector('.si3[data-sec="tools"]').click();
  assert.equal(doc.body.querySelector('[data-key="dev.tools"] .sw').getAttribute('aria-checked'), 'true');
  assert.ok(doc.body.querySelector('[data-card="template"]'));
  again.destroy();
});

test('a store that throws keeps the preferences in memory, as before', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  const suite = boot(broken);
  flip(suite, 'look', PANELBG_KEY);
  assert.equal(suite.root.getAttribute('data-panelbg'), 'on');
  suite.destroy();
});
