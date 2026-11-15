import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderSettingsSection } from '../../../../ui/settings/sections/index.js';
import { createSettingsOverlay } from '../../../../ui/settings/overlay.js';

test('every fixture section but Add-ons has a renderer; unknown ids give null', () => {
  const doc = installFakeDom();
  const settings = buildSettings();
  const ctx = { doc, settings };
  for (const s of settings.sections) {
    const out = renderSettingsSection(s, ctx);
    if (s.id === 'addons') assert.equal(out, null); else assert.ok(Array.isArray(out), s.id);
  }
  assert.equal(renderSettingsSection({ id: 'zzz' }, ctx), null);
  assert.equal(renderSettingsSection(undefined, ctx), null);
});

test('the overlay renders each section through the hook, with the Start page first', () => {
  const doc = installFakeDom();
  const settings = buildSettings();
  const ov = createSettingsOverlay({ doc, settings, renderSection: renderSettingsSection });
  ov.open();
  assert.equal(ov.el.querySelectorAll('.spage .mod').length, 5);
  for (const s of settings.sections) {
    assert.equal(ov.show(s.id), true);
    assert.equal(ov.el.querySelector('.spage h2').textContent, s.name);
  }
  ov.show('people');
  assert.equal(ov.el.querySelectorAll('.spage .mod[data-mod="people"]').length, 1);
  ov.show('addons');
  assert.equal(ov.el.querySelectorAll('.spage .srow').length, 1);
});
