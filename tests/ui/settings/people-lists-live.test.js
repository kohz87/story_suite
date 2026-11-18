// Settings › People's list editors on a live settings store: Custom feelings, Feeling presets, Per-feeling stages and the Stage ladder store
// NPC State's own keys through the port, the page reads them back, and a new overlay shows what was stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createSettings } from '../../../core/sdk/settings.js';
import { SETTINGS_SCHEMA, SETTINGS_DEFAULTS } from '../../../modules/people/meters/npc-meters-schema.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { peopleCommand } from '../../../ui/port/people-settings.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';

const ID = 'npc-state-delta';
const FEATURES = on => [{ id: 'npc-state-delta.stages', moduleId: ID, moduleName: 'NPC State', label: 'Stage ladders and milestones', on }, { id: 'npc-state-delta.presets', moduleId: ID, moduleName: 'NPC State', label: 'Meter presets and rules', on: true }];

function live(stored = {}, { stagesOn = true } = {}) {
  const doc = installFakeDom();
  const tree = { storySuite: { modules: { [ID]: structuredClone(stored) } } };
  const settings = createSettings({ root: () => tree, registry: { module: id => (id === ID ? { settings: { defaults: SETTINGS_DEFAULTS, schema: SETTINGS_SCHEMA } } : null) } });
  const writes = { settings: { set: settings.set } };
  const bucket = () => settings(ID);
  const view = () => selectSettings({ features: FEATURES(stagesOn), people: bucket() });
  const open = () => {
    const ov = createSettingsOverlay({
      doc, settings: view(), renderSection: renderSettingsSection, onView: name => (name === 'settings' ? view() : null),
      onChange: async (key, value) => peopleCommand('settings.set', { key, value }, writes, bucket), onAction: () => ({ ok: true }),
    });
    ov.open('people');
    return ov;
  };
  return { stored: () => tree.storySuite.modules[ID], bucket, view, open, page: ov => ov.el.querySelector('.spage') };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const button = (root, text) => root.querySelectorAll('button').find(b => b.textContent === text);
const field = (root, f) => root.querySelector(`[data-f="${f}"]`);
async function type(root, f, value) {
  const el = field(root, f);
  el.value = String(value);
  el.dispatch('change');
  await settle();
}

test('the fixed four-feelings row is gone; the four list rows draw in the mock\'s places and fit the contract', () => {
  const s = live();
  assert.deepEqual(checkShape(s.view(), SETTINGS_SHAPE), []);
  const rows = s.view().sections.find(x => x.id === 'people').rows;
  assert.equal(rows.some(r => r.key === 'people.meters' || r.label === 'The four feelings'), false);
  assert.deepEqual(rows.filter(r => r.group === 'Feelings').map(r => [r.label, r.type]), [['Custom feelings', 'btn'], ['Feeling presets (up to 12)', 'chips'], ['Starting values', 'multi'], ['Per-feeling stages', 'btn']]);
  const page = s.page(s.open());
  assert.equal(page.textContent.includes('The four feelings'), false);
  assert.equal(page.querySelectorAll('.srow').find(r => r.dataset.key === 'people.presets').querySelectorAll('.chips3 button').map(b => b.textContent).join('|'), 'Companion|Rival|Mentor');
});

test('Custom feelings: Add a meter stores one, a rename and new limits are stored, Remove takes it out; a new overlay reads them back', async () => {
  const s = live({ stages: [{ meter: 'trust', at: 40, name: 'Warm' }] });
  const ov = s.open();
  const page = s.page(ov);
  button(page, 'Add a meter').click();
  await settle();
  assert.deepEqual(s.stored().customMeters.map(m => [m.name, m.min, m.max, m.start, m.show, m.tone]), [['New meter', 0, 100, 0, 'bar', 'neutral']]);
  const box = page.querySelector('[data-edit="people.customMeters"]');
  await type(box, '0.name', 'Fear');
  await type(box, '0.max', 50);
  await type(box, '0.min', -50);
  await type(box, '0.describe', 'rises with threats');
  assert.deepEqual(s.stored().customMeters.map(m => [m.name, m.min, m.max, m.describe]), [['Fear', -50, 50, 'rises with threats']]);
  assert.equal(field(page.querySelector('[data-edit="people.customMeters"]'), '0.name').value, 'Fear', 'the editor shows the stored name');
  const again = s.page(s.open());
  assert.equal(field(again.querySelector('[data-edit="people.customMeters"]'), '0.min').value, '-50', 'a new overlay reads it back');
  button(again.querySelector('[data-edit="people.customMeters"]'), 'Remove').click();
  await settle();
  assert.deepEqual(s.stored().customMeters, []);
  assert.deepEqual(s.stored().stages, [{ meter: 'trust', at: 40, name: 'Warm' }], 'the stages are untouched');
});

test('Custom feelings: a meter the engine does not use is marked; renaming one moves the stages that name it', async () => {
  const s = live({ customMeters: [{ name: 'Fear', min: 0, max: 100 }, { name: 'Trust', min: 0, max: 100 }], stages: [{ meter: 'fear', at: 30, name: 'Uneasy' }] });
  const page = s.page(s.open());
  const box = page.querySelector('[data-edit="people.customMeters"]');
  assert.deepEqual(box.querySelectorAll('.erow').map(r => r.className.includes('unused')), [false, true]);
  assert.match(box.querySelector('.erow.unused .eun').textContent, /^Not used/);
  await type(box, '0.name', 'Dread');
  assert.deepEqual(s.stored().stages, [{ meter: 'Dread', at: 30, name: 'Uneasy' }]);
  button(page, 'Add a meter').click();
  await settle();
  assert.equal(s.stored().customMeters.length, 3);
});

test('Feeling presets: chips store the ids in the order they were turned on, and a turned-off chip leaves', async () => {
  const s = live();
  const page = () => s.page(s.open());
  const chip = (name) => page().querySelectorAll('.srow').find(r => r.dataset.key === 'people.presets').querySelectorAll('.chips3 button').find(b => b.textContent === name);
  chip('Rival').click();
  await settle();
  chip('Companion').click();
  await settle();
  assert.deepEqual(s.stored().presets, ['rival', 'companion']);
  assert.equal(chip('Rival').getAttribute('aria-pressed'), 'true');
  chip('Rival').click();
  await settle();
  assert.deepEqual(s.stored().presets, ['companion']);
});

test('Per-feeling stages: Edit opens the editor (aria-expanded); a stage is added, moved and renamed on a custom meter; a repeat threshold is marked', async () => {
  const s = live({ customMeters: [{ name: 'Fear', min: 0, max: 100 }] });
  const page = s.page(s.open());
  const edit = page.querySelectorAll('.srow').find(r => r.dataset.key === 'people.perMeterStages').querySelector('button');
  const box = page.querySelector('[data-edit="people.perMeterStages"]');
  assert.equal(edit.getAttribute('aria-expanded'), 'false');
  assert.equal(box.hasAttribute('hidden'), true);
  edit.click();
  assert.equal(edit.getAttribute('aria-expanded'), 'true');
  button(box, 'Add a stage').click();
  await settle();
  assert.deepEqual(s.stored().stages, [{ meter: 'Trust', at: 25, name: 'New stage' }]);
  assert.deepEqual(field(box, '0.meter').querySelectorAll('option').map(o => o.textContent), ['Trust', 'Affection', 'Desire', 'Tension', 'Fear']);
  await type(box, '0.meter', 'Fear');
  await type(box, '0.at', 60);
  await type(box, '0.name', 'Terrified');
  assert.deepEqual(s.stored().stages, [{ meter: 'Fear', at: 60, name: 'Terrified' }]);
  button(box, 'Add a stage').click();
  await settle();
  await type(box, '1.meter', 'Fear');
  await type(box, '1.at', 60);
  assert.deepEqual(box.querySelectorAll('.erow').map(r => r.className.includes('unused')), [false, true]);
  edit.click();
  assert.equal(box.hasAttribute('hidden'), true);
});

test('Stage ladder: a rung is added with what it needs, edited and removed; with stage ladders off the editor says it is kept but not used', async () => {
  const s = live({}, { stagesOn: false });
  const page = s.page(s.open());
  const edit = page.querySelectorAll('.srow').find(r => r.dataset.key === 'people.stageLadder').querySelector('button');
  edit.click();
  const box = page.querySelector('[data-edit="people.stageLadder"]');
  assert.match(box.querySelector('.fine').textContent, /is off .*kept but not used/);
  button(box, 'Add a stage').click();
  await settle();
  assert.deepEqual(s.stored().ladder, [{ name: 'New stage', needs: 'trust 20', milestone: '', track: '' }]);
  await type(box, '0.name', 'Confidant');
  await type(box, '0.needs', 'trust 60, affection 40');
  await type(box, '0.milestone', 'saved her brother');
  assert.deepEqual(s.stored().ladder, [{ name: 'Confidant', needs: 'trust 60, affection 40', milestone: 'saved her brother', track: '' }]);
  await type(box, '0.needs', '');
  await type(box, '0.milestone', '');
  assert.equal(box.querySelectorAll('.erow.unused').length, 1, 'a rung with no needs and no milestone is not used');
  button(box, 'Remove').click();
  await settle();
  assert.deepEqual(s.stored().ladder, []);
});

test('a refused save is said under the editor, and Reset People leaves the four lists alone', async () => {
  const s = live({ customMeters: [{ name: 'Fear' }], ladder: [{ name: 'Friend', needs: 'trust 20' }], presets: ['rival'] });
  const writes = { settings: { set: (id, key, value) => (key === 'customMeters' ? undefined : value) } };
  const doc = installFakeDom();
  const ov = createSettingsOverlay({ doc, settings: s.view(), renderSection: renderSettingsSection, onChange: async (key, value) => peopleCommand('settings.set', { key, value }, writes, s.bucket), onAction: () => {} });
  ov.open('people');
  const page = ov.el.querySelector('.spage');
  button(page, 'Add a meter').click();
  await settle();
  assert.equal(page.querySelector('[data-edit="people.customMeters"] .eerr').textContent, 'That setting was not saved.');
  const store = {};
  peopleCommand('settings.action', { key: 'settings.reset', value: 'Reset People to defaults' }, { settings: { set: (_id, key, value) => { store[key] = value; return value; } } }, () => ({}));
  for (const key of ['customMeters', 'stages', 'ladder', 'presets']) assert.equal(Object.hasOwn(store, key), false, key);
  assert.equal(peopleCommand('settings.action', { key: 'people.customMeters', value: 'Add a meter' }, writes, () => ({})).ok, false, 'from search, the button says where to edit');
});

test('a field edit changes the editor in place: the Remove button and the next field are the same nodes, and two quick edits both land', async () => {
  const s = live({ customMeters: [{ name: 'Fear', min: 0, max: 100 }, { name: 'Debt', min: 0, max: 100 }] });
  const page = s.page(s.open());
  const box = page.querySelector('[data-edit="people.customMeters"]');
  const remove = box.querySelectorAll('.erow')[1].querySelector('.btn2');
  const min = field(box, '0.min');
  field(box, '0.name').value = 'Dread';
  field(box, '0.name').dispatch('change');
  min.value = '7';
  min.dispatch('change');
  await settle();
  assert.equal(box.querySelectorAll('.erow')[1].querySelector('.btn2'), remove, 'the Remove button was not drawn again');
  assert.equal(field(box, '0.min'), min, 'the next field was not drawn again');
  assert.deepEqual(s.stored().customMeters.map(m => [m.name, m.min]), [['Dread', 7], ['Debt', 0]]);
  await type(box, '1.name', 'Dread');
  assert.equal(box.querySelectorAll('.erow')[1].className.includes('unused'), true, 'the mark is set in place');
  assert.equal(box.querySelectorAll('.erow')[1].querySelector('.btn2'), remove);
});

test('the People page reads its rows again on a repaint: picked presets stay pressed after a module switch, and the next pick keeps them', async () => {
  const s = live();
  const ov = s.open();
  const chip = name => s.page(ov).querySelectorAll('.srow').find(r => r.dataset.key === 'people.presets').querySelectorAll('.chips3 button').find(b => b.textContent === name);
  chip('Rival').click();
  await settle();
  s.page(ov).querySelector('.mh .sw').click();   // the module switch repaints the page
  assert.equal(chip('Rival').getAttribute('aria-pressed'), 'true');
  chip('Mentor').click();
  await settle();
  assert.deepEqual(s.stored().presets, ['rival', 'mentor']);
});
