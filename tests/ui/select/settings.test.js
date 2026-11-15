import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { selectSettings } from '../../../ui/select/settings.js';

// Recorded from packages/story-block/src/v2/sdk/constants.js:10 (HOST_SETTINGS_DEFAULTS), :11-60 (HOST_SETTINGS_SCHEMA, text trimmed).
const DEFAULTS = { tailBudget: 1500, contextShare: 40, maxChangeLines: 150, callQueue: true, panelStyle: 'glass', glassStrength: 50, font: 'nunito', textSize: '100', sendPending: true };
const SCHEMA = {
  tailBudget: { type: 'int', min: 100, max: 20000, label: 'Notes per reply (tokens)', help: 'The most added to each prompt.' },
  contextShare: { type: 'int', min: 10, max: 90, label: 'Share of the context (%)', help: 'Share of context.' },
  maxChangeLines: { type: 'int', min: 10, max: 1000, label: 'Change lines per reply' },
  callQueue: { type: 'bool', label: 'Run extra calls one at a time per connection' },
  panelStyle: { type: 'choice', label: 'Panel style', options: [{ value: 'glass', label: 'Glass' }, { value: 'solid', label: 'Solid' }, { value: 'sillytavern', label: 'Follow SillyTavern' }] },
  glassStrength: { type: 'int', min: 30, max: 90, form: 'slider', label: 'Glass strength (%)' },
  font: { type: 'choice', label: 'Font', options: [{ value: 'nunito', label: 'Nunito (soft and round)' }, { value: 'theme', label: 'Your theme\'s font' }] },
  textSize: { type: 'choice', form: 'segmented', label: 'Text size', options: [{ value: '100', label: 'Normal' }, { value: '110', label: '110%' }, { value: '120', label: '120%' }] },
  sendPending: { type: 'bool', label: 'Send pending note' },
};
// Recorded from packages/story-block/src/v2/features.js:303 (store.list(): registry.features() + on).
const FEATURES = [
  { id: 'rpg.fights', moduleId: 'rpg', moduleName: 'RPG', label: 'Fights', describe: 'Fight board', default: true, presets: { lean: false }, available: true, on: true },
  { id: 'rpg.gear', moduleId: 'rpg', moduleName: 'RPG', label: 'Gear', describe: 'Worn gear', default: true, presets: { lean: false }, available: true, on: true },
  { id: 'world.weather', moduleId: 'world', moduleName: 'World', label: 'Weather', describe: 'Rolled weather', default: true, available: false, why: 'needs the story clock', on: false },
];
const HOST = { ...DEFAULTS };
const answers = (over = {}) => ({ host: HOST, defaults: DEFAULTS, schema: SCHEMA, features: FEATURES, ...over });
const rowOf = (vm, sec, key) => vm.sections.find(s => s.id === sec).rows.find(r => r.key === key);

describe('selectSettings', () => {
  it('returns null when nothing was read', () => {
    assert.equal(selectSettings(null), null);
    assert.equal(selectSettings({}), null);
  });

  it('builds a view-model that matches the contract shape', () => {
    assert.deepEqual(checkShape(selectSettings(answers()), SETTINGS_SHAPE), []);
    assert.deepEqual(checkShape(selectSettings({ features: FEATURES }), SETTINGS_SHAPE), []);
  });

  it('maps schema fields to row types, units and defaults', () => {
    const vm = selectSettings(answers({ host: { ...HOST, glassStrength: 70 } }));
    const glass = rowOf(vm, 'look', 'host.glassStrength');
    assert.deepEqual([glass.type, glass.value, glass.default, glass.unit, glass.label], ['num', 70, 50, '%', 'Glass strength']);
    assert.equal(rowOf(vm, 'look', 'host.sendPending').type, 'sw');
    assert.equal(rowOf(vm, 'tools', 'host.tailBudget').unit, 'tokens');
    assert.equal(rowOf(vm, 'tools', 'host.callQueue').value, true);
  });

  it('shows choices by label, drops Solid, and falls back to the default when the stored value is not offered', () => {
    const style = rowOf(selectSettings(answers()), 'look', 'host.panelStyle');
    assert.deepEqual(style.options, ['Glass', 'Follow SillyTavern']);
    assert.equal(style.type, 'seg');
    assert.equal(rowOf(selectSettings(answers({ host: { ...HOST, panelStyle: 'solid' } })), 'look', 'host.panelStyle').value, 'Glass');
    assert.equal(rowOf(selectSettings(answers({ host: { ...HOST, font: 'theme' } })), 'look', 'host.font').value, 'Your theme\'s font');
    assert.equal(rowOf(selectSettings(answers()), 'look', 'host.textSize').type, 'seg');
  });

  it('skips fields the schema lacks or the overlay cannot draw', () => {
    const vm = selectSettings(answers({ schema: { ...SCHEMA, font: undefined, textSize: { type: 'weird' } } }));
    assert.equal(rowOf(vm, 'look', 'host.font'), undefined);
    assert.equal(rowOf(vm, 'look', 'host.textSize'), undefined);
    assert.equal(vm.sections.find(s => s.id === 'look').rows.length, 3);
  });

  it('groups features into module sets and finds the preset', () => {
    const vm = selectSettings(answers());
    assert.deepEqual(vm.modules.defs.map(d => d.id), ['rpg', 'world']);
    assert.deepEqual(vm.modules.chat.rpg, { on: true, subs: { 'rpg.fights': true, 'rpg.gear': true } });
    assert.equal(vm.modules.chat.world.on, false);
    assert.equal(vm.modules.defs[1].subs[0].needs, 'needs the story clock');
    assert.equal(vm.modules.preset, 'standard');
    assert.equal(selectSettings(answers({ features: FEATURES.map(f => ({ ...f, on: false })) })).modules.preset, 'lean');
    assert.equal(selectSettings(answers({ features: FEATURES.map((f, i) => ({ ...f, on: i === 0 })) })).modules.preset, null);
  });

  it('leaves gaps empty: connections, packs, sent, presets, per-chat sets', () => {
    const vm = selectSettings(answers({ subtitle: 'this chat' }));
    assert.equal(vm.sent, null);
    assert.equal(vm.subtitle, 'this chat');
    assert.deepEqual([vm.connections, vm.modules.presets, vm.modules.newChats, vm.packs.packs], [[], [], {}, []]);
    assert.equal(selectSettings(answers({ features: undefined })).modules.defs.length, 0);
  });
});
