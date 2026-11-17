// Start: "Reset to Standard" redraws the open page at once from the switches the host now holds; an empty "Gone (decided)" list draws no heading.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';

test('Reset to Standard: the open page shows the reset switches and count without reopening', () => {
  const fresh = buildSettings({ rpg: true }).modules;   // what the host holds after the reset: RPG on, preset Standard
  fresh.preset = 'standard';
  const { page } = mountSettings({ modules: buildSettings({ rpg: false }).modules }, { onAction: () => ({ ok: true }), onView: name => (name === 'settings' ? { modules: fresh } : null) });
  const el = page('start');
  assert.equal(el.querySelector('.mod[data-mod="rpg"]').className, 'mod off');
  el.querySelectorAll('.btn2').find(b => b.textContent === 'Reset to Standard').click();
  const after = page('start');
  assert.equal(after.querySelector('.mod[data-mod="rpg"]').className, 'mod');
  assert.match(after.querySelector('.mod[data-mod="rpg"] .mc').textContent, /^3 of 3 on/);
});

test('a host that answers late (a promise) still redraws when the answer lands', async () => {
  const fresh = buildSettings({ rpg: true }).modules;
  const { page, ov } = mountSettings({ modules: buildSettings({ rpg: false }).modules }, { onAction: () => Promise.resolve({ ok: true }), onView: () => ({ modules: fresh }) });
  page('start').querySelectorAll('.btn2').find(b => b.textContent === 'Reset to Standard').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(ov.el.querySelector('.spage .mod[data-mod="rpg"]').className, 'mod');
});

test('no removed items: no "Gone (decided)" heading; with items it stays', () => {
  const none = mountSettings({ removed: [] }).page('start');
  assert.equal(none.querySelector('.removed'), null);
  assert.ok(!none.textContent.includes('Gone (decided)'));
  assert.ok(mountSettings().page('start').textContent.includes('Gone (decided)'));
});
