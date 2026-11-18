import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';
import { createPrefs } from '../../../ui/runtime/prefs.js';
import { PANELBG_KEY } from '../../../ui/settings/panel-bg.js';

const css = readFileSync(new URL('../../../ui/css/shell.css', import.meta.url), 'utf8');
const openLook = doc => { doc.body.querySelector('.si3[data-sec="look"]').click(); return doc.body.querySelector(`[data-key="${PANELBG_KEY}"] .sw`); };

test('the panel background is Off by default: the root says so and the CSS hides the backdrop layer', () => {
  const doc = installFakeDom();
  const suite = mountSuite({ port: createFakePort(), doc });
  assert.equal(suite.root.getAttribute('data-panelbg'), 'off');
  assert.match(css, /\.su-root\[data-panelbg="off"\] \.su-back \{\s*display: none;/);
  assert.match(css, /\.su-root\[data-panelbg="off"\] \{\s*background: var\(--su-flat/);
  suite.destroy();
});

test('the Look switch applies at once, is stored per device and is read again on the next mount', () => {
  const doc = installFakeDom();
  const prefs = createPrefs({});
  const suite = mountSuite({ port: createFakePort(), doc, prefs });
  suite.open('now');
  suite.settings();
  const sw = openLook(doc);
  assert.equal(sw.getAttribute('aria-checked'), 'false');
  sw.click();
  assert.equal(suite.root.getAttribute('data-panelbg'), 'on');
  assert.equal(prefs.getFold(PANELBG_KEY, false), true);
  suite.destroy();
  const again = mountSuite({ port: createFakePort(), doc: installFakeDom(), prefs });
  assert.equal(again.root.getAttribute('data-panelbg'), 'on', 'survives a reload');
  again.destroy();
});

test('turning it Off again hides the layer, and the switch keeps its state when the page is reopened', () => {
  const doc = installFakeDom();
  const prefs = createPrefs({});
  prefs.setFold(PANELBG_KEY, true);
  const port = createFakePort();
  const suite = mountSuite({ port, doc, prefs });
  assert.equal(suite.root.getAttribute('data-panelbg'), 'on');
  suite.settings();
  openLook(doc).click();
  assert.equal(suite.root.getAttribute('data-panelbg'), 'off');
  assert.equal(port.recorded.filter(c => c.type === 'settings.set').length, 0, 'a device setting, not a host one');
  suite.settings();
  assert.equal(openLook(doc).getAttribute('aria-checked'), 'false');
  suite.destroy();
});
