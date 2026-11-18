// A page's rows grey out (and stop taking input) while its module card is off, through the real selectors and the real overlay; they work again when it is on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettings } from '../../../core/sdk/settings.js';
import { SETTINGS_SCHEMA, SETTINGS_DEFAULTS } from '../../../modules/people/meters/npc-meters-schema.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';

const ID = 'npc-state-delta';
const features = on => [
  { id: 'npc-state-delta.stages', moduleId: ID, moduleName: 'NPC State', label: 'Stage ladders and milestones', on },
  { id: 'npc-state-delta.presets', moduleId: ID, moduleName: 'NPC State', label: 'Meter presets and rules', on },
];

function open(on) {
  const doc = installFakeDom();
  const tree = { storySuite: { modules: { [ID]: {} } } };
  const settings = createSettings({ root: () => tree, registry: { module: () => ({ settings: { defaults: SETTINGS_DEFAULTS, schema: SETTINGS_SCHEMA } }) } });
  const log = [];
  const state = { on };
  const view = () => selectSettings({ features: features(state.on), people: settings(ID) });
  const ov = createSettingsOverlay({
    doc, settings: view(), renderSection: renderSettingsSection, onView: name => (name === 'settings' ? view() : null),
    onChange: (key, value) => { log.push([key, value]); if (key.startsWith('modules.chat.npc-state-delta')) state.on = key.endsWith('npc-state-delta') ? value : state.on; return { ok: true }; },
    onAction: () => ({ ok: true }),
  });
  ov.open('people');
  return { ov, log, page: () => ov.el.querySelector('.spage') };
}
const rows = page => page.querySelectorAll('.sgrp .srow');

test('module off: every setting row is greyed and disabled, with one line why; the module card stays live', () => {
  const { page } = open(false);
  const p = page();
  assert.ok(rows(p).length > 5);
  for (const r of rows(p)) assert.ok(r.classList.contains('dis'), `row ${r.dataset?.key} greyed`);
  for (const c of p.querySelectorAll('.sgrp input,.sgrp select,.sgrp button:not(.gt)')) assert.ok(c.hasAttribute('disabled'));
  assert.equal(p.querySelectorAll('.offnote').length, 1);
  assert.match(p.querySelector('.offnote').textContent, /NPC State is off/);
  assert.equal(p.querySelector('.mods .sw').hasAttribute('disabled'), false);
});

test('module on: no row is greyed and there is no note', () => {
  const { page } = open(true);
  const p = page();
  assert.equal(p.querySelectorAll('.srow.dis').length, 0);
  assert.equal(p.querySelectorAll('.offnote').length, 0);
});

test('switching the card on draws the page live again, and off greys it again', () => {
  const { page } = open(false);
  page().querySelector('.mods .sw').click();
  assert.equal(page().querySelectorAll('.offnote').length, 0);
  assert.equal(page().querySelectorAll('.srow.dis').length, 0);
  page().querySelector('.mods .sw').click();
  assert.equal(page().querySelectorAll('.offnote').length, 1);
});
