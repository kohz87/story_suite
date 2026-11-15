import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { applyTheme, checkSkin } from '../../../ui/theme/apply.js';
import { GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';

test('checkSkin accepts valid colours, lengths, fonts, gradients, shadows and vars', () => {
  const res = checkSkin({
    '--su-text': '#ffffff',
    '--su-panel': 'rgba(20, 22, 30, 0.75)',
    '--su-soft': 'color-mix(in srgb, #fff 80%, transparent)',
    '--su-accent': 'oklch(0.7 0.15 260)',
    '--su-muted': 'var(--SmartThemeEmColor, #999)',
    '--su-blur': '12px',
    '--su-font': '"Nunito", system-ui, sans-serif',
    '--su-shadow': '0 10px 30px rgba(0, 0, 0, 0.4)',
    '--su-back': 'linear-gradient(135deg, #111 0%, #333 100%)',
  });
  assert.equal(res.ok, true, res.errors.join('; '));
  assert.deepEqual(res.errors, []);
});

test('checkSkin refuses non-objects, unknown tokens, injection and invalid types', () => {
  assert.equal(checkSkin(null).ok, false);
  assert.equal(checkSkin([]).ok, false);

  const bad = checkSkin({
    '--unknown-token': '#fff',
    '--su-text': 'red; background: url(https://evil.example/x.png)',
    '--su-panel': 'url(https://evil.example/bg.png)',
    '--su-accent': 'expression(alert(1))',
    '--su-blur': 'red',
    '--su-font': '16px',
    '--su-shadow': 'not-a-shadow',
    '--su-back': 'javascript:alert(1)',
    '--su-hp': '',
    '--su-mp': 123,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 10);
  assert.deepEqual(bad.valid, {});
});

test('applyTheme writes valid tokens onto root.style and refuses invalid ones', () => {
  const doc = installFakeDom();
  const root = doc.createElement('div');
  const res = applyTheme(root, {
    ...GLASS_DARK,
    '--su-text': 'bad; value',
    '--su-blur': 'not-a-length',
  }, { scheme: 'dark' });

  assert.equal(res.ok, false);
  assert.equal(res.rejected.length, 2);
  assert.equal(root.getAttribute('data-scheme'), 'dark');
  assert.equal(root.style.getPropertyValue('--su-accent'), GLASS_DARK['--su-accent']);
  assert.equal(root.style.getPropertyValue('--su-text'), '');
  assert.equal(root.style.getPropertyValue('--su-blur'), '');
});

test('applyTheme succeeds cleanly for GLASS_LIGHT and throws on invalid root', () => {
  const doc = installFakeDom();
  const root = doc.createElement('div');
  const res = applyTheme(root, GLASS_LIGHT, { scheme: 'light' });
  assert.equal(res.ok, true);
  assert.equal(res.rejected.length, 0);
  assert.equal(root.getAttribute('data-scheme'), 'light');
  assert.equal(root.style.getPropertyValue('--su-font'), GLASS_LIGHT['--su-font']);
  assert.throws(() => applyTheme(null, GLASS_LIGHT), TypeError);
});
