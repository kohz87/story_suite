// The new view as SillyTavern mounts it (ui/entry/turn-on.js) reads Settings › Look from the host's stored settings: a value stored before the mount
// (a reload) and one stored while it runs both show when the suite opens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';
import { GLASS_DARK } from '../../ui/theme/tokens.js';

const open = async doc => { doc.querySelector('#story-suite-ui-menu')?.click(); await settle(); return doc.querySelector('.su-root'); };

test('turnOn: the suite opens in the stored Look (font, text size, glass strength), and a change shows on the next open', async t => {
  const { doc, host } = await livePage(t);
  const root = await open(doc);
  assert.ok(root, 'the suite root');
  assert.equal(root.style.getPropertyValue('--su-font'), GLASS_DARK['--su-font']);
  assert.equal(root.hasAttribute('data-text'), false);
  host.settings.set(null, 'font', 'theme');
  host.settings.set(null, 'textSize', '120');
  host.settings.set(null, 'glassStrength', 30);
  await open(doc);
  assert.equal(root.style.getPropertyValue('--su-font'), 'var(--mainFontFamily, system-ui, sans-serif)');
  assert.equal(root.getAttribute('data-text'), '120');
  assert.equal(root.style.getPropertyValue('--su-panel'), 'rgba(28,30,44,.52)');
});
