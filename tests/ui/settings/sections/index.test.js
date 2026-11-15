import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderSettingsSection } from '../../../../ui/settings/sections/index.js';
import { createSettingsOverlay } from '../../../../ui/settings/overlay.js';

test('sections with their own notes have a renderer; Models, Packs, Tools, Add-ons and unknown ids give null (the default body)', () => {
  const doc = installFakeDom();
  const settings = buildSettings();
  const ctx = { doc, settings };
  for (const s of settings.sections) {
    const out = renderSettingsSection(s, ctx);
    const hooked = ['models', 'packs', 'tools', 'addons'].includes(s.id);
    if (hooked) assert.equal(out, null, s.id); else assert.ok(Array.isArray(out), s.id);
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
  assert.equal(ov.el.querySelectorAll('.spage .pre').length, 3);
  for (const s of settings.sections) {
    assert.equal(ov.show(s.id), true);
    assert.equal(ov.el.querySelector('.spage h2').textContent, s.name);
  }
  ov.show('people');
  assert.equal(ov.el.querySelectorAll('.spage .mod[data-mod="people"]').length, 1);
  for (const id of ['start', 'people', 'models', 'packs', 'tools']) {
    ov.show(id);
    assert.equal(ov.el.querySelectorAll('.spage h2').length, 1, id);
    assert.ok(ov.el.querySelectorAll('.spage .applies').length <= 1, id);
  }
  ov.show('addons');
  assert.equal(ov.el.querySelectorAll('.spage .srow').length, settings.sections.find(s => s.id === 'addons').rows.length);
});
