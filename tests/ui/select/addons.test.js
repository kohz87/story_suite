import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { selectAddons } from '../../../ui/select/addons.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';

// Shape recorded from core/sdk-parts/create.js:238 (sdk.modules()).
const MODULES = [
  { id: 'people', name: 'People', version: '1.4.0', status: 'ready', reason: null },
  { id: 'rpg', name: 'RPG', version: '2.0.1', status: 'dormant', reason: null },
  { id: 'time', name: 'World', version: '', status: 'restore-pending', reason: 'a restore is running' },
];
const byKey = (rows, key) => rows.find(r => r.key === key);

describe('selectAddons', () => {
  it('lists the installed modules live, with versions and why one is not running', () => {
    const row = byKey(selectAddons(MODULES), 'addons.installedModules');
    assert.equal(row.value, 'People 1.4.0, RPG 2.0.1 · waiting for a module it needs, World · a restore is running');
  });

  it('says "none yet" with no modules, and for a missing answer', () => {
    assert.equal(byKey(selectAddons([]), 'addons.installedModules').value, 'none yet');
    assert.equal(byKey(selectAddons(null), 'addons.installedModules').value, 'none yet');
  });

  it('custom views is shown as off, a fact and not a setting (no key is read or written)', () => {
    const row = byKey(selectAddons(MODULES), 'addons.customViews');
    assert.deepEqual([row.type, row.value], ['info', 'off · not available yet']);
  });
});

describe('Add-ons in the live settings view-model', () => {
  const vm = selectSettings({ host: {}, schema: {}, defaults: {}, features: [], modules: MODULES });

  it('sits after Packs and before Tools (mock v7 order; Director sits after World and time, drawn with its defaults) and matches the contract shape', () => {
    assert.deepEqual(vm.sections.map(s => s.id), ['start', 'look', 'people', 'rpg', 'world', 'director', 'money', 'extras', 'models', 'packs', 'addons', 'tools']);
    assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  });

  it('the builder passes sdk.modules() through, read each time the overlay opens', () => {
    let live = MODULES.slice(0, 1);
    const sdk = { settings: Object.assign(() => ({}), { defaults: {}, schema: {} }), features: () => [], modules: () => live };
    const read = buildSelectors(() => null, sdk).settings;
    assert.match(byKey(read().sections.find(s => s.id === 'addons').rows, 'addons.installedModules').value, /^People 1\.4\.0$/);
    live = [];
    assert.equal(byKey(read().sections.find(s => s.id === 'addons').rows, 'addons.installedModules').value, 'none yet');
  });

  it('the page draws on the live host data with no errors and no writing control', () => {
    const doc = installFakeDom();
    const calls = [];
    const ov = createSettingsOverlay({ doc, settings: vm, renderSection: renderSettingsSection, onChange: (...a) => calls.push(a), onAction: (...a) => calls.push(a) });
    ov.open();
    ov.show('addons');
    const page = ov.el.querySelector('.spage');
    assert.equal(page.querySelectorAll('.srow').length, 2);
    assert.match(page.querySelector('[data-key="addons.installedModules"] .sinfo').textContent, /People 1\.4\.0/);
    assert.equal(page.querySelectorAll('.ctl .sw, .ctl select, .ctl input, .ctl button').length, 0);
    assert.deepEqual(calls, []);
  });
});
